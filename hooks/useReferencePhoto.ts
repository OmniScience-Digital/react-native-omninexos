// hooks/useReferencePhoto.ts
import { client } from "@/src/amplify";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUrl, uploadData } from "aws-amplify/storage";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";

const SETUP_KEY = (uid: string) => `face:setup_complete:${uid}`;
const PHOTO_URI_KEY = (uid: string) => `face:cached_photo_uri:${uid}`;
const S3_PATH = (uid: string) => `hr/reference-faces/${uid}/profile.jpg`;

// GraphQL for PhotoChangeRequest
const CREATE_PHOTO_REQUEST = /* GraphQL */ `
  mutation CreatePhotoChangeRequest($input: CreatePhotoChangeRequestInput!) {
    createPhotoChangeRequest(input: $input) {
      id
      userId
      status
      createdAt
    }
  }
`;

const LIST_PHOTO_REQUESTS_BY_USER = /* GraphQL */ `
  query ListPhotoChangeRequestsByUser($userId: String!) {
    listPhotoChangeRequests(
      filter: { userId: { eq: $userId }, status: { eq: "PENDING" } }
      limit: 1
    ) {
      items {
        id
        userId
        status
        createdAt
        updatedAt
      }
    }
  }
`;

const GET_APPROVED_REQUEST = /* GraphQL */ `
  query GetApprovedPhotoRequest($userId: String!) {
    listPhotoChangeRequests(
      filter: { userId: { eq: $userId }, status: { eq: "APPROVED" } }
      limit: 1
    ) {
      items {
        id
        userId
        status
        createdAt
        updatedAt
      }
    }
  }
`;

const UPDATE_PHOTO_REQUEST = /* GraphQL */ `
  mutation UpdatePhotoChangeRequest($input: UpdatePhotoChangeRequestInput!) {
    updatePhotoChangeRequest(input: $input) {
      id
      status
    }
  }
`;

export interface PhotoChangeRequest {
  id: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  createdAt: string;
  updatedAt?: string;
}

export function useReferencePhoto(userId: string) {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] =
    useState<PhotoChangeRequest | null>(null);
  const [approvedRequest, setApprovedRequest] =
    useState<PhotoChangeRequest | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);

  // ── Check setup status on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!userId || userId === "anonymous") return;

    // Guard: userId must be an email. During Cognito auth the user object
    // can briefly carry only `sub` (UUID) before fetchUserAttributes
    // resolves — we wait for the real email before doing anything.
    if (!userId.includes("@")) return;

    AsyncStorage.getItem(SETUP_KEY(userId)).then(async (val) => {
      if (val === "true") {
        setIsSetupComplete(true);
        return;
      }
      // No local flag — could be a fresh device install even though the
      // photo already exists in S3 under this email. Check S3 directly
      // before concluding the user needs to set up again.
      try {
        await getUrl({ path: S3_PATH(userId) });
        // Photo found in S3 — backfill the local flag and mark complete.
        await AsyncStorage.setItem(SETUP_KEY(userId), "true");
        setIsSetupComplete(true);
      } catch {
        // No photo in S3 either — genuinely needs setup.
        setIsSetupComplete(false);
      }
    });
  }, [userId]);

  // ── Load existing photo from S3 (with offline cache fallback) ──────────
  useEffect(() => {
    if (!isSetupComplete || !userId) return;

    // 1. Show cached URI immediately (works offline, like Facebook)
    AsyncStorage.getItem(PHOTO_URI_KEY(userId)).then((cached) => {
      if (cached) setPhotoUri(cached);
    });

    // 2. Try to refresh a fresh signed URL from S3 (online only)
    getUrl({ path: S3_PATH(userId) })
      .then(({ url }) => {
        const fresh = url.toString();
        setPhotoUri(fresh);
        // Persist the fresh URL so next offline load sees an up-to-date URI.
        // Signed URLs expire, but the local file URI written after upload
        // never expires — so we also store the localUri after upload (below).
        AsyncStorage.setItem(PHOTO_URI_KEY(userId), fresh).catch(() => {});
      })
      .catch(() => {
        // Network unavailable — cached URI already set above, nothing to do.
      });
  }, [isSetupComplete, userId]);

  // ── Check for pending/approved requests from DynamoDB ───────────────────
  useEffect(() => {
    if (!userId || userId === "anonymous" || !isSetupComplete) return;

    const checkRequests = async () => {
      try {
        // Check pending
        const { data: pendingData, errors: pe } = (await client.graphql({
          query: LIST_PHOTO_REQUESTS_BY_USER,
          variables: { userId },
          authMode: "apiKey",
        })) as any;
        if (!pe) {
          const pending =
            pendingData?.listPhotoChangeRequests?.items?.[0] ?? null;
          setPendingRequest(pending);
        }

        // Check approved
        const { data: approvedData, errors: ae } = (await client.graphql({
          query: GET_APPROVED_REQUEST,
          variables: { userId },
          authMode: "apiKey",
        })) as any;
        if (!ae) {
          const approved =
            approvedData?.listPhotoChangeRequests?.items?.[0] ?? null;
          setApprovedRequest(approved);
        }
      } catch {
        // Silent — non-critical
      }
    };

    checkRequests();
  }, [userId, isSetupComplete]);

  // ── Request photo change (creates a pending request) ────────────────────
  const requestPhotoChange = useCallback(async (): Promise<boolean> => {
    if (!userId || userId === "anonymous") return false;
    setRequestLoading(true);
    try {
      const { data, errors } = (await client.graphql({
        query: CREATE_PHOTO_REQUEST,
        variables: {
          input: {
            userId,
            status: "PENDING",
            requestedAt: new Date().toISOString(),
          },
        },
        authMode: "apiKey",
      })) as any;
      if (errors) throw new Error(errors[0].message);
      setPendingRequest(data.createPhotoChangeRequest);
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit request");
      return false;
    } finally {
      setRequestLoading(false);
    }
  }, [userId]);

  // ── Open camera and capture selfie (only if approved or no photo yet) ───
  const captureAndUpload = useCallback(async (): Promise<boolean> => {
    setError(null);

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setError("Camera permission is required to set up face verification.");
      return false;
    }

    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return false;
    }

    const localUri = result.assets[0].uri;
    setPhotoUri(localUri);
    // Cache locally first so the photo is visible even before upload completes
    // and remains visible offline (same pattern as Facebook profile photos).
    AsyncStorage.setItem(PHOTO_URI_KEY(userId), localUri).catch(() => {});
    setUploading(true);

    try {
      const response = await fetch(localUri);
      const blob = await response.blob();

      await uploadData({
        path: S3_PATH(userId),
        data: blob,
        options: { contentType: "image/jpeg" },
      }).result;

      await AsyncStorage.setItem(SETUP_KEY(userId), "true");
      setIsSetupComplete(true);

      // If there was an approved request, mark it as used (COMPLETED)
      if (approvedRequest) {
        try {
          await client.graphql({
            query: UPDATE_PHOTO_REQUEST,
            variables: {
              input: { id: approvedRequest.id, status: "COMPLETED" },
            },
            authMode: "apiKey",
          });
          setApprovedRequest(null);
        } catch {
          // Non-critical
        }
      }

      const { url } = await getUrl({ path: S3_PATH(userId) });
      const freshUrl = url.toString();
      setPhotoUri(freshUrl);
      // Update cache with the S3-signed URL so subsequent online loads are fast
      AsyncStorage.setItem(PHOTO_URI_KEY(userId), freshUrl).catch(() => {});
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Upload failed. Please try again.");
      setPhotoUri(null);
      return false;
    } finally {
      setUploading(false);
    }
  }, [userId, approvedRequest]);

  // ── Reset — only available if approved or no photo ───────────────────────
  const resetSetup = useCallback(async () => {
    if (!approvedRequest && isSetupComplete) return; // blocked
    await AsyncStorage.removeItem(SETUP_KEY(userId));
    await AsyncStorage.removeItem(PHOTO_URI_KEY(userId));
    setIsSetupComplete(false);
    setPhotoUri(null);
  }, [userId, approvedRequest, isSetupComplete]);

  const clearError = useCallback(() => setError(null), []);

  // canChangePhoto = no photo set yet OR has an APPROVED request
  const canChangePhoto = !isSetupComplete || !!approvedRequest;

  return {
    isSetupComplete,
    photoUri,
    uploading,
    error,
    clearError,
    captureAndUpload,
    resetSetup,
    requestPhotoChange,
    canChangePhoto,
    pendingRequest,
    approvedRequest,
    requestLoading,
    s3Path: S3_PATH(userId),
  };
}

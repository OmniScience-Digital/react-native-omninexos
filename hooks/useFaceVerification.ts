// hooks/useFaceVerification.ts
//
// expo-file-system v19 (SDK 54) replaced the old procedural API with a new
// OOP API (File, Directory, Paths). The old functions (copyAsync, getInfoAsync,
// cacheDirectory, etc.) now live in "expo-file-system/legacy" — importing them
// from the main "expo-file-system" package throws at runtime.
//
import outputs from "@/amplify_outputs.json";
import NetInfo from "@react-native-community/netinfo";
import { uploadData } from "aws-amplify/storage";
import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";

export type VerificationResult = {
  status: "VERIFIED" | "PENDING_VERIFICATION" | "REVIEW_REQUIRED";
  similarity: number;
  reason: string;
  selfieKey: string | null;
  localSelfieUri?: string;
};

const SELFIE_PATH = (userId: string) =>
  `hr/clock-selfies/${userId}/${Date.now()}.jpg`;

// cacheDirectory ends with "/" per the legacy API contract
const BASE_DIR = (cacheDirectory ?? "file://tmp/").replace(/\/$/, "");
const OFFLINE_SELFIE_DIR = `${BASE_DIR}/offline-selfies/`;

const VERIFY_URL: string = (outputs as any)?.custom?.verifyFaceApiUrl ?? "";

export function useFaceVerification(userId: string) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store selfie on disk for later sync when offline
  const saveOfflineSelfie = async (
    localUri: string,
  ): Promise<string | null> => {
    try {
      const info = await getInfoAsync(OFFLINE_SELFIE_DIR);
      if (!info.exists) {
        await makeDirectoryAsync(OFFLINE_SELFIE_DIR, { intermediates: true });
      }
      const dest = `${OFFLINE_SELFIE_DIR}${userId}_${Date.now()}.jpg`;
      await copyAsync({ from: localUri, to: dest });
      return dest;
    } catch {
      return null;
    }
  };

  const verify = useCallback(async (): Promise<VerificationResult | null> => {
    setVerifying(true);
    setError(null);
    try {
      const net = await NetInfo.fetch();
      // On iOS in airplane mode, isInternetReachable may be null (undetermined).
      // Treat null as offline — same as !== true — so offline path is taken.
      const isOnline =
        net.isConnected === true && net.isInternetReachable === true;

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        setError("Camera permission required for face verification.");
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return null;

      const localUri = result.assets[0].uri;

      // ── OFFLINE PATH ────────────────────────────────────────────────────────
      if (!isOnline) {
        const savedUri = await saveOfflineSelfie(localUri);
        return {
          status: "PENDING_VERIFICATION",
          similarity: 0,
          reason: "Offline — identity will be verified when connection returns",
          selfieKey: null,
          localSelfieUri: savedUri ?? localUri,
        };
      }

      // ── ONLINE PATH ─────────────────────────────────────────────────────────
      const selfieKey = SELFIE_PATH(userId);
      const blob = await (await fetch(localUri)).blob();
      await uploadData({
        path: selfieKey,
        data: blob,
        options: { contentType: "image/jpeg" },
      }).result;

      const lambdaRes = await fetch(VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, selfieKey }),
      });
      const body: { verified: boolean; similarity: number; reason: string } =
        await lambdaRes.json();

      return {
        status: body.verified ? "VERIFIED" : "REVIEW_REQUIRED",
        similarity: body.similarity,
        reason: body.reason,
        selfieKey,
        localSelfieUri: localUri,
      };
    } catch (e: any) {
      // Re-check connectivity — if we're offline, a network error during the
      // online verification path should not block clock-in/out. Return
      // PENDING_VERIFICATION so the action queues and verifies on sync.
      let stillOnline = false;
      try {
        const net = await NetInfo.fetch();
        stillOnline =
          net.isConnected === true && net.isInternetReachable === true;
      } catch {
        stillOnline = false;
      }
      if (!stillOnline) {
        return {
          status: "PENDING_VERIFICATION",
          similarity: 0,
          reason: "Offline — identity will be verified when connection returns",
          selfieKey: null,
        };
      }
      setError(e?.message ?? "Verification failed");
      return {
        status: "REVIEW_REQUIRED",
        similarity: 0,
        reason: e?.message ?? "Verification error",
        selfieKey: null,
      };
    } finally {
      setVerifying(false);
    }
  }, [userId]);

  // Called by syncEngine when connection is restored — uploads stored selfie
  const syncOfflineSelfie = useCallback(
    async (
      localUri: string,
      clockRecordId: string,
    ): Promise<VerificationResult | null> => {
      try {
        const selfieKey = SELFIE_PATH(userId);
        const blob = await (await fetch(localUri)).blob();
        await uploadData({
          path: selfieKey,
          data: blob,
          options: { contentType: "image/jpeg" },
        }).result;

        const lambdaRes = await fetch(VERIFY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, selfieKey, clockRecordId }),
        });
        const body: { verified: boolean; similarity: number; reason: string } =
          await lambdaRes.json();

        // Clean up local file after successful sync
        try {
          await deleteAsync(localUri, { idempotent: true });
        } catch {}

        return {
          status: body.verified ? "VERIFIED" : "REVIEW_REQUIRED",
          similarity: body.similarity,
          reason: body.reason,
          selfieKey,
        };
      } catch (e: any) {
        return {
          status: "REVIEW_REQUIRED",
          similarity: 0,
          reason: e?.message ?? "Sync verification failed",
          selfieKey: null,
        };
      }
    },
    [userId],
  );

  const clearError = useCallback(() => setError(null), []);
  return { verify, syncOfflineSelfie, verifying, error, clearError };
}

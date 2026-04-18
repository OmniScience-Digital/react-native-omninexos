// components/viFComponents/PhotoUpload.tsx
import { useTheme } from "@/src/contexts/theme-context";
import {
  addPhoto,
  clearAllPhotos,
  incrementUploadProgress,
  removePhoto,
  resetUploadProgress,
  setUploadProgress,
  updatePhotoStatus,
} from "@/src/state";
import { useAppDispatch, useAppSelector } from "@/src/state/redux";
import { uploadData } from "aws-amplify/storage";
import * as ImagePicker from "expo-image-picker";
import { AlertCircle, CheckCircle, Upload, X } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface PhotoUploadProps {
  vehicleReg: string;
  inspectionNumber: number | null;
  disabled?: boolean;
}

// Helper: clean vehicle registration for S3 path
const cleanVehicleReg = (reg: string): string => {
  return reg.replace(/[^a-zA-Z0-9]/g, "-");
};

// Helper: generate random string for uniqueness
const randomString = (length: number = 8): string => {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
};

export default function PhotoUpload({
  vehicleReg,
  inspectionNumber,
  disabled = false,
}: PhotoUploadProps) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const photos = useAppSelector((state) => state.global.vifForm.photos);
  const uploadProgress = useAppSelector((state) => state.global.uploadProgress);

  const generateS3Key = (index: number): string => {
    const timestamp = Date.now();
    const cleanReg = cleanVehicleReg(vehicleReg);
    const random = randomString();
    return `inspections/${cleanReg}/${inspectionNumber}/${timestamp}-${index}-${random}.jpg`;
  };

  const uploadSinglePhoto = async (
    photo: any,
    index: number,
    total: number,
  ) => {
    try {
      // Update progress before starting this upload
      dispatch(incrementUploadProgress());

      // Convert URI to blob
      const response = await fetch(photo.uri);
      const blob = await response.blob();

      // Generate correct S3 key
      const s3Key = generateS3Key(index);

      // Upload to S3
      await uploadData({
        path: s3Key,
        data: blob,
        options: {
          contentType: "image/jpeg",
        },
      }).result;

      // Success
      dispatch(
        updatePhotoStatus({
          id: photo.id,
          status: "success",
          s3Key: s3Key, // store only the key, not s3://bucket/
          error: undefined,
        }),
      );
    } catch (error) {
      console.error("S3 upload failed:", error);
      dispatch(
        updatePhotoStatus({
          id: photo.id,
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        }),
      );
    }
  };

  const pickImages = async () => {
    if (disabled) return;
    if (!vehicleReg || !inspectionNumber) {
      Alert.alert("Cannot Upload", "Please select a vehicle first");
      return;
    }
    if (photos.length >= 20) {
      Alert.alert("Limit Reached", "Maximum 20 photos allowed");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const remaining = 20 - photos.length;
      const newAssets = result.assets.slice(0, remaining);

      // Create photo objects with temporary IDs and 'uploading' status
      const newPhotos = newAssets.map((asset, idx) => ({
        id: `${Date.now()}_${idx}_${randomString()}`,
        uri: asset.uri,
        status: "uploading" as const,
        s3Key: "",
      }));

      // Add to Redux
      newPhotos.forEach((photo) => dispatch(addPhoto(photo)));

      // Set overall upload progress
      const totalImages = photos.length + newPhotos.length;
      dispatch(
        setUploadProgress({
          isUploading: true,
          currentImage: 0,
          totalImages,
        }),
      );

      // Upload each photo sequentially
      for (let i = 0; i < newPhotos.length; i++) {
        await uploadSinglePhoto(newPhotos[i], i, totalImages);
      }

      // All done
      dispatch(resetUploadProgress());
    }
  };

  const retryUpload = async (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;

    // Reset status to uploading
    dispatch(
      updatePhotoStatus({ id: photoId, status: "uploading", error: undefined }),
    );

    // Re-upload
    try {
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      const s3Key = generateS3Key(photos.findIndex((p) => p.id === photoId));
      await uploadData({
        path: s3Key,
        data: blob,
        options: { contentType: "image/jpeg" },
      }).result;
      dispatch(
        updatePhotoStatus({
          id: photoId,
          status: "success",
          s3Key,
          error: undefined,
        }),
      );
    } catch (error) {
      dispatch(
        updatePhotoStatus({
          id: photoId,
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        }),
      );
    }
  };

  const removePhotoHandler = (id: string) => {
    dispatch(removePhoto(id));
  };

  const removeAllPhotos = () => {
    Alert.alert("Remove All Photos", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove All",
        style: "destructive",
        onPress: () => dispatch(clearAllPhotos()),
      },
    ]);
  };

  const allUploaded =
    photos.length > 0 && photos.every((p) => p.status === "success");
  const uploading = photos.some((p) => p.status === "uploading");
  const hasErrors = photos.some((p) => p.status === "error");

  const styles = StyleSheet.create({
    container: { gap: 12 },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
    },
    toolbarLeft: { flexDirection: "row", gap: 8, alignItems: "center" },
    uploadBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    uploadBtnDisabled: {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    uploadBtnText: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.text,
    },
    uploadBtnTextDisabled: { color: theme.colors.textMuted },
    removeAllBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#fecaca",
      backgroundColor: "#fff5f5",
    },
    removeAllText: { fontSize: 13, color: "#ef4444", fontWeight: "500" },
    allUploadedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    allUploadedText: { fontSize: 12, color: theme.colors.success },
    warning: { fontSize: 12, color: theme.colors.warning },
    photoList: { paddingVertical: 4, gap: 8, flexDirection: "row" },
    photoItem: {
      width: 100,
      height: 100,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      overflow: "visible",
      position: "relative",
    },
    photo: { width: "100%", height: "100%", borderRadius: 8 },
    statusIcon: { position: "absolute", top: 4, left: 4 },
    removeBtn: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#ef4444",
      alignItems: "center",
      justifyContent: "center",
    },
    retryBtn: {
      position: "absolute",
      bottom: 4,
      left: 4,
      right: 4,
      backgroundColor: theme.colors.glass,
      borderRadius: 4,
      paddingVertical: 3,
      alignItems: "center",
    },
    retryText: { fontSize: 11, fontWeight: "500", color: theme.colors.text },
    summary: {
      fontSize: 11,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <TouchableOpacity
            style={[
              styles.uploadBtn,
              (!vehicleReg ||
                !inspectionNumber ||
                photos.length >= 20 ||
                uploading ||
                disabled) &&
                styles.uploadBtnDisabled,
            ]}
            onPress={pickImages}
            disabled={
              !vehicleReg ||
              !inspectionNumber ||
              photos.length >= 20 ||
              uploading ||
              disabled
            }
          >
            <Upload
              size={15}
              color={
                !vehicleReg ||
                !inspectionNumber ||
                photos.length >= 20 ||
                uploading ||
                disabled
                  ? "#94a3b8"
                  : "#1e293b"
              }
            />
            <Text
              style={[
                styles.uploadBtnText,
                (!vehicleReg ||
                  !inspectionNumber ||
                  photos.length >= 20 ||
                  uploading ||
                  disabled) &&
                  styles.uploadBtnTextDisabled,
              ]}
            >
              {uploading ? "Uploading…" : `Upload photos (${photos.length}/20)`}
            </Text>
          </TouchableOpacity>
          {photos.length > 0 && (
            <TouchableOpacity
              style={styles.removeAllBtn}
              onPress={removeAllPhotos}
              disabled={uploading || disabled}
            >
              <X size={10} color="#ef4444" />
              <Text style={styles.removeAllText}>Remove all</Text>
            </TouchableOpacity>
          )}
        </View>
        {allUploaded && (
          <View style={styles.allUploadedBadge}>
            <CheckCircle size={13} color="#16a34a" />
            <Text style={styles.allUploadedText}>All uploaded</Text>
          </View>
        )}
      </View>

      {!vehicleReg && (
        <Text style={styles.warning}>
          Select a vehicle first to upload photos
        </Text>
      )}
      {vehicleReg && !inspectionNumber && (
        <Text style={styles.warning}>Select an inspection number first</Text>
      )}

      {photos.length > 0 && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoList}
          >
            {photos.map((photo, index) => (
              <View key={photo.id} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <View style={styles.statusIcon}>
                  {photo.status === "uploading" && (
                    <ActivityIndicator size="small" color="#3b82f6" />
                  )}
                  {photo.status === "success" && (
                    <CheckCircle size={16} color="#22c55e" />
                  )}
                  {photo.status === "error" && (
                    <AlertCircle size={16} color="#ef4444" />
                  )}
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removePhotoHandler(photo.id)}
                  disabled={photo.status === "uploading" || disabled}
                >
                  <X size={10} color="#fff" />
                </TouchableOpacity>
                {photo.status === "error" && (
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => retryUpload(photo.id)}
                    disabled={disabled}
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
          <Text style={styles.summary}>
            {photos.length} photo(s) ·{" "}
            {photos.filter((p) => p.status === "success").length} uploaded ·{" "}
            {photos.filter((p) => p.status === "uploading").length} uploading ·{" "}
            {photos.filter((p) => p.status === "error").length} failed{" "}
            {hasErrors && "· Fix errors before submitting"}
          </Text>
        </>
      )}
    </View>
  );
}

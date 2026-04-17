// components/viFComponents/PhotoUpload.tsx
import { useTheme } from "@/src/contexts/theme-context";
import * as ImagePicker from "expo-image-picker";
import { AlertCircle, CheckCircle, Upload, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
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

export interface PhotoState {
  id: string;
  uri: string;
  status: "uploading" | "success" | "error" | "deleting";
  error?: string;
}

interface PhotoUploadProps {
  photos: PhotoState[];
  onPhotosChange: (photos: PhotoState[]) => void; // <-- main way to sync to parent
  vehicleReg: string;
  inspectionNumber: number | null;
  disabled?: boolean;
  // Deprecated props – kept for compatibility but will be ignored
  onAdd?: () => void;
  onRemove?: (index: number) => void;
  onRemoveAll?: () => void;
  onRetry?: (id: string) => void;
}

function StatusIcon({ status }: { status: PhotoState["status"] }) {
  if (status === "uploading" || status === "deleting") {
    return (
      <ActivityIndicator
        size="small"
        color={status === "uploading" ? "#3b82f6" : "#f97316"}
      />
    );
  }
  if (status === "success") return <CheckCircle size={16} color="#22c55e" />;
  if (status === "error") return <AlertCircle size={16} color="#ef4444" />;
  return null;
}

export default function PhotoUpload({
  photos: externalPhotos,
  onPhotosChange,
  vehicleReg,
  inspectionNumber,
  disabled = false,
}: PhotoUploadProps) {
  // Local state to avoid stale closures and disappearing images
  const { theme } = useTheme();
  const [localPhotos, setLocalPhotos] = useState<PhotoState[]>(externalPhotos);
  const [isUploading, setIsUploading] = useState(false);

  // Sync external changes (e.g., when vehicle changes, parent clears photos)
  useEffect(() => {
    setLocalPhotos(externalPhotos);
  }, [externalPhotos]);

  // Sync local changes to parent
  useEffect(() => {
    onPhotosChange(localPhotos);
  }, [localPhotos, onPhotosChange]);

  const pickImages = async () => {
    if (disabled) return;
    if (!vehicleReg || !inspectionNumber) {
      Alert.alert("Cannot Upload", "Please select a vehicle first");
      return;
    }
    if (localPhotos.length >= 20) {
      Alert.alert("Limit Reached", "Maximum 20 photos allowed");
      return;
    }

    // Request permission (important for iOS)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please grant photo library access to upload images",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], // ✅ Fix deprecation warning
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const remaining = 20 - localPhotos.length;
      const newAssets = result.assets.slice(0, remaining);

      const newPhotos: PhotoState[] = newAssets.map((asset, idx) => ({
        id: `${Date.now()}_${idx}_${Math.random()}`,
        uri: asset.uri,
        status: "uploading",
      }));

      // Add to local state immediately
      setLocalPhotos((prev) => [...prev, ...newPhotos]);

      // Simulate upload (replace with real upload logic)
      for (const photo of newPhotos) {
        await simulateUpload(photo.id);
      }
    }
  };

  // Replace this with your actual upload function (e.g., to S3 or API)
  const simulateUpload = async (photoId: string) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const isSuccess = Math.random() > 0.1; // 90% success rate for demo

    setLocalPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId
          ? {
              ...p,
              status: isSuccess ? "success" : "error",
              error: isSuccess ? undefined : "Upload failed",
            }
          : p,
      ),
    );
  };

  const retryUpload = (photoId: string) => {
    setLocalPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId ? { ...p, status: "uploading", error: undefined } : p,
      ),
    );
    simulateUpload(photoId);
  };

  const removePhoto = (index: number) => {
    setLocalPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeAllPhotos = () => {
    Alert.alert(
      "Remove All Photos",
      "Are you sure you want to remove all photos?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove All",
          style: "destructive",
          onPress: () => setLocalPhotos([]),
        },
      ],
    );
  };

  const allUploaded =
    localPhotos.length > 0 && localPhotos.every((p) => p.status === "success");
  const uploading = localPhotos.some((p) => p.status === "uploading");
  const hasDeleting = localPhotos.some((p) => p.status === "deleting");
  const hasErrors = localPhotos.some((p) => p.status === "error");

  const canAdd =
    !!vehicleReg &&
    !!inspectionNumber &&
    localPhotos.length < 20 &&
    !uploading &&
    !disabled;

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
    allUploadedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
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
    deletingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
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
            style={[styles.uploadBtn, !canAdd && styles.uploadBtnDisabled]}
            onPress={pickImages}
            disabled={!canAdd}
            activeOpacity={0.7}
          >
            <Upload size={15} color={canAdd ? "#1e293b" : "#94a3b8"} />
            <Text
              style={[
                styles.uploadBtnText,
                !canAdd && styles.uploadBtnTextDisabled,
              ]}
            >
              {uploading
                ? "Uploading…"
                : `Upload photos (${localPhotos.length}/20)`}
            </Text>
          </TouchableOpacity>

          {localPhotos.length > 0 && (
            <TouchableOpacity
              style={styles.removeAllBtn}
              onPress={removeAllPhotos}
              disabled={uploading || hasDeleting || disabled}
              activeOpacity={0.7}
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

      {localPhotos.length > 0 && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoList}
          >
            {localPhotos.map((photo, index) => (
              <View key={photo.id} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />

                <View style={styles.statusIcon}>
                  <StatusIcon status={photo.status} />
                </View>

                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removePhoto(index)}
                  disabled={
                    photo.status === "uploading" ||
                    photo.status === "deleting" ||
                    disabled
                  }
                  activeOpacity={0.7}
                >
                  <X size={10} color="#fff" />
                </TouchableOpacity>

                {photo.status === "error" && (
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => retryUpload(photo.id)}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                )}

                {photo.status === "deleting" && (
                  <View style={styles.deletingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <Text style={styles.summary}>
            {localPhotos.length} photo(s) ·{" "}
            {localPhotos.filter((p) => p.status === "success").length} uploaded
            · {localPhotos.filter((p) => p.status === "uploading").length}{" "}
            uploading · {localPhotos.filter((p) => p.status === "error").length}{" "}
            failed
            {hasErrors && " · Fix errors before submitting"}
          </Text>
        </>
      )}
    </View>
  );
}

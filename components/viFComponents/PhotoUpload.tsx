// components/viFComponents/PhotoUpload.tsx
import { useTheme } from "@/src/contexts/theme-context";
import {
  addPhoto,
  clearAllPhotos,
  removePhoto,
  updatePhotoStatus,
} from "@/src/state";
import { useAppDispatch, useAppSelector } from "@/src/state/redux";
import NetInfo from "@react-native-community/netinfo";
import { uploadData } from "aws-amplify/storage";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Clock,
  Images,
  X,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
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

const cleanVehicleReg = (reg: string): string =>
  reg.replace(/[^a-zA-Z0-9]/g, "-");

const randomString = (length: number = 8): string =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length);

export default function PhotoUpload({
  vehicleReg,
  inspectionNumber,
  disabled = false,
}: PhotoUploadProps) {
  const { theme } = useTheme();
  const dispatch = useAppDispatch();
  const photos = useAppSelector((state) => state.global.vifForm.photos);

  const uploading = photos.some((p) => p.status === "uploading");
  const allDone =
    photos.length > 0 &&
    photos.every((p) => p.status === "success" || p.status === "local");
  const hasErrors = photos.some((p) => p.status === "error");
  const localCount = photos.filter((p) => p.status === "local").length;
  const isDisabled =
    !vehicleReg || !inspectionNumber || photos.length >= 20 || disabled;

  const isSimulator =
    Platform.OS === "ios" && Constants.executionEnvironment === "storeClient"
      ? false
      : __DEV__ && !Constants.isDevice;

  const generateS3Key = (index: number): string =>
    `inspections/${cleanVehicleReg(vehicleReg)}/${inspectionNumber}/${Date.now()}-${index}-${randomString()}.jpg`;

  // ─── Upload one photo to S3 ───────────────────────────────
  const uploadSinglePhoto = async (
    photo: { id: string; uri: string },
    index: number,
  ) => {
    try {
      const response = await fetch(photo.uri);
      const blob = await response.blob();
      const s3Key = generateS3Key(index);
      await uploadData({
        path: s3Key,
        data: blob,
        options: { contentType: "image/jpeg" },
      }).result;
      dispatch(
        updatePhotoStatus({
          id: photo.id,
          status: "success",
          s3Key,
          error: undefined,
        }),
      );
    } catch (error) {
      dispatch(
        updatePhotoStatus({
          id: photo.id,
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        }),
      );
    }
  };

  // ─── Process captured/picked assets ──────────────────────
  // Online  → upload to S3 immediately
  // Offline → store local URI only, marked "local" for later sync
  const processAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const remaining = 20 - photos.length;
    const newAssets = assets.slice(0, remaining);

    const net = await NetInfo.fetch();
    const online = !!(net.isConnected && net.isInternetReachable);

    if (online) {
      // Add as "uploading" then upload in parallel
      const newPhotos = newAssets.map((asset, idx) => ({
        id: `${Date.now()}_${idx}_${randomString()}`,
        uri: asset.uri,
        status: "uploading" as const,
        s3Key: "",
      }));
      newPhotos.forEach((p) => dispatch(addPhoto(p)));
      await Promise.all(
        newPhotos.map((photo, idx) =>
          uploadSinglePhoto(photo, photos.length + idx),
        ),
      );
    } else {
      // Offline — just store locally, sync engine will upload later
      newAssets.forEach((asset, idx) => {
        dispatch(
          addPhoto({
            id: `${Date.now()}_${idx}_${randomString()}`,
            uri: asset.uri,
            status: "local" as any, // stored locally, pending S3 upload
            s3Key: "",
          }),
        );
      });
    }
  };

  // ─── Camera ──────────────────────────────────────────────
  const openCamera = async () => {
    if (isDisabled || uploading) return;
    if (isSimulator) {
      await openGallery();
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera permission needed",
        "Please grant camera access in settings.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      allowsEditing: false,
      exif: false,
      base64: false,
    });
    if (!result.canceled && result.assets) await processAssets(result.assets);
  };

  // ─── Gallery ─────────────────────────────────────────────
  const openGallery = async () => {
    if (isDisabled || uploading) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant photo library access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.5,
      exif: false,
      base64: false,
    });
    if (!result.canceled && result.assets) await processAssets(result.assets);
  };

  // ─── Retry a failed photo ─────────────────────────────────
  const retryUpload = async (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      // No network — downgrade to local instead of erroring again
      dispatch(
        updatePhotoStatus({
          id: photoId,
          status: "local" as any,
          error: undefined,
        }),
      );
      return;
    }
    dispatch(
      updatePhotoStatus({ id: photoId, status: "uploading", error: undefined }),
    );
    await uploadSinglePhoto(
      photo,
      photos.findIndex((p) => p.id === photoId),
    );
  };

  const removePhotoHandler = (id: string) => dispatch(removePhoto(id));

  const removeAllPhotos = () =>
    Alert.alert("Remove all photos", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove all",
        style: "destructive",
        onPress: () => dispatch(clearAllPhotos()),
      },
    ]);

  const styles = StyleSheet.create({
    container: { gap: 12 },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
    },
    toolbarLeft: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap",
    },
    cameraBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDisabled ? theme.colors.border : theme.colors.accent,
      backgroundColor: isDisabled
        ? theme.colors.background
        : theme.colors.accent + "14",
    },
    cameraBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: isDisabled ? theme.colors.textMuted : theme.colors.accent,
    },
    galleryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    galleryBtnText: { fontSize: 12, color: theme.colors.textMuted },
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
    removeAllText: { fontSize: 12, color: "#ef4444", fontWeight: "500" },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    allDoneBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    allDoneText: { fontSize: 12, color: theme.colors.success },
    localBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    localBadgeText: { fontSize: 12, color: theme.colors.warning },
    countHint: { fontSize: 12, color: theme.colors.textMuted },
    warning: { fontSize: 12, color: theme.colors.warning },
    photoList: { paddingVertical: 4, gap: 8, flexDirection: "row" },
    photoItem: {
      width: 90,
      height: 90,
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
          {/* Camera */}
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={openCamera}
            disabled={isDisabled || uploading}
          >
            <Camera
              size={15}
              color={isDisabled ? theme.colors.textMuted : theme.colors.accent}
            />
            <Text style={styles.cameraBtnText}>
              {uploading ? "Uploading…" : "Take photo"}
            </Text>
          </TouchableOpacity>

          {/* Gallery */}
          <TouchableOpacity
            style={styles.galleryBtn}
            onPress={openGallery}
            disabled={isDisabled || uploading}
          >
            <Images size={13} color={theme.colors.textMuted} />
            <Text style={styles.galleryBtnText}>Gallery</Text>
          </TouchableOpacity>

          {/* Remove all */}
          {photos.length > 0 && !uploading && (
            <TouchableOpacity
              style={styles.removeAllBtn}
              onPress={removeAllPhotos}
              disabled={disabled}
            >
              <X size={10} color="#ef4444" />
              <Text style={styles.removeAllText}>Remove all</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.badgeRow}>
          {localCount > 0 && (
            <View style={styles.localBadge}>
              <Clock size={12} color={theme.colors.warning} />
              <Text style={styles.localBadgeText}>{localCount} pending</Text>
            </View>
          )}
          {allDone && localCount === 0 && (
            <View style={styles.allDoneBadge}>
              <CheckCircle size={13} color="#16a34a" />
              <Text style={styles.allDoneText}>All uploaded</Text>
            </View>
          )}
          <Text style={styles.countHint}>{photos.length}/20</Text>
        </View>
      </View>

      {/* Hints */}
      {!vehicleReg && (
        <Text style={styles.warning}>
          Select a vehicle first to capture photos
        </Text>
      )}
      {vehicleReg && !inspectionNumber && (
        <Text style={styles.warning}>Select an inspection number first</Text>
      )}
      {localCount > 0 && (
        <Text style={styles.warning}>
          {localCount} photo{localCount !== 1 ? "s" : ""} saved locally — will
          upload when back online
        </Text>
      )}

      {/* Photo strip */}
      {photos.length > 0 && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoList}
          >
            {photos.map((photo) => (
              <View key={photo.id} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <View style={styles.statusIcon}>
                  {photo.status === "uploading" && (
                    <ActivityIndicator size="small" color="#3b82f6" />
                  )}
                  {photo.status === "success" && (
                    <CheckCircle size={16} color="#22c55e" />
                  )}
                  {(photo.status as string) === "local" && (
                    <Clock size={16} color="#f59e0b" />
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
            {photos.filter((p) => p.status === "success").length} uploaded ·{" "}
            {photos.filter((p) => (p.status as string) === "local").length}{" "}
            local · {photos.filter((p) => p.status === "uploading").length}{" "}
            uploading · {photos.filter((p) => p.status === "error").length}{" "}
            failed
            {hasErrors ? " · Tap retry on failed photos" : ""}
          </Text>
        </>
      )}
    </View>
  );
}

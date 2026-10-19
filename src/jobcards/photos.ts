// src/jobcards/photos.ts
// Taking and keeping photos. A photo is copied into the app's own document folder at once: the camera's temporary
// file can be deleted by the phone at any time, and the photo must survive until it has been sent.
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { newId } from "./ids";

export class PhotoPermissionError extends Error {
  constructor(what: "camera" | "photo library") {
    super(`Allow access to the ${what} in the phone's settings to add photos.`);
    this.name = "PhotoPermissionError";
  }
}

const QUALITY = 0.6; // keeps photos small enough to send on a weak connection

async function persist(uri: string, workItemId: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}jobcards/${workItemId}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const to = `${dir}${newId()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to });
  return to;
}

/** Open the camera. Returns the saved photo's path, or null if the technician cancelled. */
export async function takePhoto(workItemId: string): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new PhotoPermissionError("camera");
  const res = await ImagePicker.launchCameraAsync({
    quality: QUALITY,
    allowsEditing: false,
    exif: false,
  });
  if (res.canceled || !res.assets?.[0]?.uri) return null;
  return persist(res.assets[0].uri, workItemId);
}

/** Choose photos from the gallery (up to `max`). */
export async function pickPhotos(
  workItemId: string,
  max: number,
): Promise<string[]> {
  if (max <= 0) return [];
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new PhotoPermissionError("photo library");
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
    quality: QUALITY,
    exif: false,
  });
  if (res.canceled) return [];
  const out: string[] = [];
  for (const a of res.assets.slice(0, max))
    out.push(await persist(a.uri, workItemId));
  return out;
}

/** Delete photo files from the phone. Missing files are ignored. */
export async function deletePhotoFiles(uris: string[]): Promise<void> {
  for (const uri of uris) {
    if (!uri) continue;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      /* already gone */
    }
  }
}

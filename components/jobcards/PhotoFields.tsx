// components/jobcards/PhotoFields.tsx
// Photo inputs: one photo, or a list with a minimum and maximum. Photos are saved on the phone as soon as they are taken.
//
// A finished photo on the server is stored in the draft as "remote:<storage key>" (that marker is what stops it being
// uploaded again when the correction is sent). Passing that straight to <Image> throws "No suitable image URL
// loader" on iOS, so it is resolved to a signed S3 URL first. Local photos (file://, content://) are rendered
// directly and never resolved.
import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import {
  PhotoPermissionError,
  deletePhotoFiles,
  pickPhotos,
  takePhoto,
} from "@/src/jobcards/photos";
import { isRemotePhoto, remoteKeyOf } from "@/src/jobcards/remote";
import { getUrl } from "aws-amplify/storage";
import { Camera, Images, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { DANGER, Field, MED, SecondaryButton } from "./ui";

const ICamera = Camera as React.ComponentType<{
  size?: number;
  color?: string;
}>;
const IImages = Images as React.ComponentType<{
  size?: number;
  color?: string;
}>;
const IX = X as React.ComponentType<{ size?: number; color?: string }>;

/** Signed URLs, kept for the app session. getUrl's signed links last one hour; a failure falls back to "Sent". */
const signedCache = new Map<string, string>();

/**
 * Turns a photo URI into a URL <Image> can load.
 *   - Local (file://, content://, data:...)   → returned as-is.
 *   - Remote marker (remote:<storage key>)    → resolved to a signed S3 URL via Amplify.
 * Never throws: a failure leaves `resolved` null with `failed` true, so the caller can show a placeholder.
 */
function usePhotoUri(uri: string | null): {
  resolved: string | null;
  loading: boolean;
  failed: boolean;
} {
  const [state, setState] = useState<{
    resolved: string | null;
    loading: boolean;
    failed: boolean;
  }>(() => {
    if (!uri) return { resolved: null, loading: false, failed: false };
    if (!isRemotePhoto(uri))
      return { resolved: uri, loading: false, failed: false };
    const hit = signedCache.get(uri);
    return hit
      ? { resolved: hit, loading: false, failed: false }
      : { resolved: null, loading: true, failed: false };
  });

  useEffect(() => {
    if (!uri) {
      setState({ resolved: null, loading: false, failed: false });
      return;
    }
    if (!isRemotePhoto(uri)) {
      setState({ resolved: uri, loading: false, failed: false });
      return;
    }
    const hit = signedCache.get(uri);
    if (hit) {
      setState({ resolved: hit, loading: false, failed: false });
      return;
    }
    let cancelled = false;
    setState({ resolved: null, loading: true, failed: false });
    (async () => {
      try {
        const r = await getUrl({ path: remoteKeyOf(uri) });
        const signed = String(r.url);
        signedCache.set(uri, signed);
        if (!cancelled)
          setState({ resolved: signed, loading: false, failed: false });
      } catch {
        if (!cancelled)
          setState({ resolved: null, loading: false, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return state;
}

/** Delete the local file for a photo, if there is one. A remote photo lives on the server: nothing to delete. */
const removeLocalIfAny = (uri: string) => {
  if (isRemotePhoto(uri)) return;
  void deletePhotoFiles([uri]);
};

function Thumb({
  uri,
  onRemove,
  editable,
}: {
  uri: string;
  onRemove: () => void;
  editable: boolean;
}) {
  const { theme } = useTheme();
  const { resolved, loading, failed } = usePhotoUri(uri);
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  // A new URI replaces the old one (retake, or a different remote photo): any previous load failure no longer applies.
  useEffect(() => {
    setBroken(false);
  }, [uri]);
  const showFallback = loading || failed || broken || !resolved;

  return (
    <View style={styles.thumbWrap}>
      {showFallback ? (
        <View
          style={[
            styles.thumb,
            {
              borderColor: theme.colors.border,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
          accessibilityLabel={loading ? "Loading photo" : "Photo already sent"}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <ICamera size={20} color={theme.colors.textMuted} />
              <ThemedText muted style={{ fontSize: 10, marginTop: 2 }}>
                Sent
              </ThemedText>
            </>
          )}
        </View>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="imagebutton"
          accessibilityLabel="View photo"
        >
          <Image
            source={{ uri: resolved! }}
            onError={() => setBroken(true)}
            style={[styles.thumb, { borderColor: theme.colors.border }]}
            accessibilityLabel="Photo"
          />
        </Pressable>
      )}
      <Modal
        visible={open && !showFallback}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "black",
            justifyContent: "center",
          }}
          onPress={() => setOpen(false)}
        >
          {resolved && (
            <Image
              source={{ uri: resolved }}
              style={{ width: "100%", height: "85%" }}
              resizeMode="contain"
            />
          )}
        </Pressable>
      </Modal>
      {editable && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove photo"
          style={[
            styles.remove,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <IX size={14} color={theme.colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const explain = (e: unknown) => {
  Alert.alert(
    e instanceof PhotoPermissionError
      ? "Permission needed"
      : "Could not add the photo",
    e instanceof Error ? e.message : "Try again.",
  );
};

/** One required photo. */
export function PhotoField({
  label,
  uri,
  onChange,
  workItemId,
  error,
  editable = true,
}: {
  label: string;
  uri: string | null;
  onChange: (uri: string | null) => void;
  workItemId: string;
  error?: string;
  editable?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { theme } = useTheme();
  const replaceWith = async (get: () => Promise<string | null>) => {
    setBusy(true);
    try {
      const next = await get();
      if (next) {
        if (uri) removeLocalIfAny(uri); // replacing: the old local file is no longer needed
        onChange(next);
      }
    } catch (e) {
      explain(e);
    } finally {
      setBusy(false);
    }
  };
  const take = () => replaceWith(() => takePhoto(workItemId));
  const choose = () =>
    replaceWith(async () => (await pickPhotos(workItemId, 1))[0] ?? null);
  return (
    <Field label={label} error={error}>
      <View style={styles.row}>
        {uri ? (
          <Thumb
            uri={uri}
            editable={editable}
            onRemove={() => {
              removeLocalIfAny(uri);
              onChange(null);
            }}
          />
        ) : (
          <View
            style={[
              styles.empty,
              { borderColor: error ? DANGER : theme.colors.border },
            ]}
          >
            <ICamera size={22} color={theme.colors.textMuted} />
          </View>
        )}
        {editable && (
          <View style={{ flex: 1, gap: 8 }}>
            <SecondaryButton
              title={uri ? "Retake photo" : "Take photo"}
              onPress={take}
              disabled={busy}
              icon={<ICamera size={18} color={theme.colors.text} />}
            />
            <SecondaryButton
              title="From gallery"
              onPress={choose}
              disabled={busy}
              icon={<IImages size={18} color={theme.colors.text} />}
            />
          </View>
        )}
      </View>
    </Field>
  );
}

/** A list of photos with a minimum and a maximum. */
export function PhotoListField({
  label,
  uris,
  onChange,
  workItemId,
  min,
  max,
  error,
  editable = true,
}: {
  label: string;
  uris: string[];
  onChange: (uris: string[]) => void;
  workItemId: string;
  min: number;
  max: number;
  error?: string;
  editable?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { theme } = useTheme();
  const room = max - uris.length;
  const take = async () => {
    setBusy(true);
    try {
      const p = await takePhoto(workItemId);
      if (p) onChange([...uris, p]);
    } catch (e) {
      explain(e);
    } finally {
      setBusy(false);
    }
  };
  const choose = async () => {
    setBusy(true);
    try {
      const picked = await pickPhotos(workItemId, room);
      if (picked.length) onChange([...uris, ...picked]);
    } catch (e) {
      explain(e);
    } finally {
      setBusy(false);
    }
  };
  const enough = uris.length >= min;
  return (
    <Field label={label} error={error}>
      <ThemedText
        style={[
          MED,
          {
            fontSize: 12,
            color: enough ? theme.colors.success : theme.colors.warning,
          },
        ]}
      >
        {uris.length} added (at least {min}, at most {max})
      </ThemedText>
      {uris.length > 0 && (
        <View style={styles.grid}>
          {uris.map((u, i) => (
            <Thumb
              key={u}
              uri={u}
              editable={editable}
              onRemove={() => {
                removeLocalIfAny(u);
                onChange(uris.filter((_, j) => j !== i));
              }}
            />
          ))}
        </View>
      )}
      {editable && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              title="Take photo"
              onPress={take}
              disabled={busy || room <= 0}
              icon={<ICamera size={18} color={theme.colors.text} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              title="From gallery"
              onPress={choose}
              disabled={busy || room <= 0}
              icon={<IImages size={18} color={theme.colors.text} />}
            />
          </View>
        </View>
      )}
    </Field>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  thumbWrap: { width: 76, height: 76 },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    width: 76,
    height: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
});

// components/jobcards/PhotoFields.tsx
// Photo inputs: one photo, or a list with a minimum and maximum. Photos are saved on the phone as soon as they are taken.
import { ThemedText } from "@/components/screens/screen";
import { useTheme } from "@/src/contexts/theme-context";
import {
  PhotoPermissionError,
  deletePhotoFiles,
  pickPhotos,
  takePhoto,
} from "@/src/jobcards/photos";
import { Camera, Images, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Image, Modal, Pressable, StyleSheet, View } from "react-native";
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
  const [gone, setGone] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.thumbWrap}>
      {gone ? (
        <View
          style={[
            styles.thumb,
            {
              borderColor: theme.colors.border,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
          accessibilityLabel="Photo already sent"
        >
          <ICamera size={20} color={theme.colors.textMuted} />
          <ThemedText muted style={{ fontSize: 10, marginTop: 2 }}>
            Sent
          </ThemedText>
        </View>
      ) : (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="imagebutton"
          accessibilityLabel="View photo"
        >
          <Image
            source={{ uri }}
            onError={() => setGone(true)}
            style={[styles.thumb, { borderColor: theme.colors.border }]}
            accessibilityLabel="Photo"
          />
        </Pressable>
      )}
      <Modal
        visible={open}
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
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "85%" }}
            resizeMode="contain"
          />
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
        if (uri) void deletePhotoFiles([uri]); // replacing: the old file is no longer needed
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
              void deletePhotoFiles([uri]);
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
                void deletePhotoFiles([u]);
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

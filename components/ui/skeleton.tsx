// components/ui/skeleton.tsx
import { useTheme } from "@/src/contexts/theme-context";
import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/**
 * One shimmering row: a square icon placeholder plus 1–3 lines of text.
 * Covers the common "icon + title + meta line(s)" card shape shared by
 * Fleet, Inventory's category cards, and the Stock Control form's category
 * dropdown — pass `lines` to match how many text lines the real row has.
 */
export function IconRowSkeleton({ lines = 3 }: { lines?: 1 | 2 | 3 }) {
  const { theme } = useTheme();
  const widths: `${number}%`[] = ["60%", "40%", "50%"];
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Skeleton width={44} height={44} borderRadius={12} />
      <View style={styles.rowText}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            width={widths[i]}
            height={i === 0 ? 15 : 12}
            style={i < lines - 1 ? { marginBottom: 7 } : undefined}
          />
        ))}
      </View>
    </View>
  );
}

/** A handful of IconRowSkeletons, for a whole list/form's loading state. */
export function ListSkeleton({
  count = 5,
  lines = 3,
}: {
  count?: number;
  lines?: 1 | 2 | 3;
}) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <IconRowSkeleton key={i} lines={lines} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
});

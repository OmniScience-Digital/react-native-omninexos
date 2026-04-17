import { useTheme } from "@/src/contexts/theme-context";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

function Dot({ delay, color }: { delay: number; color: string }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
  );
}

export default function ComponentLoading() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.dots}>
          <Dot delay={0} color={c.textMuted} />
          <Dot delay={200} color={c.textMuted} />
          <Dot delay={400} color={c.textMuted} />
        </View>
        <Text style={[styles.label, { color: c.textMuted }]}>Loading</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    minHeight: 60,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 999 },
  label: { fontSize: 13 },
});

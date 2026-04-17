import { useTheme } from "@/src/contexts/theme-context";
import { useEffect } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

interface ImageUploadLoaderProps {
  currentImage: number;
  totalImages: number;
  message?: string;
  visible: boolean;
}

export default function ImageUploadLoader({
  currentImage,
  totalImages,
  message,
  visible,
}: ImageUploadLoaderProps) {
  const { theme } = useTheme();
  const progress = totalImages > 0 ? (currentImage / totalImages) * 100 : 0;
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
      );
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * progress) / 100;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: 24,
      width: 280,
      alignItems: "center",
      gap: 20,
    },
    subtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    spinnerContainer: {
      width: 56,
      height: 56,
      alignItems: "center",
      justifyContent: "center",
    },
    counter: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.text,
    },
    progressWrapper: {
      width: "100%",
      gap: 6,
    },
    progressTrack: {
      height: 6,
      backgroundColor: theme.colors.border,
      borderRadius: 999,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.success,
      borderRadius: 999,
    },
    pctLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    messageBlock: {
      alignItems: "center",
      gap: 4,
    },
    mainMessage: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.text,
      textAlign: "center",
    },
    hint: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
  });

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.subtitle}>Attaching images to ClickUp</Text>

          <View style={styles.spinnerContainer}>
            <Svg width={56} height={56} style={StyleSheet.absoluteFill}>
              <Circle
                cx={28}
                cy={28}
                r={radius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={4}
              />
            </Svg>
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
              <Svg width={56} height={56}>
                <Circle
                  cx={28}
                  cy={28}
                  r={radius}
                  fill="none"
                  stroke="#1D9E75"
                  strokeWidth={4}
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </Svg>
            </Animated.View>
            <Text style={styles.counter}>
              {currentImage}/{totalImages}
            </Text>
          </View>

          <View style={styles.progressWrapper}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progress}%` as any }]}
              />
            </View>
            <Text style={styles.pctLabel}>
              {Math.round(progress)}% complete
            </Text>
          </View>

          <View style={styles.messageBlock}>
            <Text style={styles.mainMessage}>
              {message ?? `Uploading image ${currentImage} of ${totalImages}`}
            </Text>
            <Text style={styles.hint}>Please don't close this window</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

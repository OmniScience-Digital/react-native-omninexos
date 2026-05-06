// components/screens/tabs-screen.tsx
import { cn } from "@/lib/utils";
import { useTheme } from "@/src/contexts/theme-context";
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { Animated, Text, View, ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenProps extends ViewProps {
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
  onScroll?: (...args: any[]) => void;
}

const AccentedBackground = () => {
  const { theme } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", inset: 0, opacity: 0.1 }}
    >
      <LinearGradient
        colors={[theme.colors.primary, "transparent"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.8, y: 6 }}
        style={{
          position: "absolute",
          top: -120,
          right: -60,
          width: 280,
          height: 280,
          borderRadius: 999,
          opacity: 0.2,
          transform: [{ rotate: "25deg" }],
        }}
      />
      <LinearGradient
        colors={["#8B5CF6", "transparent"]}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 1, y: 1 }}
        style={{
          position: "absolute",
          bottom: -140,
          left: -80,
          width: 320,
          height: 320,
          borderRadius: 999,
          opacity: 0.16,
          transform: [{ rotate: "-18deg" }],
        }}
      />
    </View>
  );
};

export function Screen({
  children,
  className,
  scrollable = false,
  onScroll,
  ...props
}: ScreenProps) {
  const { theme } = useTheme();

  const content = (
    <View
      style={{ flex: 1, padding: theme.spacing.sm }}
      className={cn("flex-1", className)}
      {...props}
    >
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={{ flex: 1, backgroundColor: "transparent" }}
      >
        <AccentedBackground />
        {scrollable ? (
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ padding: theme.spacing.sm }}
            className={cn(className)}
          >
            {children}
          </Animated.ScrollView>
        ) : (
          content
        )}
      </SafeAreaView>
    </View>
  );
}

export const ThemedText = ({
  children,
  variant = "body",
  muted,
  weight,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: "h1" | "h2" | "body" | "small";
  muted?: boolean;
  weight?: "300" | "400" | "600" | "700";
  style?: any;
  numberOfLines?: number;
}) => {
  const { theme } = useTheme();
  const size = theme.typography[variant];

  const getFontFamily = () => {
    switch (weight) {
      case "300":
        return "sans-light";
      case "400":
        return "sans-regular";
      case "600":
        return "sans-semibold";
      case "700":
        return "sans-bold";
      default:
        return "sans-regular";
    }
  };

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: size,
          fontFamily: getFontFamily(),
          color: muted ? theme.colors.textMuted : theme.colors.text,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

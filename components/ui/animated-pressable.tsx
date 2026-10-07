// components/ui/animated-pressable.tsx

import { haptics } from "@/lib/haptics";
import { useCallback } from "react";
import {
    Pressable,
    type GestureResponderEvent,
    type PressableProps,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export interface AnimatedPressableProps extends PressableProps {
  /** How much to shrink on press. 0.96 (default) is subtle; lower is punchier. */
  pressedScale?: number;
  /** Haptic fired on press-in. Pass `haptics.action` for a weightier press,
   * or `null` to opt out (e.g. a button already firing its own haptic). */
  haptic?: (() => void) | null;
}

export function AnimatedPressable({
  pressedScale = 0.96,
  haptic = haptics.tap,
  onPressIn,
  onPressOut,
  style,
  children,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      scale.value = withSpring(pressedScale, { damping: 18, stiffness: 300 });
      haptic?.();
      onPressIn?.(e);
    },
    [scale, pressedScale, haptic, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      scale.value = withSpring(1, { damping: 18, stiffness: 300 });
      onPressOut?.(e);
    },
    [scale, onPressOut],
  );

  return (
    <AnimatedPressableBase
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressableBase>
  );
}

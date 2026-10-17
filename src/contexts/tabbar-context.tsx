// src/contexts/tabbar-context.tsx
import React, { createContext, useContext, useRef } from "react";
import { Animated, Platform } from "react-native";

const TabBarContext = createContext<{
  scrollY: Animated.Value;
  onScroll: (...args: any[]) => void;
  resetScrollY: () => void;
} | null>(null);

export const TabBarProvider = ({ children }: { children: React.ReactNode }) => {
  const scrollY = useRef(new Animated.Value(0)).current;

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  const resetScrollY = () => scrollY.setValue(0);

  return (
    <TabBarContext.Provider value={{ scrollY, onScroll, resetScrollY }}>
      {children}
    </TabBarContext.Provider>
  );
};

export const useTabBar = () => {
  const ctx = useContext(TabBarContext);
  if (!ctx) throw new Error("useTabBar must be used inside TabBarProvider");
  return ctx;
};

// Safe version for components that may render outside the tabs (e.g. auth screens)
export const useOptionalTabBar = () => useContext(TabBarContext);

// Distance from the screen bottom to the floating tab bar (shared by the bar
// itself and by screens that need to scroll clear of it)
export const getTabBarBottom = (insetBottom: number, horizontalInset: number) =>
  Math.max(insetBottom, horizontalInset) +
  2 +
  (Platform.OS === "android" ? 12 : 0);

// src/contexts/tabbar-context.tsx
import React, { createContext, useContext, useRef } from "react";
import { Animated } from "react-native";

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

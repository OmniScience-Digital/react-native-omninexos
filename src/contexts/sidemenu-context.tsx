// src/contexts/sidemenu-context.tsx
// Owns the open/closed state and the slide animation of the side menu, and draws the menu above the whole app.
// It is an in-app overlay (not a React Native <Modal>), so it never opens a separate window: that keeps Android's
// immersive navigation bar and the keyboard behaving normally.
import SideMenu from "@/components/ui/SideMenu";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { Animated, BackHandler, Easing, StyleSheet, View } from "react-native";

interface SideMenuContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const noop = () => {};
const SideMenuContext = createContext<SideMenuContextValue>({
  isOpen: false,
  open: noop,
  close: noop,
  toggle: noop,
});

const OPEN_MS = 240;
const CLOSE_MS = 200;

export function SideMenuProvider({ children }: { children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current; // 0 = closed, 1 = fully open
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // the panel stays drawn while it slides closed

  const open = useCallback(() => {
    setMounted(true);
    setIsOpen(true);
    Animated.timing(progress, {
      toValue: 1,
      duration: OPEN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const close = useCallback(() => {
    setIsOpen(false);
    Animated.timing(progress, {
      toValue: 0,
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(
      // `finished` is false if it was re-opened mid-way: then the panel must stay
      ({ finished }) => {
        if (finished) setMounted(false);
      },
    );
  }, [progress]);

  const toggle = useCallback(
    () => (isOpen ? close() : open()),
    [isOpen, open, close],
  );

  // Android back button closes the menu instead of leaving the screen
  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, close]);

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  return (
    <SideMenuContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        {mounted && (
          <SideMenu progress={progress} visible={isOpen} onClose={close} />
        )}
      </View>
    </SideMenuContext.Provider>
  );
}

export const useSideMenu = () => useContext(SideMenuContext);

const styles = StyleSheet.create({ fill: { flex: 1 } });

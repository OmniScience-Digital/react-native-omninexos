// components/ui/ImmersiveModal.tsx
// Drop-in replacement for React Native's <Modal> that keeps Android's immersive mode (hidden navigation bar).
// A modal opens in its own window, and closing it can bring the navigation bar back, so the bar is hidden again when
// the modal opens and shortly after it closes. Same props as <Modal>. On iPhone it behaves exactly like <Modal>.
import * as NavigationBar from "expo-navigation-bar";
import { useEffect, useRef } from "react";
import { Modal, Platform, type ModalProps } from "react-native";

const hideNavigationBar = () => {
  if (Platform.OS !== "android") return;
  NavigationBar.setVisibilityAsync("hidden").catch(() => {});
};

/** Exported so other dialogs (for example Alert.alert callbacks) can re-hide the bar the same way. */
export { hideNavigationBar };

const AFTER_CLOSE_MS = 150; // let Android finish closing the modal window first, or the bar comes straight back

export function ImmersiveModal({ visible, onShow, ...rest }: ModalProps) {
  const wasVisible = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (wasVisible.current && !visible)
      timer = setTimeout(hideNavigationBar, AFTER_CLOSE_MS);
    wasVisible.current = !!visible;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      onShow={(event) => {
        hideNavigationBar();
        onShow?.(event);
      }}
      {...rest}
    />
  );
}

export default ImmersiveModal;

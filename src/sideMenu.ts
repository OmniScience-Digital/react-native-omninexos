// src/sideMenu.ts
// The entries of the side menu. To add a screen to the menu, add one line here.
import type { Href } from "expo-router";
import { Settings, type LucideIcon } from "lucide-react-native";

export interface SideMenuItem {
  key: string;
  title: string;
  icon: LucideIcon;
  /** The screen it opens. */
  route: Href;
}

export const sideMenuItems: SideMenuItem[] = [
  { key: "settings", title: "Settings", icon: Settings, route: "/settings" },
];

/** True when the menu entry's screen is the one currently shown (so it can be highlighted). */
export function isActiveRoute(
  pathname: string | null | undefined,
  route: Href,
): boolean {
  if (!pathname) return false;
  const target =
    typeof route === "string"
      ? route
      : ((route as { pathname?: string }).pathname ?? "");
  if (!target) return false;
  const clean = (p: string) =>
    p.replace(/\/\([^/]+\)/g, "").replace(/\/+$/, "") || "/";
  return clean(pathname) === clean(target);
}

/** "Ayanda Dlamini" -> "AD"; "ayanda@x.co" -> "A"; nothing -> "?". */
export function getInitials(nameOrEmail?: string | null): string {
  const text = (nameOrEmail ?? "").trim();
  if (!text) return "?";
  const base = text.includes("@") ? text.split("@")[0] : text;
  const words = base.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1
      ? words[0].slice(0, 1)
      : words[0].slice(0, 1) + words[words.length - 1].slice(0, 1);
  return letters.toUpperCase();
}

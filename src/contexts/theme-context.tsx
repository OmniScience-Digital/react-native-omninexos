import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type ColorTokens = {
  background: string;
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  border: string;
  shadow: string;
  glass: string;
  // new icon colors
  tabIconActive: string;
  success: string; // for positive trends
  warning: string; // for low stock / urgent
  info: string; // for neutral info
  accent: string; // for decorative highlights
};

type Theme = {
  name: "light" | "dark";
  colors: ColorTokens;
  radius: { md: number; xl: number; pill: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  typography: { h1: number; h2: number; body: number; small: number };
  components: {
    tabBar: {
      height: number;
      horizontalInset: number;
      radius: number;
      iconFrame: number;
      itemPaddingVertical: number;
    };
  };
};

// "system" means follow the OS — no manual override
type Preference = "light" | "dark" | "system";

type ThemeCtx = {
  theme: Theme;
  preference: Preference;
  setPreference: (pref: Preference) => void;
  // Useful for consumers that want to know what's actually active
  // without having to re-derive it (e.g. StatusBar, icons)
  resolvedScheme: "light" | "dark";
  isReady: boolean; // false until AsyncStorage rehydration is done
};

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

// Key used to persist the user's manual preference
const STORAGE_KEY = "themePreference";

// ─────────────────────────────────────────────
// THEME DEFINITIONS
// ─────────────────────────────────────────────
const ACCENT = "#1A1A1A";
const ACCENT_DARK = "#0D0D0D";

const lightTheme: Theme = {
  name: "light",
  colors: {
    background: "#F7F8FB",
    card: "#FFFFFF",
    text: "#111111",
    textMuted: "#555555",
    primary: ACCENT,
    primaryText: "#FFFFFF",
    border: "#E0E0E0",
    shadow: "rgba(17, 17, 17, 0.08)",
    glass: "rgba(255, 255, 255, 0.6)",
    tabIconActive: ACCENT,
    success: "#16A34A",
    warning: "#D97706",
    info: "#0284C7",
    accent: "#3D3D3D",
  },
  radius: { md: 14, xl: 24, pill: 999 },
  spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 },
  typography: { h1: 30, h2: 20, body: 16, small: 13 },
  components: {
    tabBar: {
      height: 72,
      horizontalInset: 20,
      radius: 32,
      iconFrame: 48,
      itemPaddingVertical: 8,
    },
  },
};

const darkTheme: Theme = {
  name: "dark",
  colors: {
    background: "#080808",
    card: "#111111",
    text: "#F0F0F0",
    textMuted: "#737373",
    primary: ACCENT_DARK,
    primaryText: "#FFFFFF",
    border: "#1E1E1E",
    shadow: "rgba(0, 0, 0, 0.65)",
    glass: "rgba(17, 17, 17, 0.9)",
    tabIconActive: ACCENT_DARK,
    success: "#34D399",
    warning: "#FBBF24",
    info: "#60A5FA",
    accent: "#909090",
  },
  radius: { md: 14, xl: 24, pill: 999 },
  spacing: { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 },
  typography: { h1: 30, h2: 20, body: 16, small: 13 },
  components: {
    tabBar: {
      height: 72,
      horizontalInset: 20,
      radius: 32,
      iconFrame: 48,
      itemPaddingVertical: 8,
    },
  },
};
// ─────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────

const ThemeContext = createContext<ThemeCtx>({
  theme: darkTheme,
  preference: "system",
  setPreference: () => {},
  resolvedScheme: "dark",
  isReady: false,
});

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Live OS-level color scheme — updates if user changes device settings
  // while the app is open. Can be null on older Android.
  const systemScheme = useColorScheme() ?? "dark";

  // What the user has explicitly chosen — "system" means no override
  const [preference, setPreferenceState] = useState<Preference>("system");

  // Prevents a flash of wrong theme before AsyncStorage resolves
  const [isReady, setIsReady] = useState(false);

  // ── Rehydrate persisted preference on mount ──
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState((prev) => (prev !== stored ? stored : prev));
        }
        // If nothing stored, we stay on "system" — correct default
      } catch {
        // Storage read failed — silently fall back to "system"
      } finally {
        setIsReady(true);
      }
    };
    load();
  }, []);

  // ── Exposed setter — persists the choice and updates state ──
  const setPreference = async (pref: Preference) => {
    setPreferenceState(pref);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // Persist failed — preference still applies for this session
    }
  };

  // ── Resolve which scheme is actually active ──
  // "system" defers to the OS; explicit choices override it
  const resolvedScheme: "light" | "dark" =
    preference === "system" ? systemScheme : preference;

  const theme = useMemo(
    () => (resolvedScheme === "light" ? lightTheme : darkTheme),
    [resolvedScheme],
  );

  return (
    <ThemeContext.Provider
      value={{ theme, preference, setPreference, resolvedScheme, isReady }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

export const useTheme = () => useContext(ThemeContext);

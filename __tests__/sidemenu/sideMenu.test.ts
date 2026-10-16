// __tests__/sidemenu/sideMenu.test.ts
// The side menu's entries and its small pure helpers.
jest.mock("expo-router", () => ({}));
jest.mock("lucide-react-native", () => ({ Settings: "SettingsIcon" }));

import { getInitials, isActiveRoute, sideMenuItems } from "@/src/sideMenu";
import { tabs } from "@/src/tabs";

describe("side menu entries", () => {
  it("Settings is in the side menu", () => {
    expect(sideMenuItems.map((i) => i.key)).toContain("settings");
    expect(sideMenuItems.find((i) => i.key === "settings")?.route).toBe(
      "/settings",
    );
  });

  it("Settings is no longer a bottom tab, and the other tabs are unchanged", () => {
    expect(tabs.map((t) => t.name)).toEqual([
      "index",
      "forms",
      "ops",
      "alerts",
    ]);
  });

  it("entry keys are unique", () => {
    const keys = sideMenuItems.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("isActiveRoute", () => {
  it("matches the open screen, ignoring route groups and a trailing slash", () => {
    expect(isActiveRoute("/settings", "/settings")).toBe(true);
    expect(isActiveRoute("/(tabs)/settings", "/settings")).toBe(true);
    expect(isActiveRoute("/settings/", "/settings")).toBe(true);
  });
  it("does not match other screens or empty input", () => {
    expect(isActiveRoute("/ops", "/settings")).toBe(false);
    expect(isActiveRoute("/settings-old", "/settings")).toBe(false);
    expect(isActiveRoute(null, "/settings")).toBe(false);
    expect(isActiveRoute(undefined, "/settings")).toBe(false);
  });
});

describe("getInitials", () => {
  it("uses the first and last name, or the start of an email", () => {
    expect(getInitials("Ayanda Dlamini")).toBe("AD");
    expect(getInitials("Ben van der Merwe")).toBe("BM");
    expect(getInitials("cara")).toBe("C");
    expect(getInitials("ayanda.dlamini@x.co")).toBe("AD");
    expect(getInitials("ayanda@x.co")).toBe("A");
  });
  it("never returns an empty string", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
    expect(getInitials(null)).toBe("?");
    expect(getInitials(undefined)).toBe("?");
  });
});

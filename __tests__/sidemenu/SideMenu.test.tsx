// __tests__/sidemenu/SideMenu.test.tsx
// Opens and closes the real side menu and presses its entries. Native pieces are replaced with simple stand-ins.
import { MenuButton } from "@/components/ui/MenuButton";
import { SideMenuProvider } from "@/src/contexts/sidemenu-context";
import { BackHandler, Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  usePathname: () => "/ops",
}));
jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.2.3" }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("lucide-react-native", () => ({
  Settings: "SettingsIcon",
  Menu: "MenuIcon",
  ChevronRight: "ChevronRightIcon",
}));
jest.mock("@/src/contexts/auth-context", () => ({
  useAuth: () => ({
    user: { preferred_username: "Ayanda Dlamini", email: "ayanda@x.co" },
  }),
}));
jest.mock("@/src/contexts/theme-context", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#fff",
        card: "#eee",
        text: "#111",
        textMuted: "#777",
        primary: "#333",
        primaryText: "#fff",
        border: "#ddd",
      },
    },
  }),
}));
jest.mock("@/components/screens/screen", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text>,
  };
});

const findByTestId = (r: ReactTestRenderer, id: string) =>
  r.root.findAll((n: any) => n.props?.testID === id);
const text = (r: ReactTestRenderer) => JSON.stringify(r.toJSON());

async function render() {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <SideMenuProvider>
        <Text>screen content</Text>
        <MenuButton />
      </SideMenuProvider>,
    );
  });
  return r;
}
// Animations run on fake timers, so every step is advanced inside act() and nothing fires after a test ends.
const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });
const pressMenuButton = async (r: ReactTestRenderer) => {
  await act(async () => {
    r.root
      .findAll((n: any) => n.props?.accessibilityLabel === "Open menu")[0]
      .props.onPress();
  });
  await wait(400); // let the slide-in finish
};

beforeEach(() => {
  jest.useFakeTimers();
  mockPush.mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("side menu", () => {
  it("is closed at first, and the button opens it", async () => {
    const r = await render();
    expect(findByTestId(r, "side-menu")).toHaveLength(0);
    await pressMenuButton(r);
    expect(findByTestId(r, "side-menu").length).toBeGreaterThan(0);
    expect(text(r)).toContain("Settings");
  });

  it("shows who is signed in and the app version", async () => {
    const r = await render();
    await pressMenuButton(r);
    const t = text(r);
    expect(t).toContain("Ayanda Dlamini");
    expect(t).toContain("ayanda@x.co");
    expect(t).toContain("AD"); // initials in the avatar
    expect(t).toContain("v1.2.3");
  });

  it("opens Settings from the menu and closes itself", async () => {
    const r = await render();
    await pressMenuButton(r);
    await act(async () => {
      findByTestId(r, "side-menu-item-settings")[0].props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith("/settings");
    await wait(350);
    expect(findByTestId(r, "side-menu")).toHaveLength(0);
  });

  it("closes when the dark area is tapped", async () => {
    const r = await render();
    await pressMenuButton(r);
    await act(async () => {
      findByTestId(r, "side-menu-backdrop")[0].props.onPress();
    });
    await wait(350);
    expect(findByTestId(r, "side-menu")).toHaveLength(0);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("the Android back button closes the menu instead of leaving the screen", async () => {
    const handlers: (() => boolean)[] = [];
    const spy = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_e: any, h: any) => {
        handlers.push(h);
        return { remove: () => handlers.splice(handlers.indexOf(h), 1) } as any;
      });
    const r = await render();
    await pressMenuButton(r);
    expect(handlers).toHaveLength(1);
    let handled = false;
    await act(async () => {
      handled = handlers[0]();
    });
    expect(handled).toBe(true); // the back press was used up by the menu
    await wait(350);
    expect(findByTestId(r, "side-menu")).toHaveLength(0);
    expect(handlers).toHaveLength(0); // listener removed once closed
    spy.mockRestore();
  });

  it("can be opened again after closing", async () => {
    const r = await render();
    await pressMenuButton(r);
    await act(async () => {
      findByTestId(r, "side-menu-backdrop")[0].props.onPress();
    });
    await wait(350);
    await pressMenuButton(r);
    expect(findByTestId(r, "side-menu").length).toBeGreaterThan(0);
  });
});

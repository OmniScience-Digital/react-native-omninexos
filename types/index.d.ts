import { LucideIcon } from "lucide-react-native";

declare global {
  interface AppTab {
    name: string;
    title: string;
    icon: LucideIcon;
  }
  interface AuthFormLayoutProps {
    title: string;
    subtitle: string;
    buttonText: string;
    isLoading: boolean;
    onSubmit: () => void;
    isDisabled?: boolean;
    children: ReactNode;
    footerText: string;
    footerLinkText: string;
    footerLinkHref: Href; // ← changed from string to Href
  }
}

export { };


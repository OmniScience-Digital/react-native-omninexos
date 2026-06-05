import {
  Bell,
  ClipboardList,
  Clock,
  Home,
  Settings,
  Wrench,
} from "lucide-react-native";

export const tabs: AppTab[] = [
  { name: "index", title: "Home", icon: Home },
  { name: "forms", title: "Forms", icon: ClipboardList },
  { name: "ops", title: "Ops", icon: Wrench },
  { name: "attendance", title: "Attendance", icon: Clock },
  { name: "alerts", title: "Alerts", icon: Bell },
  { name: "settings", title: "Settings", icon: Settings },
];

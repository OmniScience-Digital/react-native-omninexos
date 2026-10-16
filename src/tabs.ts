// src/tabs.ts
import {
  Bell,
  ClipboardList,
  Home,
  Wrench
} from "lucide-react-native";

export const tabs: AppTab[] = [
  { name: "index", title: "Home", icon: Home },
  { name: "forms", title: "Forms", icon: ClipboardList },
  { name: "ops", title: "Ops", icon: Wrench },
  // { name: "attendance", title: "Attendance", icon: Clock },
  // { name: "jobcards", title: "Job Cards", icon: ListTodo },
  { name: "alerts", title: "Alerts", icon: Bell },
];

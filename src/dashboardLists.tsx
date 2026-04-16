import { Car, CarFront, ClipboardList, Package } from "lucide-react-native";

export const Tabforms: AppTab[] = [
  {
    name: "Stock Control Form",
    title: "Track inventory, request stock",
    icon: Package,
  },
  {
    name: "Vehicle Inspection Form",
    title: "Perfom an inspection and submit",
    icon: Car,
  },
];

export const TabOperations: AppTab[] = [
  {
    name: "Fleet Management System",
    title: "Manage your fleet",
    icon: CarFront,
  },
  {
    name: "Inventory Management System",
    title: "Manage your inventory",
    icon: ClipboardList,
  },
];

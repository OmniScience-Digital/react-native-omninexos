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
  export interface Component {
    id: string;
    componentId: string;
    componentName: string;
    description?: string;
    primarySupplierId?: string;
    primarySupplier?: string;
    primarySupplierItemCode?: string;
    secondarySupplierId?: string;
    secondarySupplier?: string;
    secondarySupplierItemCode?: string;
    qtyExStock?: number;
    currentStock: number; // required
    minimumStock: number;
    notes?: string;
    history?: string;
    categoryName?: string;
    subcategoryName?: string;
    subcategoryId: string;
    subcategory?: SubCategory;
    subComponents: SubComponent[]; // These are the "Components" in the UI
  }
  interface SubComponent {
    id: string;
    key: string;
    value: string;
    componentId: string;
  }

  interface Category {
    id: string;
    categoryName: string;
    subcategories: SubCategory[];
  }

  interface SubCategory {
    id: string;
    subcategoryName: string;
    categoryId: string;
    category?: Category;
    components: Component[];
  }

  interface ComponentItemProps {
    component: Component;
    selectedCategoryId: string;
    onCategoryChange: (categoryId: string) => void;
    usedKeys: string[];
    onUpdate: (component: Component) => void;
    onRemove: () => void;
    isRemovable: boolean;
    onAddNewKey?: (newKey: string) => void;
    categories?: Category[];
    usedSubcategoryIds?: string[];
    allSubcategories?: any[];
    allComponents?: any[];
  }
  interface Inspection {
    id: string;
    fleetid: string;
    inspectionNo: number | null;
    vehicleVin: string | null;
    inspectionDate: string | null;
    inspectionTime: string | null;
    odometerStart: number | null;
    vehicleReg: string | null;
    inspectorOrDriver: string | null;
    oilAndCoolant: boolean | null;
    fuelLevel: boolean | null;
    seatbeltDoorsMirrors: boolean | null;
    handbrake: boolean | null;
    tyreCondition: boolean | null;
    spareTyre: boolean | null;
    numberPlate: boolean | null;
    licenseDisc: boolean | null;
    leaks: boolean | null;
    lights: boolean | null;
    defrosterAircon: boolean | null;
    emergencyKit: boolean | null;
    clean: boolean | null;
    warnings: boolean | null;
    windscreenWipers: boolean | null;
    serviceBook: boolean | null;
    siteKit: boolean | null;
    photo: string[] | [];
    history: string | null;
  }
  interface vifForm {
    id: string;
    vehicleReg: string;
    vehicleVin: string;
    lastServicedate: Date;
    lastServicekm: Number;
    lastRotationkm: Number;
    fleetNumber: string;
    servicePlanStatus: Boolean;
    servicePlan: string;
    lastRotationdate: Date;
  }

  interface Fleet {
    id: string;
    vehicleVin: string | null;
    vehicleReg: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    transmitionType: string | null;
    ownershipStatus: string | null;
    fleetIndex: string | null;
    fleetNumber: string | null;
    lastServicedate: string | null;
    lastServicekm: number | null;
    lastRotationdate: string | null;
    lastRotationkm: number | null;
    servicePlanStatus: boolean;
    servicePlan: string | null;
    currentDriver: string | null;
    currentkm: number | null;
    codeRequirement: string | null;
    pdpRequirement: boolean;
    breakandLuxTest: string | null;
    serviceplankm: number | null;
    breakandLuxExpirey: string | null;
    liscenseDiscExpirey: string | null;
  }
  interface HistoryEntry {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    timestamp: string;
    updatedBy: string;
    details: string;
  }
}

export { };


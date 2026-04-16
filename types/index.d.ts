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
    currentStock?: number;
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
}

export { };


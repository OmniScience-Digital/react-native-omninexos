// src/state/stockSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface SubComponent {
  id: string;
  key: string;
  value: string;
  componentId: string;
}

export interface ComponentItem {
  id: string;
  componentId: string;
  componentName: string;
  subcategoryId: string;
  categoryName?: string;
  subcategoryName?: string;
  subComponents: SubComponent[];
}

export interface StockState {
  transactionType: boolean;
  components: ComponentItem[];
  selectedCategoryIds: Record<string, string>;
  tempCategories: { id: string; categoryName: string }[]; // was name → categoryName
  tempSubcategories: {
    id: string;
    subcategoryName: string;
    categoryId: string;
  }[]; // was name → subcategoryName
  tempComponents: {
    id: string;
    componentId: string;
    componentName: string;
    subcategoryId: string;
  }[]; // was name → componentId/componentName
}

const makeEmptyComponent = (): ComponentItem => ({
  id: Date.now().toString(),
  componentId: "",
  componentName: "",
  subcategoryId: "",
  subComponents: [
    { id: `${Date.now()}-1`, key: "", value: "", componentId: "" },
  ],
});

const initialState: StockState = {
  transactionType: false,
  components: [makeEmptyComponent()],
  selectedCategoryIds: {},
  tempCategories: [],
  tempSubcategories: [],
  tempComponents: [],
};

export const stockSlice = createSlice({
  name: "stock",
  initialState,
  reducers: {
    setTransactionType: (state, action: PayloadAction<boolean>) => {
      state.transactionType = action.payload;
    },
    addComponent: (state) => {
      state.components = [makeEmptyComponent(), ...state.components];
    },
    removeComponent: (state, action: PayloadAction<string>) => {
      const idx = state.components.findIndex((c) => c.id === action.payload);
      if (idx !== -1) state.components.splice(idx, 1);
      delete state.selectedCategoryIds[action.payload];
    },
    updateComponent: (state, action: PayloadAction<ComponentItem>) => {
      const idx = state.components.findIndex((c) => c.id === action.payload.id);
      if (idx !== -1) state.components[idx] = action.payload;
    },
    setSelectedCategory: (
      state,
      action: PayloadAction<{
        componentId: string;
        categoryId: string;
        categoryName: string;
      }>,
    ) => {
      state.selectedCategoryIds[action.payload.componentId] =
        action.payload.categoryId;
      const comp = state.components.find(
        (c) => c.id === action.payload.componentId,
      );
      if (comp) comp.categoryName = action.payload.categoryName;
    },
    // Temporary additions (UI‑created items not yet persisted)
    addTempCategory: (
      state,
      action: PayloadAction<{ id: string; categoryName: string }>,
    ) => {
      state.tempCategories.push(action.payload);
    },
    addTempSubcategory: (
      state,
      action: PayloadAction<{
        id: string;
        subcategoryName: string;
        categoryId: string;
      }>,
    ) => {
      state.tempSubcategories.push(action.payload);
    },
    addTempComponent: (
      state,
      action: PayloadAction<{
        id: string;
        componentId: string;
        componentName: string;
        subcategoryId: string;
      }>,
    ) => {
      state.tempComponents.push(action.payload);
    },
    resetStockForm: (state) => {
      state.transactionType = false;
      state.components = [makeEmptyComponent()];
      state.selectedCategoryIds = {};
      state.tempCategories = [];
      state.tempSubcategories = [];
      state.tempComponents = [];
    },
  },
});

export const {
  setTransactionType,
  addComponent,
  removeComponent,
  updateComponent,
  setSelectedCategory,
  addTempCategory,
  addTempSubcategory,
  addTempComponent,
  resetStockForm,
} = stockSlice.actions;

export default stockSlice.reducer;

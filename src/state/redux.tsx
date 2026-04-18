// state/redux.tsx
import globalReducer, { showResponseModal } from "@/src/state";
import { api } from "@/src/state/api";
import { combineReducers, configureStore, isRejectedWithValue } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import React from "react";
import { Provider, TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

// ─────────────────────────────────────────────────────────────────────────────
// Root reducer
// ─────────────────────────────────────────────────────────────────────────────

const rootReducer = combineReducers({
  global: globalReducer,
  [api.reducerPath]: api.reducer,
});

// ----- Error middleware
const rtkQueryErrorMiddleware =
  (store: any) => (next: any) => (action: any) => {
    if (isRejectedWithValue(action)) {
      const message =
        action.payload?.error ||
        action.error?.message ||
        "Something went wrong";
      store.dispatch(showResponseModal({ successful: false, message }));
    }
    return next(action);
  };

// ─────────────────────────────────────────────────────────────────────────────
// Store factory  (matches teacher's makeStore pattern)
// ─────────────────────────────────────────────────────────────────────────────

export const makeStore = () => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [
            "api/executeMutation/pending",
            "api/executeMutation/fulfilled",
            "api/executeMutation/rejected",
          ],
          ignoredActionPaths: [
            "meta.baseQueryMeta.request",
            "meta.baseQueryMeta.response",
          ],
          ignoredPaths: [
            "global.vifForm.photos",
            "meta.baseQueryMeta.request",
            "meta.baseQueryMeta.response",
          ],
        },
      }).concat(api.middleware, rtkQueryErrorMiddleware),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

// Typed hooks — use these everywhere instead of plain useDispatch / useSelector
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// ─────────────────────────────────────────────────────────────────────────────
// Provider  (wrap your Expo _layout.tsx with this)
// ─────────────────────────────────────────────────────────────────────────────

// In React Native we don't need the useRef SSR trick — the store is a singleton
const store = makeStore();
setupListeners(store.dispatch);

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Provider store={store}>{children}</Provider>;
}

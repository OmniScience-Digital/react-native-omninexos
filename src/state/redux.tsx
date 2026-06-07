// // state/redux.tsx
// import globalReducer, { showResponseModal } from "@/src/state";
// import { api } from "@/src/state/api";
// import stockReducer from "@/src/state/stockSlice";
// import {
//   combineReducers,
//   configureStore,
//   isRejectedWithValue,
// } from "@reduxjs/toolkit";
// import { setupListeners } from "@reduxjs/toolkit/query";
// import React from "react";
// import {
//   Provider,
//   TypedUseSelectorHook,
//   useDispatch,
//   useSelector,
// } from "react-redux";

// // ─────────────────────────────────────────────────────────────────────────────
// // Root reducer
// // ─────────────────────────────────────────────────────────────────────────────

// const rootReducer = combineReducers({
//   global: globalReducer,
//   stock: stockReducer,
//   [api.reducerPath]: api.reducer,
// });

// // ----- Error middleware
// const rtkQueryErrorMiddleware =
//   (store: any) => (next: any) => (action: any) => {
//     if (isRejectedWithValue(action)) {
//       const message =
//         action.payload?.error ||
//         action.error?.message ||
//         "Something went wrong";
//       store.dispatch(showResponseModal({ successful: false, message }));
//     }
//     return next(action);
//   };

// // ─────────────────────────────────────────────────────────────────────────────
// // Store factory  (matches teacher's makeStore pattern)
// // ─────────────────────────────────────────────────────────────────────────────

// export const makeStore = () => {
//   return configureStore({
//     reducer: rootReducer,
//     middleware: (getDefaultMiddleware) =>
//       getDefaultMiddleware({
//         serializableCheck: {
//           ignoredActions: [
//             "api/executeMutation/pending",
//             "api/executeMutation/fulfilled",
//             "api/executeMutation/rejected",
//           ],
//           ignoredActionPaths: [
//             "meta.baseQueryMeta.request",
//             "meta.baseQueryMeta.response",
//           ],
//           ignoredPaths: [
//             "global.vifForm.photos",
//             "meta.baseQueryMeta.request",
//             "meta.baseQueryMeta.response",
//           ],
//         },
//       }).concat(api.middleware, rtkQueryErrorMiddleware),
//   });
// };

// // ─────────────────────────────────────────────────────────────────────────────
// // Types
// // ─────────────────────────────────────────────────────────────────────────────

// export type AppStore = ReturnType<typeof makeStore>;
// export type RootState = ReturnType<AppStore["getState"]>;
// export type AppDispatch = AppStore["dispatch"];

// // Typed hooks — use these everywhere instead of plain useDispatch / useSelector
// export const useAppDispatch = () => useDispatch<AppDispatch>();
// export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// // ─────────────────────────────────────────────────────────────────────────────
// // Provider  (wrap your Expo _layout.tsx with this)
// // ─────────────────────────────────────────────────────────────────────────────

// // In React Native we don't need the useRef SSR trick — the store is a singleton
// const store = makeStore();
// setupListeners(store.dispatch);

// export default function StoreProvider({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return <Provider store={store}>{children}</Provider>;
// }

// state/redux.tsx
import globalReducer, { showResponseModal } from "@/src/state";
import { api } from "@/src/state/api";
import stockReducer from "@/src/state/stockSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  combineReducers,
  configureStore,
  isRejectedWithValue,
  Middleware,
} from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import React from "react";
import {
  Provider,
  TypedUseSelectorHook,
  useDispatch,
  useSelector,
} from "react-redux";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from "redux-persist";
import { PersistGate } from "redux-persist/integration/react";

// ── Persist config for the API cache ─────────────────────────────────────────
const apiPersistConfig = {
  key: "api",
  storage: AsyncStorage,
  whitelist: ["queries"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Root reducer
// ─────────────────────────────────────────────────────────────────────────────

const rootReducer = combineReducers({
  global: globalReducer,
  stock: stockReducer,
  // Double cast to resolve PersistPartial vs CombinedState mismatch
  [api.reducerPath]: persistReducer(
    apiPersistConfig,
    api.reducer,
  ) as unknown as typeof api.reducer,
});

// ── Network error classifier ──────────────────────────────────────────────────
const NETWORK_ERROR_PATTERNS = [
  "network",
  "Network",
  "fetch",
  "Failed to fetch",
  "Network request failed",
  "offline",
  "timeout",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ERR_INTERNET_DISCONNECTED",
  "Load failed",
  "Could not connect",
];

function isNetworkError(message: string): boolean {
  if (!message) return false;
  return NETWORK_ERROR_PATTERNS.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase()),
  );
}

// ── Error middleware ──────────────────────────────────────────────────────────
const rtkQueryErrorMiddleware: Middleware =
  (store) => (next) => (action: any) => {
    if (isRejectedWithValue(action)) {
      const message: string =
        action.payload?.error ||
        action.payload?.message ||
        action.error?.message ||
        "Something went wrong";

      if (!isNetworkError(message)) {
        store.dispatch(showResponseModal({ successful: false, message }));
      }
    }
    return next(action);
  };

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const makeStore = () => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [
            FLUSH,
            REHYDRATE,
            PAUSE,
            PERSIST,
            PURGE,
            REGISTER,
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

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// ─────────────────────────────────────────────────────────────────────────────
// Singleton store + persistor
// ─────────────────────────────────────────────────────────────────────────────

const store = makeStore();
const persistor = persistStore(store);
setupListeners(store.dispatch);

export { persistor };

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}

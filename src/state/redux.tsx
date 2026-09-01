// state/redux.tsx
import { APP_ENV } from "@/app/env";
import { purgeAllForEnvironmentChange } from "@/services/submissionQueue";
import globalReducer, { showResponseModal } from "@/src/state";
import { api } from "@/src/state/api";
import stockReducer from "@/src/state/stockSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import {
  combineReducers,
  configureStore,
  isRejectedWithValue,
  Middleware,
} from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import React, { useEffect, useState } from "react";
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
  "credentials",
  "getaddrinfo",
  "unable to connect",
  "no internet",
  "connection",
];

function isNetworkError(message: string, payload?: any): boolean {
  if (payload?.status === "FETCH_ERROR") return true;
  if (!message) return false;
  return NETWORK_ERROR_PATTERNS.some((pattern) =>
    message.toLowerCase().includes(pattern.toLowerCase()),
  );
}

// ── Live connectivity flag ─────────────────────────────────────────────────────
let isDeviceOffline = false;
NetInfo.fetch().then((net) => {
  isDeviceOffline = !(
    net.isConnected === true && net.isInternetReachable === true
  );
});
NetInfo.addEventListener((net) => {
  isDeviceOffline = !(
    net.isConnected === true && net.isInternetReachable === true
  );
});

// ── Error middleware ──────────────────────────────────────────────────────────
const rtkQueryErrorMiddleware: Middleware =
  (store) => (next) => (action: any) => {
    if (isRejectedWithValue(action)) {
      const message: string =
        (typeof action.payload === "string" ? action.payload : undefined) ||
        action.payload?.error ||
        action.payload?.message ||
        "Something went wrong";

      if (!isDeviceOffline && !isNetworkError(message, action.payload)) {
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
const persistor = persistStore(store, { manualPersist: true } as any);
setupListeners(store.dispatch);

export { persistor };

// ─────────────────────────────────────────────────────────────────────────────
// Environment guard
// ─────────────────────────────────────────────────────────────────────────────
const ENV_FINGERPRINT_KEY = "amplify:env_fingerprint";

async function purgeCacheIfEnvironmentChanged(): Promise<void> {
  const currentFingerprint = APP_ENV; // "main" or "test"

  try {
    const stored = await AsyncStorage.getItem(ENV_FINGERPRINT_KEY);
    if (stored && stored !== currentFingerprint) {
      const [, discardedCount] = await Promise.all([
        persistor.purge(),
        purgeAllForEnvironmentChange(),
      ]);
      console.log(
        `[EnvGuard] Environment changed (${stored} → ${currentFingerprint}) — cleared cache` +
          (discardedCount
            ? ` and discarded ${discardedCount} offline submission(s).`
            : "."),
      );
      store.dispatch(
        showResponseModal({
          successful: true,
          message:
            "Switched backend environment — local cache" +
            (discardedCount
              ? " and unsynced offline submissions were"
              : " was") +
            " cleared to prevent showing or saving data to the wrong environment.",
        }),
      );
    }
    await AsyncStorage.setItem(ENV_FINGERPRINT_KEY, currentFingerprint);
  } catch {
    // fail open — don't block app startup
  }
}

export default function StoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [envCheckDone, setEnvCheckDone] = useState(false);

  useEffect(() => {
    purgeCacheIfEnvironmentChanged().finally(() => {
      persistor.persist();
      setEnvCheckDone(true);
    });
  }, []);

  if (!envCheckDone) return null;

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  );
}

// src/contexts/auth-context.tsx
import { client } from "@/src/amplify";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import {
  fetchAuthSession,
  fetchUserAttributes,
  signOut,
} from "aws-amplify/auth";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

// ── Persistence keys ──────────────────────────────────────────────────────────
const CACHED_USER_KEY = "auth:cached_user";
const CACHED_PERMISSION_KEY = "auth:cached_permission";

const LIST_PERMISSIONS = /* GraphQL */ `
  query ListPermissions($filter: ModelPermissionFilterInput) {
    listPermissions(filter: $filter) {
      items {
        id
        userId
        permissions
      }
    }
  }
`;

interface Permission {
  username: string;
  email: string;
  name: string;
  isAdmin: boolean;
  permissions: string[];
}

interface AuthContextType {
  user: any | null;
  permission: Permission | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isOfflineAuth: boolean; // true when session restored from cache
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineAuth, setIsOfflineAuth] = useState(false);

  const isAdmin = permission?.isAdmin ?? false;

  // ── Persist auth state so it survives offline restarts ───────────────────
  const persistAuthState = async (u: any, p: Permission) => {
    try {
      await AsyncStorage.multiSet([
        [CACHED_USER_KEY, JSON.stringify(u)],
        [CACHED_PERMISSION_KEY, JSON.stringify(p)],
      ]);
    } catch {}
  };

  const clearPersistedAuthState = async () => {
    try {
      await AsyncStorage.multiRemove([CACHED_USER_KEY, CACHED_PERMISSION_KEY]);
    } catch {}
  };

  const restoreFromCache = async (): Promise<boolean> => {
    try {
      const [[, cachedUser], [, cachedPerm]] = await AsyncStorage.multiGet([
        CACHED_USER_KEY,
        CACHED_PERMISSION_KEY,
      ]);
      if (cachedUser && cachedPerm) {
        setUser(JSON.parse(cachedUser));
        setPermission(JSON.parse(cachedPerm));
        setIsAuthenticated(true);
        setIsOfflineAuth(true);
        return true;
      }
    } catch {}
    return false;
  };

  // ── Full online auth load ─────────────────────────────────────────────────
  const loadAuthState = async () => {
    try {
      const session = await fetchAuthSession();

      if (!session.tokens) {
        // Definitively signed out — clear cache
        await clearPersistedAuthState();
        setUser(null);
        setPermission(null);
        setIsAuthenticated(false);
        setIsOfflineAuth(false);
        return;
      }

      const attributes = await fetchUserAttributes();
      setUser(attributes);
      setIsAuthenticated(true);
      setIsOfflineAuth(false);

      // Fetch permissions
      let userPermissions: string[] = [];
      let adminFlag = false;

      if (attributes.email) {
        try {
          const { data, errors } = (await client.graphql({
            query: LIST_PERMISSIONS,
            variables: { filter: { userId: { eq: attributes.email } } },
            authMode: "apiKey",
          })) as any;

          if (!errors) {
            const items = data?.listPermissions?.items ?? [];
            const permItem = items[0];
            if (permItem?.permissions) {
              userPermissions = (
                permItem.permissions as (string | null)[]
              ).filter((p): p is string => p !== null);
              adminFlag = userPermissions.includes("admin");
            }
          }
        } catch {}
      }

      const perm: Permission = {
        username: attributes.sub || "",
        email: attributes.email || "",
        name: attributes.preferred_username || attributes.name || "",
        isAdmin: adminFlag,
        permissions: userPermissions,
      };

      setPermission(perm);

      // Persist for offline use
      await persistAuthState(attributes, perm);
    } catch (error: any) {
      const msg = error?.message ?? "";
      const isNetworkError =
        msg.includes("Network") ||
        msg.includes("network") ||
        msg.includes("fetch") ||
        msg.includes("offline") ||
        msg.includes("Failed to fetch");

      if (isNetworkError) {
        // Offline — try to restore from cache so user stays logged in
        const restored = await restoreFromCache();
        if (!restored) {
          setUser(null);
          setPermission(null);
          setIsAuthenticated(false);
        }
      } else {
        // Real auth error (token expired, revoked, etc.) — sign out
        await clearPersistedAuthState();
        setUser(null);
        setPermission(null);
        setIsAuthenticated(false);
        setIsOfflineAuth(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuth = async () => {
    setIsLoading(true);
    await loadAuthState();
  };

  // ── On mount: check network first, use cache if offline ──────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const net = await NetInfo.fetch();
      const online =
        net.isConnected === true && net.isInternetReachable !== false;

      if (!online) {
        // Offline on startup — restore cache immediately, skip network call
        const restored = await restoreFromCache();
        if (!restored) {
          // Never logged in before — must go online first
          setUser(null);
          setPermission(null);
          setIsAuthenticated(false);
        }
        if (mounted) setIsLoading(false);
        return;
      }

      // Online — do the full auth check which also refreshes the cache
      await loadAuthState();
    };

    init();
    return () => {
      mounted = false;
    };
  }, []);

  // ── When coming back online after offline auth, refresh silently ─────────
  useEffect(() => {
    if (!isOfflineAuth) return;

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && state.isInternetReachable) {
        // Back online — silently refresh auth without showing loading
        try {
          const session = await fetchAuthSession();
          if (session.tokens) {
            const attributes = await fetchUserAttributes();
            setUser(attributes);
            setIsOfflineAuth(false);

            if (attributes.email) {
              const { data } = (await client.graphql({
                query: LIST_PERMISSIONS,
                variables: { filter: { userId: { eq: attributes.email } } },
                authMode: "apiKey",
              })) as any;

              const items = data?.listPermissions?.items ?? [];
              const permItem = items[0];
              if (permItem?.permissions) {
                const perms = (
                  permItem.permissions as (string | null)[]
                ).filter((p): p is string => p !== null);
                const perm: Permission = {
                  username: attributes.sub || "",
                  email: attributes.email || "",
                  name: attributes.preferred_username || attributes.name || "",
                  isAdmin: perms.includes("admin"),
                  permissions: perms,
                };
                setPermission(perm);
                await persistAuthState(attributes, perm);
              }
            }
          }
        } catch {}
        unsubscribe();
      }
    });

    return () => unsubscribe();
  }, [isOfflineAuth]);

  const logout = async () => {
    try {
      setIsLoading(true);
      await signOut();
      await clearPersistedAuthState();
      setUser(null);
      setPermission(null);
      setIsAuthenticated(false);
      setIsOfflineAuth(false);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permission,
        isAuthenticated,
        isLoading,
        isAdmin,
        isOfflineAuth,
        checkAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

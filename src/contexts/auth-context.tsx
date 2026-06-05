// src/contexts/auth-context.tsx
import { client } from "@/src/amplify";
import {
  fetchAuthSession,
  fetchUserAttributes,
  signOut,
} from "aws-amplify/auth";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

//  Use the standard listPermissions query with a filter
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
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [permission, setPermission] = useState<Permission | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = permission?.isAdmin ?? false;

  const loadAuthState = async () => {
    try {
      const session = await fetchAuthSession();

      if (session.tokens) {
        // 1. Get basic user attributes
        const attributes = await fetchUserAttributes();
        setUser(attributes);
        setIsAuthenticated(true);

        // 2. Fetch permissions via listPermissions with filter on userId
        let userPermissions: string[] = [];
        let adminFlag = false;

        if (attributes.email) {
          try {
            const { data, errors } = (await client.graphql({
              query: LIST_PERMISSIONS,
              variables: {
                filter: { userId: { eq: attributes.email } },
              },
              authMode: "apiKey",
            })) as any;

            if (errors) {
              console.error("GraphQL errors:", errors);
            } else {
              const items = data?.listPermissions?.items ?? [];
              const permItem = items[0];
              if (permItem?.permissions) {
                // permissions is an array of strings (or nulls)
                userPermissions = (
                  permItem.permissions as (string | null)[]
                ).filter((p): p is string => p !== null);
                adminFlag = userPermissions.includes("admin");
              }
            }
          } catch (err) {
            console.error("Failed to fetch permissions:", err);
          }
        }

        // 3. Set permission object (same structure as your web app)
        setPermission({
          username: attributes.sub || "",
          email: attributes.email || "",
          name: attributes.preferred_username || attributes.name || "",
          isAdmin: adminFlag,
          permissions: userPermissions,
        });
      } else {
        // No active session
        setUser(null);
        setPermission(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Auth load error:", error);
      setUser(null);
      setPermission(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuth = async () => {
    setIsLoading(true);
    await loadAuthState();
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await signOut();
      setUser(null);
      setPermission(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      await loadAuthState();
      if (!mounted) return;
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        permission,
        isAuthenticated,
        isLoading,
        isAdmin,
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

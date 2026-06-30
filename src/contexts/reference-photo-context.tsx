// src/contexts/reference-photo-context.tsx
//
// Shared ReferencePhoto context — a single useReferencePhoto instance lives
// here so that every screen (Attendance, Settings, admin photo-request
// screens, etc.) reads the SAME photoUri, approvedRequest, and
// pendingRequest state.
//
// Why this exists: useReferencePhoto() used to be called independently on
// each screen. Each call created its own private React state, so an upload
// on Attendance never propagated to Settings — the avatar there only
// updated after a full app restart remounted the hook. Lifting the hook up
// into a single Provider means there is exactly one photoUri in memory;
// every consumer re-renders the instant it changes, with zero extra network
// calls (no per-screen refetch-on-focus needed).
import { useReferencePhoto } from "@/hooks/useReferencePhoto";
import { useAuth } from "@/src/contexts/auth-context";
import React, { createContext, useContext } from "react";

type ReferencePhotoContextValue = ReturnType<typeof useReferencePhoto>;

const ReferencePhotoContext = createContext<
  ReferencePhotoContextValue | undefined
>(undefined);

export function ReferencePhotoProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const userId = (user as any)?.email ?? (user as any)?.username ?? "anonymous";

  const referencePhoto = useReferencePhoto(userId);

  return (
    <ReferencePhotoContext.Provider value={referencePhoto}>
      {children}
    </ReferencePhotoContext.Provider>
  );
}

export function useReferencePhotoContext(): ReferencePhotoContextValue {
  const ctx = useContext(ReferencePhotoContext);
  if (!ctx) {
    throw new Error(
      "useReferencePhotoContext must be used within ReferencePhotoProvider",
    );
  }
  return ctx;
}

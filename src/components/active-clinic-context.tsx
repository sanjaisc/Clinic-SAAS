"use client";

import { createContext, useContext } from "react";

/**
 * Context for the currently-selected clinic ID.
 * Used by settings sub-pages when a SYSTEM_MANAGER has selected a clinic
 * via the ClinicSelectorBar in the settings layout.
 */
const ActiveClinicContext = createContext<string | null>(null);

export function ActiveClinicProvider({
  clinicId,
  children,
}: {
  clinicId: string | null;
  children: React.ReactNode;
}) {
  return (
    <ActiveClinicContext.Provider value={clinicId}>
      {children}
    </ActiveClinicContext.Provider>
  );
}

/**
 * Returns the effective clinicId for API calls.
 * Falls back to the user's session clinicId.
 */
export function useActiveClinicId(sessionClinicId: string | null): string | null {
  const ctxClinicId = useContext(ActiveClinicContext);
  return ctxClinicId ?? sessionClinicId;
}
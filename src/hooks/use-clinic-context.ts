"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { DoctASessionUser } from "@/lib/auth";
import { STAFF_ROLE } from "@/lib/enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClinicOption {
  id: string;
  name: string;
  slug: string;
  status: string;
  city?: string | null;
}

interface ClinicContextValue {
  /** The effective clinicId to use in API calls (from session or selection). */
  clinicId: string | null;
  /** Whether the user is a SYSTEM_MANAGER who needs to pick a clinic. */
  isSystemManager: boolean;
  /** Whether the clinics list is loading. */
  clinicsLoading: boolean;
  /** All available clinics (populated only for SYSTEM_MANAGER). */
  clinics: ClinicOption[];
  /** The currently selected clinic object (for display). */
  selectedClinic: ClinicOption | null;
  /** Change the selected clinic (no-op for non-SYSTEM_MANAGER). */
  setClinicId: (id: string) => void;
  /** Whether we have a usable clinicId (session-provided or selected). */
  ready: boolean;
}

const STORAGE_KEY = "docta_sysmgr_clinic_id";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClinicContext(): ClinicContextValue {
  const { data: session, status: authStatus } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const isSystemManager = user?.role === STAFF_ROLE.SYSTEM_MANAGER;

  // Session-provided clinicId (CLINIC_ADMIN / CLINIC_RECEPTION)
  const sessionClinicId = user?.clinicId ?? null;

  // SYSTEM_MANAGER selected clinic (always called, only used when isSystemManager)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);

  // Fetch clinics list (no-op when not SYSTEM_MANAGER)
  useEffect(() => {
    if (authStatus !== "authenticated" || !isSystemManager) return;
    let cancelled = false;
    setClinicsLoading(true);

    (async () => {
      try {
        const res = await fetch("/api/staff/admin/clinics?limit=200");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setClinics((json.clinics || []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            name: c.name as string,
            slug: c.slug as string,
            status: c.status as string,
            city: (c.city as string) ?? null,
          })));
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setClinicsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authStatus, isSystemManager]);

  // Restore persisted selection from localStorage (no-op when not SYSTEM_MANAGER)
  useEffect(() => {
    if (!isSystemManager) return;
    if (clinics.length > 0 && !selectedId) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && clinics.some((c) => c.id === stored)) {
        setSelectedId(stored);
      } else if (clinics.length > 0) {
        // Auto-select first PUBLISHED clinic, or first clinic
        const first = clinics.find((c) => c.status === "PUBLISHED") ?? clinics[0];
        if (first) {
          setSelectedId(first.id);
          localStorage.setItem(STORAGE_KEY, first.id);
        }
      }
    }
  }, [clinics, selectedId, isSystemManager]);

  const setClinicId = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  // ---------------------------------------------------------------------------
  // Non-SYSTEM_MANAGER: just use session clinicId
  // ---------------------------------------------------------------------------
  if (!isSystemManager) {
    return {
      clinicId: sessionClinicId,
      isSystemManager: false,
      clinicsLoading: false,
      clinics: [],
      selectedClinic: null,
      setClinicId: () => {},
      ready: !!sessionClinicId,
    };
  }

  const selectedClinic = clinics.find((c) => c.id === selectedId) ?? null;

  return {
    clinicId: selectedId,
    isSystemManager: true,
    clinicsLoading,
    clinics,
    selectedClinic,
    setClinicId,
    ready: !!selectedId,
  };
}
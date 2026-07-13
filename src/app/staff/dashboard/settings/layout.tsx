"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  Building2,
  UserCog,
  Stethoscope,
  DollarSign,
  Clock,
  Mail,
  Users,
} from "lucide-react";
import type { DoctASessionUser } from "@/lib/auth";
import { useClinicContext } from "@/hooks/use-clinic-context";
import { ClinicSelectorBar } from "@/components/clinic-selector-bar";
import { ActiveClinicProvider } from "@/components/active-clinic-context";

// ---- Unsaved Changes Context ----
interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
});

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}

function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChangesState] = useState(false);

  const setHasUnsavedChanges = useCallback((value: boolean) => {
    setHasUnsavedChangesState(value);
  }, []);

  // Set beforeunload handler when there are unsaved changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }
  }, [hasUnsavedChanges]);

  return (
    <UnsavedChangesContext.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

// ---- Settings Tabs ----

const SETTINGS_TABS = [
  { href: "/staff/dashboard/settings/profile", label: "Clinic Profile", icon: Building2 },
  { href: "/staff/dashboard/settings/providers", label: "Providers", icon: UserCog },
  { href: "/staff/dashboard/settings/services", label: "Services & Insurance", icon: Stethoscope },
  { href: "/staff/dashboard/settings/financial", label: "Financial & Policy", icon: DollarSign },
  { href: "/staff/dashboard/settings/hours", label: "Hours & Closures", icon: Clock },
  { href: "/staff/dashboard/settings/communications", label: "Communications", icon: Mail },
  { href: "/staff/dashboard/settings/staff", label: "Staff Onboarding", icon: Users },
];

export default function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const {
    clinicId: effectiveClinicId,
    isSystemManager,
    clinics,
    setClinicId,
    clinicsLoading,
    ready,
  } = useClinicContext();

  // SYSTEM_MANAGER needs to select a clinic first
  if (isSystemManager && !ready) {
    return (
      <div className="space-y-6 animate-in fade-in-0 duration-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Clinic Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a clinic to manage its settings
          </p>
        </div>
        <ClinicSelectorBar
          clinics={clinics}
          selectedId={effectiveClinicId}
          onSelect={setClinicId}
          loading={clinicsLoading}
        />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-3 max-w-md">
            <Building2 className="size-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-muted-foreground">
              {clinicsLoading
                ? "Loading clinics…"
                : clinics.length === 0
                  ? "No clinics available. Please create a clinic first."
                  : "Please select a clinic above to access its settings."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <UnsavedChangesProvider>
      <div className="space-y-0">
        {/* Clinic selector for SYSTEM_MANAGER */}
        {isSystemManager && (
          <ClinicSelectorBar
            clinics={clinics}
            selectedId={effectiveClinicId}
            onSelect={setClinicId}
            loading={clinicsLoading}
          />
        )}

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Clinic Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your clinic profile, providers, services, and policies
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-border mb-6 overflow-x-auto">
          <nav className="flex gap-1 min-w-max" role="tablist">
            <SettingsTabBar />
          </nav>
        </div>

        {/* Tab Content */}
        <ActiveClinicProvider clinicId={effectiveClinicId}>
          <div className="animate-in fade-in-0 duration-200">
            {children}
          </div>
        </ActiveClinicProvider>
      </div>
    </UnsavedChangesProvider>
  );
}

function SettingsTabBar() {
  const pathname = usePathname();
  const { hasUnsavedChanges } = useUnsavedChanges();

  return (
    <>
      {SETTINGS_TABS.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`
              flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
              ${
                isActive
                  ? "border-brand text-brand-hover"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }
            `}
          >
            <Icon className="size-4" />
            {tab.label}
            {isActive && hasUnsavedChanges && (
              <span
                className="size-2 rounded-full bg-amber-500 animate-pulse"
                title="You have unsaved changes"
                aria-label="Unsaved changes"
              />
            )}
          </Link>
        );
      })}
    </>
  );
}
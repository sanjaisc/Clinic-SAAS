"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
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
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;

  // If no clinicId, show message for SYSTEM_MANAGER
  if (!user?.clinicId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3 max-w-md">
          <Building2 className="size-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">
            Clinic-specific settings require a clinic context.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
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
        <nav className="flex gap-1 min-w-max">
          {SETTINGS_TABS.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`
                  flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${
                    isActive
                      ? "border-emerald-500 text-emerald-700"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }
                `}
              >
                <Icon className="size-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in-0 duration-200">
        {children}
      </div>
    </div>
  );
}
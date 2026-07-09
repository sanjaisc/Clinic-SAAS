"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Shield,
  Database,
  Building2,
  UserCog,
  SlidersHorizontal,
  Users,
  CalendarCheck,
  DollarSign,
  BarChart3,
  Server,
  type LucideIcon,
} from "lucide-react";
import type { DoctASessionUser } from "@/lib/auth";

const ADMIN_TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/staff/dashboard/admin/taxonomy", label: "Taxonomy", icon: Database },
  { href: "/staff/dashboard/admin/clinics", label: "Clinics", icon: Building2 },
  { href: "/staff/dashboard/admin/providers", label: "Providers", icon: UserCog },
  { href: "/staff/dashboard/admin/policy", label: "Policy", icon: SlidersHorizontal },
  { href: "/staff/dashboard/admin/users", label: "Users", icon: Users },
  { href: "/staff/dashboard/admin/appointments", label: "Appointments", icon: CalendarCheck },
  { href: "/staff/dashboard/admin/financial", label: "Financial", icon: DollarSign },
  { href: "/staff/dashboard/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/staff/dashboard/admin/infrastructure", label: "Infrastructure", icon: Server },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;

  // Only SYSTEM_MANAGER should see this layout
  if (user?.role !== "SYSTEM_MANAGER") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3 max-w-md">
          <Shield className="size-10 text-red-400 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground">
            System Administration is restricted to System Managers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-purple-600 to-brand">
            <Shield className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              System Administration
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Platform-wide operations, taxonomy, policy, and infrastructure
            </p>
          </div>
        </div>
        <div className="mt-4 h-1 rounded-full bg-gradient-to-r from-purple-500 via-brand to-brand w-48" />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border mb-6 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {ADMIN_TABS.map((tab) => {
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
                      ? "border-purple-500 text-purple-700 dark:text-purple-400"
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
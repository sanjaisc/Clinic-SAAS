"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Building2,
  Users,
  CalendarCheck,
  Star,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  Ban,
  Settings,
  Eye,
  Plus,
  Trash2,
  Activity,
  Database,
  Cpu,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { STAFF_ROLE } from "@/lib/enums";
import { formatDistanceToNow, parseISO } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClinicRow {
  id: string;
  name: string;
  slug: string;
  city: string;
  providerCount: number;
  todayAppts: number;
  weekAppts: number;
  avgRating: number;
}

interface PlatformStats {
  totalClinics: number;
  totalProviders: number;
  totalAppointments: number;
  totalReviews: number;
  avgRating: number;
}

interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  userName: string;
  clinicName: string | null;
}

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: string;
  clinicName: string | null;
  lastLogin: string | null;
}

interface AdminData {
  clinicSummary: ClinicRow[];
  platformStats: PlatformStats;
  recentActivity: AuditEntry[];
  staffList: StaffRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActionIcon(action: string) {
  const a = action.toUpperCase();
  if (a.includes("LOGIN")) return LogIn;
  if (a.includes("LOGOUT")) return LogOut;
  if (a.includes("CANCEL")) return Ban;
  if (a.includes("BLOCK")) return Ban;
  if (a.includes("COMPLETE")) return CheckCircle2;
  if (a.includes("CHECK_IN")) return CheckCircle2;
  if (a.includes("CREATED") || a.includes("GENERATED")) return Plus;
  if (a.includes("SUSPENDED")) return Trash2;
  if (a.includes("UPDATED") || a.includes("CONFIG")) return Settings;
  if (a.includes("REVIEW")) return Star;
  if (a.includes("REFUND")) return Activity;
  if (a.includes("DEPOSIT") || a.includes("PAYMENT")) return CalendarCheck;
  if (a.includes("LOCK")) return LockIcon;
  if (a.includes("WAITLIST")) return Clock;
  return Eye;
}

function LockIcon(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function getActionBorderColor(action: string): string {
  const a = action.toUpperCase();
  if (a.includes("CANCEL") || a.includes("SUSPENDED") || a.includes("REFUND_FAILED") || a.includes("BLOCK"))
    return "border-l-red-400";
  if (a.includes("CREATED") || a.includes("GENERATED") || a.includes("PUBLISHED"))
    return "border-l-emerald-400";
  if (a.includes("COMPLETE") || a.includes("CHECK_IN") || a.includes("REVIEW"))
    return "border-l-sky-400";
  if (a.includes("LOGIN") || a.includes("LOGOUT"))
    return "border-l-purple-400";
  if (a.includes("DEPOSIT") || a.includes("PAYMENT") || a.includes("CAPTURE"))
    return "border-l-teal-400";
  if (a.includes("UPDATED") || a.includes("CONFIG") || a.includes("TEMPLATE"))
    return "border-l-amber-400";
  return "border-l-gray-300";
}

function getActionDescription(entry: AuditEntry): string {
  const a = entry.action.replace(/_/g, " ").toLowerCase();
  const clinic = entry.clinicName ? ` at ${entry.clinicName}` : "";
  return `${a}${clinic}`;
}

function getRoleBadgeClasses(role: string): string {
  switch (role) {
    case STAFF_ROLE.SYSTEM_MANAGER:
      return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800";
    case STAFF_ROLE.CLINIC_ADMIN:
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800";
    default:
      return "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800";
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case STAFF_ROLE.SYSTEM_MANAGER:
      return "Sys Admin";
    case STAFF_ROLE.CLINIC_ADMIN:
      return "Clinic Admin";
    default:
      return "Receptionist";
  }
}

function formatRelativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

// ---------------------------------------------------------------------------
// Skeleton Loaders
// ---------------------------------------------------------------------------

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-48" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Cards
// ---------------------------------------------------------------------------

const STAT_CARDS: {
  key: keyof PlatformStats;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconBg: string;
  format?: (v: number) => string;
}[] = [
  {
    key: "totalClinics",
    label: "Total Clinics",
    icon: Building2,
    gradient: "from-emerald-500 to-emerald-600",
    iconBg: "bg-white/20",
  },
  {
    key: "totalProviders",
    label: "Total Providers",
    icon: Users,
    gradient: "from-blue-500 to-blue-600",
    iconBg: "bg-white/20",
  },
  {
    key: "totalAppointments",
    label: "Total Appointments",
    icon: CalendarCheck,
    gradient: "from-teal-500 to-teal-600",
    iconBg: "bg-white/20",
  },
  {
    key: "totalReviews",
    label: "Total Reviews",
    icon: Star,
    gradient: "from-amber-500 to-amber-600",
    iconBg: "bg-white/20",
  },
  {
    key: "avgRating",
    label: "Avg Rating",
    icon: TrendingUp,
    gradient: "from-purple-500 to-purple-600",
    iconBg: "bg-white/20",
    format: (v: number) => v.toFixed(1),
  },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SystemAdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/admin");
      if (res.status === 403) {
        setError("You do not have permission to view this page.");
        return;
      }
      if (!res.ok) {
        setError("Failed to load admin data. Please try again.");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ---- Error State ----
  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertCircle className="size-10 text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-800 dark:text-red-300">
                Error Loading Data
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {error}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="shrink-0 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40"
            >
              <RefreshCw className="size-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Loading State ----
  if (loading || !data) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <StatsSkeleton />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6">
              <TableSkeleton rows={5} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <TableSkeleton rows={5} />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="p-6">
            <TableSkeleton rows={3} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Loaded State ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-purple-600 to-emerald-500">
              <Shield className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                System Administration
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Cross-clinic platform overview and management
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="hidden sm:flex items-center gap-2"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
        {/* Gradient strip */}
        <div className="mt-4 h-1 rounded-full bg-gradient-to-r from-purple-500 via-emerald-400 to-emerald-500" />
      </div>

      {/* Platform Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAT_CARDS.map((stat) => {
          const Icon = stat.icon;
          const value = data.platformStats[stat.key];
          const display = stat.format ? stat.format(value) : value.toLocaleString();

          return (
            <Card
              key={stat.key}
              className="relative overflow-hidden border-0 shadow-md stat-gradient-animated"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient}`} />
              <CardContent className="relative p-4 flex items-center gap-3">
                <div className={`${stat.iconBg} p-2.5 rounded-xl`}>
                  <Icon className="size-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {display}
                  </p>
                  <p className="text-xs text-white/80 font-medium truncate">
                    {stat.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Clinics Overview + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Clinics Table — wider */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-emerald-600" />
              Clinics Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Clinic
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                      City
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                      Providers
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                      Today
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                      This Week
                    </th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.clinicSummary.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No published clinics found.
                      </td>
                    </tr>
                  ) : (
                    data.clinicSummary.map((clinic, clinicIndex) => (
                      <tr
                        key={clinic.id}
                        className={`border-b border-border/50 transition-all duration-200 ${clinicIndex % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'} hover:bg-muted/50`}
                      >
                        <td className="px-4 py-3">
                          <a
                            href={`/clinic/${clinic.slug}`}
                            className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                          >
                            {clinic.name}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                          {clinic.city}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums">
                          {clinic.providerCount}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums hidden md:table-cell">
                          {clinic.todayAppts}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums hidden md:table-cell">
                          {clinic.weekAppts}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium tabular-nums">
                            <Star className="size-3.5 fill-amber-400 text-amber-400" />
                            {clinic.avgRating > 0 ? clinic.avgRating.toFixed(1) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Platform Activity */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="size-4 text-purple-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
              {data.recentActivity.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No recent activity.
                </div>
              ) : (
                data.recentActivity.slice(0, 10).map((entry, idx) => {
                  const Icon = getActionIcon(entry.action);
                  const borderColor = getActionBorderColor(entry.action);
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-all duration-200 border-l-4 ${borderColor} animate-[slide-in-right_0.3s_ease-out_both]`}
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">
                          <span className="font-medium">{entry.userName}</span>
                          {" — "}
                          {getActionDescription(entry)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatRelativeTime(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Directory + System Health */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Staff Directory */}
        <Card className="xl:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="size-4 text-emerald-600" />
              Staff Directory
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">
                      Email
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Role
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                      Clinic
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">
                      Last Login
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.staffList.map((staff, staffIndex) => (
                    <tr
                      key={staff.id}
                      className={`border-b border-border/50 transition-all duration-200 ${staffIndex % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'} hover:bg-muted/50`}
                    >
                      <td className="px-4 py-2.5 font-medium">{staff.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                        {staff.email}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={`text-[11px] px-2 py-0 ${getRoleBadgeClasses(staff.role)}`}
                        >
                          {getRoleLabel(staff.role)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                        {staff.clinicName ?? (
                          <span className="text-purple-600 dark:text-purple-400 font-medium">
                            Platform
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs hidden lg:table-cell">
                        {staff.lastLogin
                          ? formatRelativeTime(staff.lastLogin)
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cpu className="size-4 text-emerald-600" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <HealthItem
              icon={<Database className="size-4 text-emerald-600" />}
              label="Database"
              value="Connected"
              ok
            />
            <HealthItem
              icon={<Cpu className="size-4 text-emerald-600" />}
              label="Cache"
              value="Active"
              ok
            />
            <HealthItem
              icon={<Shield className="size-4 text-emerald-600" />}
              label="Platform"
              value="v1.0.0 MVP"
              ok
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function HealthItem({
  icon,
  label,
  value,
  ok,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1.5">
          {ok && <span className="relative flex items-center justify-center"><CheckCircle2 className="size-3 text-emerald-500 pulse-ring" /></span>}
          <p className="text-sm font-medium text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}
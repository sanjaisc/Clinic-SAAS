"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  TrendingUp,
  XCircle,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  Star,
  Users,
  Activity,
  CheckCircle2,
  CalendarRange,
  DollarSign,
  UserX,
  Loader2,
  Building2,
  Search,
  Eye,
  MousePointerClick,
  ShoppingCart,
  ThumbsUp,
  ArrowRight,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
} from "recharts";
import type { DoctASessionUser } from "@/lib/auth";
import { useClinicContext } from "@/hooks/use-clinic-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Period = "today" | "7d" | "30d" | "90d" | "custom";

interface DailyTrend {
  date: string;
  booked: number;
  checkedIn: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

interface ModalityData {
  inPerson: number;
  video: number;
  total: number;
}

interface ProviderPerf {
  name: string;
  clinicName?: string;
  city?: string;
  zipCode?: string;
  total: number;
  completed: number;
  cancelled: number;
  noShowRate: number;
  avgRating: number;
}

interface SummaryStats {
  totalAppointments: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  avgDaily: number;
}

interface NoShowByDay {
  day: string;
  count: number;
}

interface DepositCapture {
  date: string;
  amountCents: number;
  count: number;
}

interface AnalyticsData {
  period: { start: string; end: string };
  dailyTrends: DailyTrend[];
  modality: ModalityData;
  providerPerformance: ProviderPerf[];
  summary: SummaryStats;
  busiestDay: string;
  busiestHour: string;
  noShowByDay: NoShowByDay[];
  depositCapture: DepositCapture[];
  revenue?: RevenueData;
  slotUtilization?: SlotUtilization;
  cancellationReasons?: CancellationReasons;
  waitlist?: WaitlistData;
  demographics?: DemographicsData;
  conversionFunnel?: ConversionData;
}

interface PaymentMethodBreakdown {
  stripe: { count: number; amount: number };
  cashAtDesk: { count: number; amount: number };
  manualWaiver: { count: number; amount: number };
}

interface RevenueData {
  totalCaptured: number;
  totalAuthorized: number;
  totalRefunded: number;
  totalForfeited: number;
  byPaymentMethod: PaymentMethodBreakdown;
  avgPerAppointment: number;
  dailyRevenue: Array<{ date: string; amount: number }>;
}

interface SlotUtilization {
  total: number;
  available: number;
  booked: number;
  blocked: number;
  closed: number;
  utilizationRate: number;
}

interface CancellationReasons {
  patientCancelled: number;
  clinicCancelled: number;
  doubleBooking: number;
  unknown: number;
  totalCancelled: number;
}

interface WaitlistData {
  active: number;
  offered: number;
  fulfilled: number;
  expired: number;
  removed: number;
  total: number;
  fulfillmentRate: number;
  dailyVolume: Array<{ date: string; count: number }>;
}

interface DemographicsData {
  adult: number;
  pediatric: number;
  total: number;
  ageGroups: Array<{ group: string; count: number }>;
}

interface ConversionData {
  funnel: {
    totalSearches: number;
    clinicViews: number;
    bookingStarts: number;
    bookingCompletes: number;
  };
  conversionRates: {
    searchToClinicView: number;
    clinicViewToBookingStart: number;
    bookingStartToComplete: number;
    searchToBooking: number;
  };
  recommendationAcceptRate: number;
  uniqueSessions: {
    searches: number;
    clinicViews: number;
    bookingStarts: number;
    bookingCompletes: number;
  };
}

interface ClinicComparison {
  clinicId: string;
  clinicName: string;
  city: string;
  zipCode: string;
  appointments: number;
  completed: number;
  noShows: number;
  revenue: number;
  rating: number;
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const COLORS = {
  completed: "#10b981",
  checkedIn: "#14b8a6",
  cancelled: "#f87171",
  noShow: "#fbbf24",
  inPerson: "#10b981",
  video: "#0d9488",
  noShowBar: "#f59e0b",
  deposit: "#059669",
};

// ---------------------------------------------------------------------------
// Format cents to dollars
// ---------------------------------------------------------------------------
function fmtCents(cents: number): string {
  const abs = Math.abs(cents);
  const formatted = `$${(abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return cents < 0 ? `-${formatted}` : formatted;
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  iconBg,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className={`absolute inset-x-0 top-0 h-1 ${gradient}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div
            className={`size-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
          >
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip for Area Chart
// ---------------------------------------------------------------------------
function AreaTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const labelMap: Record<string, string> = {
    completed: "Completed",
    checkedIn: "Checked In",
    cancelled: "Cancelled",
    noShow: "No Show",
    booked: "Booked",
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background p-3 shadow-lg text-xs space-y-1.5">
      <p className="font-semibold text-foreground">
        {label ? format(parseISO(label), "MMM d, yyyy") : ""}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {labelMap[entry.dataKey] ?? entry.dataKey}
          </span>
          <span className="ml-auto font-medium text-foreground">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pie chart label renderer for center text
// ---------------------------------------------------------------------------
function PieCenterLabel({
  cx,
  cy,
  viewBox,
  total,
}: {
  cx: number;
  cy: number;
  viewBox?: { width: number; height: number };
  total: number;
}) {
  if (!viewBox) return null;

  return (
    <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central">
      <tspan
        className="fill-foreground"
        style={{ fontSize: "20px", fontWeight: 700 }}
      >
        {total}
      </tspan>
      <tspan
        className="fill-muted-foreground"
        x={cx}
        y={cy + 14}
        style={{ fontSize: "10px" }}
      >
        total
      </tspan>
    </text>
  );
}

// ---------------------------------------------------------------------------
// No-Show Bar Chart Tooltip
// ---------------------------------------------------------------------------
function NoShowTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">
        No-shows:{" "}
        <span className="font-medium text-foreground">{payload[0].value}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deposit Bar Chart Tooltip
// ---------------------------------------------------------------------------
function DepositTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: { amount: number; count: number; amountCents: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border/60 bg-background p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground">
        {label ? format(parseISO(label), "MMM d, yyyy") : ""}
      </p>
      <p className="text-muted-foreground">
        Amount:{" "}
        <span className="font-medium text-foreground">
          ${d.amount.toFixed(2)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Transactions:{" "}
        <span className="font-medium text-foreground">{d.count}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Period button group with Custom date range
// ---------------------------------------------------------------------------
function PeriodSelector({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomRange,
}: {
  value: Period;
  onChange: (p: Period) => void;
  customFrom: Date | undefined;
  customTo: Date | undefined;
  onCustomRange: (from: Date | undefined, to: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Date | undefined>(customFrom);
  const [to, setTo] = useState<Date | undefined>(customTo);
  const applyRef = useRef<HTMLButtonElement>(null);

  const options: { label: string; value: Period }[] = [
    { label: "Today", value: "today" },
    { label: "7 Days", value: "7d" },
    { label: "30 Days", value: "30d" },
    { label: "90 Days", value: "90d" },
    { label: "Custom", value: "custom" },
  ];

  function handleApply() {
    if (from && to) {
      onCustomRange(from, to);
    }
    setOpen(false);
  }

  function handleClear() {
    setFrom(undefined);
    setTo(undefined);
    onCustomRange(undefined, undefined);
    onChange("30d");
    setOpen(false);
  }

  const customLabel =
    customFrom && customTo
      ? `${format(customFrom, "MMM d")} – ${format(customTo, "MMM d, yyyy")}`
      : "";

  return (
    <div className="flex items-center gap-3">
      <div className="inline-flex items-center rounded-xl bg-muted/60 p-1 gap-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              if (opt.value !== "custom") {
                onChange(opt.value);
              } else {
                setOpen(true);
              }
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
              opt.value === "custom" && value === "custom"
                ? "bg-amber-500 text-white shadow-sm shadow-amber-500/25"
                : value === opt.value
                  ? "bg-brand text-white shadow-sm shadow-brand/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Custom range label */}
      {value === "custom" && customLabel && (
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <CalendarRange className="size-3.5" />
          {customLabel}
        </span>
      )}

      {/* Custom date range popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span className="sr-only">Pick date range</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="end">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Custom Date Range
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">From</p>
                <Calendar
                  mode="single"
                  selected={from}
                  onSelect={setFrom}
                  className="rounded-md border"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">To</p>
                <Calendar
                  mode="single"
                  selected={to}
                  onSelect={setTo}
                  disabled={(date) => (from ? date < from : false)}
                  className="rounded-md border"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs cursor-pointer"
                onClick={handleClear}
              >
                Clear
              </Button>
              <Button
                ref={applyRef}
                size="sm"
                className="text-xs bg-brand hover:bg-brand-hover cursor-pointer"
                disabled={!from || !to}
                onClick={handleApply}
              >
                Apply Range
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const {
    clinicId: effectiveClinicId,
    isSystemManager,
    clinics,
    setClinicId,
    clinicsLoading,
    ready: clinicReady,
  } = useClinicContext();

  const [period, setPeriod] = useState<Period>("30d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ClinicComparison[] | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [compSearch, setCompSearch] = useState("");
  const [compSort, setCompSort] = useState<{ col: string; dir: "asc" | "desc" }>({
    col: "appointments",
    dir: "desc",
  });
  const [compPage, setCompPage] = useState(0);

  const COMP_PAGE_SIZE = 10;

  const filteredComparison = useMemo(() => {
    if (!comparison) return [];
    let list = comparison.filter(
      (c) =>
        c.clinicName.toLowerCase().includes(compSearch.toLowerCase()) ||
        c.city.toLowerCase().includes(compSearch.toLowerCase())
    );
    list.sort((a, b) => {
      const mul = compSort.dir === "asc" ? 1 : -1;
      switch (compSort.col) {
        case "clinicName":
          return mul * a.clinicName.localeCompare(b.clinicName);
        case "appointments":
          return mul * (a.appointments - b.appointments);
        case "completed":
          return mul * (a.completed - b.completed);
        case "noShows":
          return mul * (a.noShows - b.noShows);
        case "revenue":
          return mul * (a.revenue - b.revenue);
        case "rating":
          return mul * (a.rating - b.rating);
        default:
          return 0;
      }
    });
    return list;
  }, [comparison, compSearch, compSort]);

  const paginatedComparison = filteredComparison.slice(
    compPage * COMP_PAGE_SIZE,
    (compPage + 1) * COMP_PAGE_SIZE
  );
  const compTotalPages = Math.max(1, Math.ceil(filteredComparison.length / COMP_PAGE_SIZE));

  // Provider performance filter/sort
  const [providerSearch, setProviderSearch] = useState("");
  const [providerSort, setProviderSort] = useState<{ col: string; dir: "asc" | "desc" }>({
    col: "total",
    dir: "desc",
  });
  const [providerPage, setProviderPage] = useState(0);

  const filteredProviders = useMemo(() => {
    if (!data) return [];
    let list = data.providerPerformance.filter(
      (p) =>
        p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
        (p.clinicName ?? "").toLowerCase().includes(providerSearch.toLowerCase()) ||
        (p.city ?? "").toLowerCase().includes(providerSearch.toLowerCase())
    );
    list.sort((a, b) => {
      const mul = providerSort.dir === "asc" ? 1 : -1;
      switch (providerSort.col) {
        case "name":
          return mul * a.name.localeCompare(b.name);
        case "clinicName":
          return mul * (a.clinicName ?? "").localeCompare(b.clinicName ?? "");
        case "total":
          return mul * (a.total - b.total);
        case "completed":
          return mul * (a.completed - b.completed);
        case "cancelled":
          return mul * (a.cancelled - b.cancelled);
        case "noShowRate":
          return mul * (a.noShowRate - b.noShowRate);
        case "avgRating":
          return mul * (a.avgRating - b.avgRating);
        default:
          return 0;
      }
    });
    return list;
  }, [data, providerSearch, providerSort]);

  const paginatedProviders = filteredProviders.slice(
    providerPage * COMP_PAGE_SIZE,
    (providerPage + 1) * COMP_PAGE_SIZE
  );
  const providerTotalPages = Math.max(1, Math.ceil(filteredProviders.length / COMP_PAGE_SIZE));

  const queryClinicId = viewAll ? "__all" : effectiveClinicId;

  const fetchAnalytics = useCallback(
    async (p: Period, from?: Date, to?: Date) => {
      if (!queryClinicId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (from && to) {
          params.set("dateFrom", format(from, "yyyy-MM-dd"));
          params.set("dateTo", format(to, "yyyy-MM-dd"));
        } else {
          params.set("period", p);
        }
        params.set("clinicId", queryClinicId);
        const res = await fetch(`/api/staff/analytics?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }

      if (isSystemManager) {
        setComparisonLoading(true);
        try {
          const compParams = new URLSearchParams();
          if (from && to) {
            compParams.set("dateFrom", format(from, "yyyy-MM-dd"));
            compParams.set("dateTo", format(to, "yyyy-MM-dd"));
          } else {
            compParams.set("period", p === "today" ? "TODAY" : p.toUpperCase());
          }
          const compRes = await fetch(`/api/staff/admin/analytics?${compParams.toString()}`);
          if (compRes.ok) {
            const compJson = await compRes.json();
            setComparison(compJson.clinicBreakdown ?? null);
          }
        } catch {
          // non-critical
        } finally {
          setComparisonLoading(false);
        }
      }
    },
    [queryClinicId, isSystemManager]
  );

  useEffect(() => {
    if (status === "authenticated") {
      fetchAnalytics(period, customFrom, customTo);
    }
  }, [status, period, customFrom, customTo, fetchAnalytics]);

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    setCustomFrom(undefined);
    setCustomTo(undefined);
  }

  function handleCustomRange(from: Date | undefined, to: Date | undefined) {
    if (from && to) {
      setCustomFrom(from);
      setCustomTo(to);
      setPeriod("custom");
    }
  }

  // Period range label
  const dateRange =
    data?.period.start && data?.period.end
      ? `${format(parseISO(data.period.start), "MMM d")} – ${format(parseISO(data.period.end), "MMM d, yyyy")}`
      : "";

  // Modality pie data
  const modalityPieData = data
    ? [
        { name: "In-Person", value: data.modality.inPerson, color: COLORS.inPerson },
        { name: "Video", value: data.modality.video, color: COLORS.video },
      ].filter((d) => d.value > 0)
    : [];

  // Deposit chart data (convert cents to dollars)
  const depositChartData =
    data?.depositCapture.map((d) => ({
      ...d,
      amount: d.amountCents / 100,
    })) ?? [];

  function exportProviderCSV() {
    if (!data) return;
    const cols = ["Provider", "Clinic", "City", "Zip", "Total", "Completed", "Cancelled", "No-Show Rate", "Rating"];
    const rows = [cols];
    for (const p of data.providerPerformance) {
      rows.push([
        p.name,
        p.clinicName ?? "",
        p.city ?? "",
        p.zipCode ?? "",
        String(p.total),
        String(p.completed),
        String(p.cancelled),
        `${p.noShowRate}%`,
        String(p.avgRating),
      ]);
    }
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `provider-performance-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportComparisonCSV() {
    if (!comparison) return;
    const rows = [["Clinic", "City", "Zip", "Appointments", "Completed", "No-Shows", "Revenue", "Rating"]];
    for (const c of comparison) {
      rows.push([
        c.clinicName,
        c.city,
        c.zipCode,
        String(c.appointments),
        String(c.completed),
        String(c.noShows),
        fmtCents(c.revenue),
        String(c.rating),
      ]);
    }
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cross-clinic-comparison-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // -------------------------------------
  // Loading skeleton
  // -------------------------------------
  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-9 w-80 rounded-xl" />
        </div>
        <Skeleton className="h-4 w-48" />
        {/* Full width chart skeleton */}
        <Skeleton className="h-[340px] rounded-xl" />
        {/* 2-column chart skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[360px] rounded-xl" />
          <Skeleton className="h-[360px] rounded-xl" />
        </div>
        {/* Full width chart skeleton */}
        <Skeleton className="h-[320px] rounded-xl" />
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        {/* Provider table skeleton */}
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  // -------------------------------------
  // Error state
  // -------------------------------------
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/20">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="size-8 text-red-400 mb-3" />
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            Failed to load analytics
          </p>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 cursor-pointer"
            onClick={() => fetchAnalytics(period, customFrom, customTo)}
          >
            <RefreshCw className="size-3.5 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data && !loading) return null;
  if (!data) {
    return (
      <div className="space-y-6 animate-in fade-in-0 duration-300">
        <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin size-8 text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      {/* Clinic selector for SYSTEM_MANAGER */}
      {isSystemManager && (
        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl border border-purple-200/60 bg-purple-50/50 dark:bg-purple-950/10">
          <Building2 className="size-4 text-purple-600 shrink-0" />
          <span className="text-sm font-medium text-purple-800 dark:text-purple-300 whitespace-nowrap">
            Acting as clinic:
          </span>
          <Select value={viewAll ? "__all" : (effectiveClinicId ?? "")} onValueChange={(v) => {
            if (v === "__all") { setViewAll(true); }
            else { setViewAll(false); setClinicId(v); }
          }}>
            <SelectTrigger className="w-auto min-w-[200px] max-w-xs h-8 text-sm bg-white dark:bg-background border-purple-200 dark:border-purple-800">
              <SelectValue placeholder="Select a clinic…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">
                <div className="flex items-center gap-2">
                  <span className="font-medium">All Clinics</span>
                </div>
              </SelectItem>
              {clinics.map((clinic) => (
                <SelectItem key={clinic.id} value={clinic.id}>
                  <div className="flex items-center gap-2">
                    <span className="truncate">{clinic.name}</span>
                    {clinic.city && (
                      <span className="text-muted-foreground text-xs hidden sm:inline">
                        — {clinic.city}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Platform Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <BarChart3 className="size-3.5" />
            {dateRange}
          </p>
        </div>
        <PeriodSelector
          value={period}
          onChange={handlePeriodChange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomRange={handleCustomRange}
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Summary stat cards                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Appointments"
          value={data.summary.totalAppointments}
          subtitle={`${data.summary.avgDaily} per day average`}
          icon={CalendarDays}
          gradient="bg-gradient-to-r from-brand to-lavender"
          iconBg="bg-brand-subtle  text-brand"
        />
        <StatCard
          title="Completion Rate"
          value={`${data.summary.completionRate}%`}
          subtitle={`${data.dailyTrends.reduce((s, d) => s + d.completed, 0)} completed`}
          icon={CheckCircle2}
          gradient="bg-gradient-to-r from-brand to-green-500"
          iconBg="bg-brand-subtle  text-brand"
        />
        <StatCard
          title="Cancellation Rate"
          value={`${data.summary.cancellationRate}%`}
          subtitle={`${data.dailyTrends.reduce((s, d) => s + d.cancelled, 0)} cancelled`}
          icon={XCircle}
          gradient="bg-gradient-to-r from-red-400 to-rose-400"
          iconBg="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
        />
        <StatCard
          title="Avg Daily"
          value={data.summary.avgDaily}
          subtitle={`${data.busiestDay} is busiest`}
          icon={TrendingUp}
          gradient="bg-gradient-to-r from-amber-500 to-orange-500"
          iconBg="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Revenue Dashboard                                                */}
      {/* ---------------------------------------------------------------- */}
      {data.revenue && (
        <>
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-brand-subtle flex items-center justify-center">
                  <DollarSign className="size-4 text-brand" />
                </div>
                <div>
                  <CardTitle className="text-base">Revenue Dashboard</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Financial summary for the selected period
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* KPI row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Captured"
                  value={fmtCents(data.revenue.totalCaptured)}
                  subtitle={`${data.revenue.avgPerAppointment > 0 ? `${fmtCents(data.revenue.avgPerAppointment)} avg/appt` : "No completed appointments"}`}
                  icon={DollarSign}
                  gradient="bg-gradient-to-r from-emerald-500 to-teal-500"
                  iconBg="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                />
                <StatCard
                  title="Net Revenue"
                  value={fmtCents(data.revenue.totalCaptured - data.revenue.totalRefunded)}
                  subtitle="After refunds"
                  icon={TrendingUp}
                  gradient="bg-gradient-to-r from-blue-500 to-cyan-500"
                  iconBg="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                />
                <StatCard
                  title="Authorized"
                  value={fmtCents(data.revenue.totalAuthorized)}
                  subtitle="Pending deposits"
                  icon={Activity}
                  gradient="bg-gradient-to-r from-purple-500 to-violet-500"
                  iconBg="bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400"
                />
                <StatCard
                  title="Refunded"
                  value={fmtCents(data.revenue.totalRefunded)}
                  subtitle={`${fmtCents(data.revenue.totalForfeited)} forfeited`}
                  icon={XCircle}
                  gradient="bg-gradient-to-r from-orange-500 to-red-500"
                  iconBg="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                />
              </div>

              {/* Daily Revenue Trend bar chart */}
              {data.revenue.dailyRevenue.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">
                    Daily Revenue Trend
                  </p>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.revenue.dailyRevenue}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          opacity={0.4}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(v: string) =>
                            v ? format(parseISO(v), "MMM d") : ""
                          }
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) =>
                            v >= 10000 ? `$${(v / 100).toFixed(0)}` : `$${(v / 100).toFixed(0)}`
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "1px solid hsl(var(--border))",
                            fontSize: "12px",
                          }}
                          formatter={(value: number) => [
                            fmtCents(value),
                            "Revenue",
                          ]}
                          labelFormatter={(label: string) =>
                            label
                              ? format(parseISO(label), "MMM d, yyyy")
                              : ""
                          }
                        />
                        <Bar
                          dataKey="amount"
                          fill="#059669"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Payment method breakdown */}
              <div>
                <p className="text-sm font-medium text-foreground mb-3">
                  Collection Method
                </p>
                <div className="space-y-2">
                  {[
                    {
                      label: "Stripe",
                      key: "stripe" as const,
                      color: "bg-brand",
                    },
                    {
                      label: "Cash at Desk",
                      key: "cashAtDesk" as const,
                      color: "bg-amber-500",
                    },
                    {
                      label: "Manual Waiver",
                      key: "manualWaiver" as const,
                      color: "bg-slate-400",
                    },
                  ].map((method) => {
                    const m = data.revenue.byPaymentMethod[method.key];
                    const total = Object.values(
                      data.revenue.byPaymentMethod
                    ).reduce((s, v) => s + v.count, 0);
                    const pct = total > 0 ? (m.count / total) * 100 : 0;
                    return (
                      <div key={method.key} className="flex items-center gap-3">
                        <span className="text-xs font-medium w-28 text-right text-muted-foreground">
                          {method.label}
                        </span>
                        <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden relative">
                          <div
                            className={`h-full ${method.color} rounded-md transition-all duration-300 flex items-center px-2`}
                            style={{
                              width: `${Math.max(pct, m.count > 0 ? 8 : 0)}%`,
                            }}
                          >
                            {pct > 20 && (
                              <span className="text-[10px] font-semibold text-white">
                                {m.count} ({Math.round(pct)}%)
                              </span>
                            )}
                          </div>
                          {pct <= 20 && m.count > 0 && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
                              {m.count} ({Math.round(pct)}%)
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold tabular-nums w-20 text-foreground">
                          {fmtCents(m.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Row 1: Appointment Volume — Full Width Area Chart                  */}
      {/* ---------------------------------------------------------------- */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-brand-subtle flex items-center justify-center">
              <Activity className="size-4 text-brand" />
            </div>
            <div>
              <CardTitle className="text-base">Appointment Volume</CardTitle>
              <p className="text-xs text-muted-foreground">
                Daily breakdown by status
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.dailyTrends}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.completed} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.completed} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCheckedIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.checkedIn} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.checkedIn} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCancelled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.cancelled} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.cancelled} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gNoShow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.noShow} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.noShow} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => format(parseISO(v), "MMM dd")}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<AreaTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stackId="1"
                  stroke={COLORS.completed}
                  fill="url(#gCompleted)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="checkedIn"
                  stackId="1"
                  stroke={COLORS.checkedIn}
                  fill="url(#gCheckedIn)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="cancelled"
                  stackId="1"
                  stroke={COLORS.cancelled}
                  fill="url(#gCancelled)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="noShow"
                  stackId="1"
                  stroke={COLORS.noShow}
                  fill="url(#gNoShow)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Row 2: Telehealth Pie (left) + No-Show Distribution (right)       */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Telehealth vs In-Person Pie */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-brand-subtle flex items-center justify-center">
                <Users className="size-4 text-brand" />
              </div>
              <div>
                <CardTitle className="text-base">Telehealth vs In-Person</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Appointment modality split
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {modalityPieData.length > 0 ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modalityPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {modalityPieData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <PieCenterLabel
                      cx={0.5}
                      cy={0.5}
                      viewBox={{ width: 200, height: 200 }}
                      total={data.modality.total}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid hsl(var(--border))",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      formatter={(value: number) => [`${value}`, "Appointments"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  No appointments in this period
                </p>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: COLORS.inPerson }}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  In-Person
                </span>
                <span className="text-xs font-bold text-foreground">
                  {data.modality.inPerson}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: COLORS.video }}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  Video
                </span>
                <span className="text-xs font-bold text-foreground">
                  {data.modality.video}
                </span>
              </div>
            </div>

            {/* Busiest info */}
            <div className="w-full grid grid-cols-2 gap-3 mt-2">
              <div className="rounded-xl bg-muted/50 dark:bg-muted/20 p-3 text-center">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-1">
                  Busiest Day
                </p>
                <p className="text-sm font-bold text-foreground">
                  {data.busiestDay}
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 dark:bg-muted/20 p-3 text-center">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-1">
                  Busiest Hour
                </p>
                <p className="text-sm font-bold text-foreground">
                  {data.busiestHour}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* No-Show Distribution Bar Chart */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <UserX className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">No-Show Distribution</CardTitle>
                <p className="text-xs text-muted-foreground">
                  No-show counts by day of week
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.noShowByDay}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.4}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<NoShowTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill={COLORS.noShowBar}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  >
                    <LabelList
                      dataKey="count"
                      position="top"
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        fill: "hsl(var(--foreground))",
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* ---------------------------------------------------------------- */}
      {/* Slot Utilization                                                 */}
      {/* ---------------------------------------------------------------- */}
      {data.slotUtilization && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-brand-subtle flex items-center justify-center">
                <CalendarDays className="size-4 text-brand" />
              </div>
              <div>
                <CardTitle className="text-base">Slot Utilization</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Time-slot occupancy for the selected period
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              <StatCard
                title="Utilization"
                value={`${data.slotUtilization.utilizationRate}%`}
                subtitle={`${data.slotUtilization.booked} of ${data.slotUtilization.total - data.slotUtilization.blocked - data.slotUtilization.closed} usable slots`}
                icon={Activity}
                gradient="bg-gradient-to-r from-teal-500 to-cyan-500"
                iconBg="bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400"
              />
              <StatCard
                title="Total Slots"
                value={data.slotUtilization.total}
                subtitle="In period"
                icon={CalendarDays}
                gradient="bg-gradient-to-r from-slate-500 to-slate-400"
                iconBg="bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400"
              />
              <StatCard
                title="Booked"
                value={data.slotUtilization.booked}
                subtitle={`${data.slotUtilization.available} available`}
                icon={CheckCircle2}
                gradient="bg-gradient-to-r from-brand to-green-500"
                iconBg="bg-brand-muted text-brand"
              />
              <StatCard
                title="Blocked"
                value={data.slotUtilization.blocked}
                subtitle="Unavailable"
                icon={XCircle}
                gradient="bg-gradient-to-r from-amber-500 to-orange-500"
                iconBg="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
              />
              <StatCard
                title="Closed"
                value={data.slotUtilization.closed}
                subtitle="Non-operational"
                icon={XCircle}
                gradient="bg-gradient-to-r from-red-400 to-rose-400"
                iconBg="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
              />
            </div>

            {/* Utilization bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Utilization</span>
                <span className="font-semibold text-foreground">
                  {data.slotUtilization.utilizationRate}%
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(data.slotUtilization.utilizationRate, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Provider Performance Table                                        */}
      {/* ---------------------------------------------------------------- */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-brand-subtle flex items-center justify-center">
                <Star className="size-4 text-brand" />
              </div>
              <div>
                <CardTitle className="text-base">Provider Performance</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Individual metrics for the selected period
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 shrink-0"
              onClick={exportProviderCSV}
            >
              <Download className="size-3.5" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* Search filter */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by provider, clinic, or city..."
              value={providerSearch}
              onChange={(e) => {
                setProviderSearch(e.target.value);
                setProviderPage(0);
              }}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          {paginatedProviders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="size-12 rounded-full bg-muted/50 dark:bg-muted/20 flex items-center justify-center mb-3">
                <Users className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {providerSearch ? "No providers match your search" : "No provider data"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {providerSearch ? "Try a different search term." : "Appointments in this period will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="border-b border-border/60">
                      {[
                        { key: "name", label: "Provider", align: "text-left" },
                        { key: "clinicName", label: "Clinic", align: "text-left" },
                        { key: "total", label: "Total", align: "text-center" },
                        { key: "completed", label: "Completed", align: "text-center" },
                        { key: "cancelled", label: "Cancelled", align: "text-center" },
                        { key: "noShowRate", label: "No-Show Rate", align: "text-center" },
                        { key: "avgRating", label: "Rating", align: "text-center" },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className={`${col.align} py-3 px-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors ${
                            providerSort.col === col.key
                              ? "text-brand"
                              : "text-muted-foreground"
                          }`}
                          onClick={() =>
                            setProviderSort((prev) => ({
                              col: col.key,
                              dir:
                                prev.col === col.key
                                  ? prev.dir === "asc" ? "desc" : "asc"
                                  : col.key === "name" ? "asc" : "desc",
                            }))
                          }
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {providerSort.col === col.key && (
                              <span className="text-[10px]">
                                {providerSort.dir === "asc" ? "\u25B2" : "\u25BC"}
                              </span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProviders.map((provider, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0">
                              <Users className="size-3.5 text-brand-hover" />
                            </div>
                            <span className="font-medium text-foreground text-sm">
                              {provider.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {provider.clinicName ? (
                            <div>
                              <span className="text-sm text-foreground">{provider.clinicName}</span>
                              {provider.city && (
                                <span className="text-[10px] text-muted-foreground block">
                                  {provider.city}{provider.zipCode ? `, ${provider.zipCode}` : ""}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-center py-3 px-3 font-semibold text-foreground">
                          {provider.total}
                        </td>
                        <td className="text-center py-3 px-3">
                          <Badge
                            variant="outline"
                            className="bg-brand-muted text-brand-hover border-brand-border text-xs"
                          >
                            <CheckCircle2 className="size-3 mr-1" />
                            {provider.completed}
                          </Badge>
                        </td>
                        <td className="text-center py-3 px-3">
                          <Badge
                            variant="outline"
                            className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 text-xs"
                          >
                            <XCircle className="size-3 mr-1" />
                            {provider.cancelled}
                          </Badge>
                        </td>
                        <td className="text-center py-3 px-3">
                          <span
                            className={`text-xs font-semibold ${
                              provider.noShowRate >= 20
                                ? "text-red-600 dark:text-red-400"
                                : provider.noShowRate >= 10
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-brand"
                            }`}
                          >
                            {provider.noShowRate}%
                          </span>
                        </td>
                        <td className="text-center py-3 px-3">
                          {provider.avgRating > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              <Star className="size-3.5 fill-amber-400 text-amber-400" />
                              <span className="text-xs font-semibold text-foreground">
                                {provider.avgRating}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {providerTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">
                    {filteredProviders.length} provider{filteredProviders.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                      disabled={providerPage === 0}
                      onClick={() => setProviderPage((p) => Math.max(0, p - 1))}
                    >
                      Prev
                    </Button>
                    {Array.from({ length: providerTotalPages }, (_, i) => (
                      <Button
                        key={i}
                        variant={providerPage === i ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7 w-7 p-0"
                        onClick={() => setProviderPage(i)}
                      >
                        {i + 1}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                      disabled={providerPage >= providerTotalPages - 1}
                      onClick={() => setProviderPage((p) => Math.min(providerTotalPages - 1, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Cancellation Reasons                                             */}
      {/* ---------------------------------------------------------------- */}
      {data.cancellationReasons && data.cancellationReasons.totalCancelled > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <XCircle className="size-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-base">Cancellation Reasons</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Breakdown of {data.cancellationReasons.totalCancelled} cancellations
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Patient Cancelled", key: "patientCancelled" as const, color: "bg-blue-500" },
                { label: "Clinic Cancelled", key: "clinicCancelled" as const, color: "bg-amber-500" },
                { label: "Double Booking", key: "doubleBooking" as const, color: "bg-red-500" },
                { label: "Unknown", key: "unknown" as const, color: "bg-slate-400" },
              ].map((reason) => {
                const count = data.cancellationReasons[reason.key];
                if (count === 0) return null;
                const pct = (count / data.cancellationReasons.totalCancelled) * 100;
                return (
                  <div key={reason.key} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-32 text-right text-muted-foreground">
                      {reason.label}
                    </span>
                    <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden relative">
                      <div
                        className={`h-full ${reason.color} rounded-md transition-all duration-300 flex items-center px-2`}
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      >
                        <span className="text-[10px] font-semibold text-white">
                          {count} ({Math.round(pct)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Waitlist Performance                                             */}
      {/* ---------------------------------------------------------------- */}
      {data.waitlist && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Activity className="size-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">Waitlist Performance</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {data.waitlist.total} entries in selected period
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Active</p>
                <p className="text-lg font-bold text-foreground">{data.waitlist.active}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Offered</p>
                <p className="text-lg font-bold text-foreground">{data.waitlist.offered}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Fulfilled</p>
                <p className="text-lg font-bold text-foreground">{data.waitlist.fulfilled}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Expired</p>
                <p className="text-lg font-bold text-foreground">{data.waitlist.expired}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Fulfillment</p>
                <p className="text-lg font-bold text-foreground">{data.waitlist.fulfillmentRate}%</p>
              </div>
            </div>

            {/* Daily volume chart */}
            {data.waitlist.dailyVolume.some((d) => d.count > 0) && (
              <div>
                <p className="text-sm font-medium text-foreground mb-3">Daily Waitlist Volume</p>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.waitlist.dailyVolume}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v: string) => (v ? format(parseISO(v), "MMM d") : "")}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", fontSize: "12px" }}
                        labelFormatter={(label: string) => (label ? format(parseISO(label), "MMM d, yyyy") : "")}
                      />
                      <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Patient Demographics                                             */}
      {/* ---------------------------------------------------------------- */}
      {data.demographics && data.demographics.total > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-brand-subtle flex items-center justify-center">
                <Users className="size-4 text-brand" />
              </div>
              <div>
                <CardTitle className="text-base">Patient Demographics</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {data.demographics.total} unique appointments
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Adult / Pediatric split */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-muted/50 p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1">Adult</p>
                <p className="text-2xl font-bold text-foreground">{data.demographics.adult}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.demographics.total > 0
                    ? `${Math.round((data.demographics.adult / data.demographics.total) * 100)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1">Pediatric</p>
                <p className="text-2xl font-bold text-foreground">{data.demographics.pediatric}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.demographics.total > 0
                    ? `${Math.round((data.demographics.pediatric / data.demographics.total) * 100)}%`
                    : "—"}
                </p>
              </div>
            </div>

            {/* Age groups */}
            {data.demographics.ageGroups.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-3">Age Distribution</p>
                <div className="space-y-2">
                  {data.demographics.ageGroups.map((g) => {
                    const totalAge = data.demographics.ageGroups.reduce((s, a) => s + a.count, 0);
                    const pct = (g.count / totalAge) * 100;
                    return (
                      <div key={g.group} className="flex items-center gap-3">
                        <span className="text-xs font-medium w-12 text-right text-muted-foreground">
                          {g.group}
                        </span>
                        <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
                          <div
                            className="h-full bg-gradient-to-r from-brand to-lavender rounded-md transition-all duration-300 flex items-center px-2"
                            style={{ width: `${Math.max(pct, g.count > 0 ? 8 : 0)}%` }}
                          >
                            {pct > 15 && (
                              <span className="text-[10px] font-semibold text-white">
                                {g.count} ({Math.round(pct)}%)
                              </span>
                            )}
                          </div>
                          {pct <= 15 && g.count > 0 && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
                              {g.count}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Row 3: Deposit Capture Volume — Full Width Bar Chart              */}
      {/* ---------------------------------------------------------------- */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-brand-subtle flex items-center justify-center">
              <DollarSign className="size-4 text-brand" />
            </div>
            <div>
              <CardTitle className="text-base">Deposit Capture Volume</CardTitle>
              <p className="text-xs text-muted-foreground">
                Daily deposit capture amounts
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={depositChartData}
                margin={{ top: 20, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.4}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => format(parseISO(v), "MMM dd")}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip content={<DepositTooltipContent />} />
                <Bar
                  dataKey="amount"
                  fill={COLORS.deposit}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                >
                  <LabelList
                    dataKey="count"
                    position="top"
                    formatter={(v: number) => (v > 0 ? `${v} txn` : "")}
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* Booking Source / Conversion Funnel                                */}
      {/* ---------------------------------------------------------------- */}
      {data.conversionFunnel && data.conversionFunnel.funnel.totalSearches > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <TrendingUp className="size-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-base">Conversion Funnel</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Patient booking journey for this clinic
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Overall rate */}
            <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  Overall Search → Booking Rate
                </p>
                <p className="text-xs text-muted-foreground">
                  From search to completed booking
                </p>
              </div>
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {data.conversionFunnel.conversionRates.searchToBooking}%
              </span>
            </div>

            {/* Funnel steps */}
            <div className="space-y-0">
              {[
                { icon: Search, label: "Searches", key: "totalSearches" as const, color: "bg-purple-500" },
                { icon: Eye, label: "Clinic Views", key: "clinicViews" as const, color: "bg-indigo-500", rateKey: "searchToClinicView" as const },
                { icon: MousePointerClick, label: "Booking Starts", key: "bookingStarts" as const, color: "bg-blue-500", rateKey: "clinicViewToBookingStart" as const },
                { icon: ShoppingCart, label: "Booking Completes", key: "bookingCompletes" as const, color: "bg-brand-muted", rateKey: "bookingStartToComplete" as const },
              ].map((step, idx) => {
                const f = data.conversionFunnel.funnel;
                const count = f[step.key];
                const pct = f.totalSearches > 0 ? (count / f.totalSearches) * 100 : 0;
                const rate = step.rateKey ? data.conversionFunnel.conversionRates[step.rateKey] : 100;
                return (
                  <div key={step.key}>
                    <div className="flex items-center gap-4 py-3">
                      <div className={`${step.color} text-white rounded-lg p-2 shrink-0`}>
                        <step.icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{step.label}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5">{count}</Badge>
                          {data.conversionFunnel.uniqueSessions[step.key === "totalSearches" ? "searches" : step.key === "clinicViews" ? "clinicViews" : step.key === "bookingStarts" ? "bookingStarts" : "bookingCompletes"] > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              ({data.conversionFunnel.uniqueSessions[step.key === "totalSearches" ? "searches" : step.key === "clinicViews" ? "clinicViews" : step.key === "bookingStarts" ? "bookingStarts" : "bookingCompletes"]} sessions)
                            </span>
                          )}
                        </div>
                        {idx > 0 && (
                          <p className="text-xs text-muted-foreground">{rate}% from previous step</p>
                        )}
                      </div>
                      <div className="w-32 md:w-48 h-5 bg-muted rounded-full overflow-hidden shrink-0">
                        <div
                          className={`${step.color} h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
                          style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                        >
                          {pct > 15 && (
                            <span className="text-[9px] font-semibold text-white">{Math.round(pct)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {idx < 3 && (
                      <div className="flex justify-center">
                        <ArrowRight className="size-4 text-muted-foreground/40 -my-1" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Recommendation acceptance */}
            <div className="flex items-center justify-between bg-brand-muted rounded-lg p-4 border border-brand-border mt-2">
              <div className="flex items-center gap-3">
                <ThumbsUp className="size-5 text-brand" />
                <div>
                  <p className="text-sm font-medium text-brand-hover">Recommendation Acceptance Rate</p>
                  <p className="text-xs text-muted-foreground">Patients who accepted clinic recommendations</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-brand">{data.conversionFunnel.recommendationAcceptRate}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Cross-Clinic Comparison (SYSTEM_MANAGER only)                    */}
      {/* ---------------------------------------------------------------- */}
      {isSystemManager && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-brand-subtle flex items-center justify-center">
                  <BarChart3 className="size-4 text-brand" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    Cross-Clinic Comparison
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Aggregated metrics across all clinics
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5 shrink-0"
                onClick={exportComparisonCSV}
                disabled={!comparison || comparison.length === 0}
              >
                <Download className="size-3.5" />
                CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {/* Search filter */}
            {comparison && comparison.length > 0 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by clinic name or city..."
                  value={compSearch}
                  onChange={(e) => {
                    setCompSearch(e.target.value);
                    setCompPage(0);
                  }}
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            )}

            {comparisonLoading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : paginatedComparison.length > 0 ? (
              <>
                <div className="overflow-x-auto -mx-4 max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background z-10">
                      <tr className="border-b border-border/60">
                        {[
                          { key: "clinicName", label: "Clinic", align: "text-left" },
                          { key: "appointments", label: "Appts", align: "text-center" },
                          { key: "completed", label: "Completed", align: "text-center" },
                          { key: "noShows", label: "No-Shows", align: "text-center" },
                          { key: "revenue", label: "Revenue", align: "text-center" },
                          { key: "rating", label: "Rating", align: "text-center" },
                        ].map((col) => (
                          <th
                            key={col.key}
                            className={`${col.align} py-3 px-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors ${
                              compSort.col === col.key
                                ? "text-brand"
                                : "text-muted-foreground"
                            }`}
                            onClick={() =>
                              setCompSort((prev) => ({
                                col: col.key,
                                dir:
                                  prev.col === col.key
                                    ? prev.dir === "asc"
                                      ? "desc"
                                      : "asc"
                                    : col.key === "clinicName"
                                      ? "asc"
                                      : "desc",
                              }))
                            }
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {compSort.col === col.key && (
                                <span className="text-[10px]">
                                  {compSort.dir === "asc" ? "\u25B2" : "\u25BC"}
                                </span>
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedComparison.map((clinic) => (
                        <tr
                          key={clinic.clinicId}
                          className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0">
                                <Users className="size-3.5 text-brand-hover" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-medium text-foreground text-sm block truncate">
                                  {clinic.clinicName}
                                </span>
                                {clinic.city && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {clinic.city}{clinic.zipCode ? `, ${clinic.zipCode}` : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="text-center py-3 px-3 font-semibold text-foreground">
                            {clinic.appointments}
                          </td>
                          <td className="text-center py-3 px-3">
                            <span className="text-xs font-semibold text-brand">
                              {clinic.appointments > 0
                                ? `${Math.round((clinic.completed / clinic.appointments) * 100)}%`
                                : "—"}
                            </span>
                          </td>
                          <td className="text-center py-3 px-3">
                            <span
                              className={`text-xs font-semibold ${
                                clinic.appointments > 0 &&
                                clinic.noShows / clinic.appointments >= 0.1
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {clinic.appointments > 0
                                ? `${Math.round((clinic.noShows / clinic.appointments) * 100)}%`
                                : "—"}
                            </span>
                          </td>
                          <td className="text-center py-3 px-3 font-semibold tabular-nums text-foreground">
                            {fmtCents(clinic.revenue)}
                          </td>
                          <td className="text-center py-3 px-3">
                            {clinic.rating > 0 ? (
                              <div className="flex items-center justify-center gap-1">
                                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                                <span className="text-xs font-semibold text-foreground">
                                  {clinic.rating}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {compTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-xs text-muted-foreground">
                      {filteredComparison.length} clinic{filteredComparison.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        disabled={compPage === 0}
                        onClick={() => setCompPage((p) => Math.max(0, p - 1))}
                      >
                        Prev
                      </Button>
                      {Array.from({ length: compTotalPages }, (_, i) => (
                        <Button
                          key={i}
                          variant={compPage === i ? "default" : "outline"}
                          size="sm"
                          className="text-xs h-7 w-7 p-0"
                          onClick={() => setCompPage(i)}
                        >
                          {i + 1}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        disabled={compPage >= compTotalPages - 1}
                        onClick={() => setCompPage((p) => Math.min(compTotalPages - 1, p + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : comparison && comparison.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="size-12 rounded-full bg-muted/50 dark:bg-muted/20 flex items-center justify-center mb-3">
                  <Building2 className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  No clinic data
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Data will appear once appointments exist in this period.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
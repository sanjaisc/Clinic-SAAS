"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { ClinicSelectorBar } from "@/components/clinic-selector-bar";

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
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25"
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
                className="text-xs bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
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

  const fetchAnalytics = useCallback(
    async (p: Period, from?: Date, to?: Date) => {
      if (!effectiveClinicId) return;
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
        params.set("clinicId", effectiveClinicId);
        const res = await fetch(`/api/staff/analytics?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [effectiveClinicId]
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

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      {/* Clinic selector for SYSTEM_MANAGER */}
      {isSystemManager && (
        <ClinicSelectorBar
          clinics={clinics}
          selectedId={effectiveClinicId}
          onSelect={setClinicId}
          loading={clinicsLoading}
        />
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Analytics
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
      {/* Row 1: Appointment Volume — Full Width Area Chart                  */}
      {/* ---------------------------------------------------------------- */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Activity className="size-4 text-emerald-600 dark:text-emerald-400" />
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
              <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <Users className="size-4 text-emerald-600 dark:text-emerald-400" />
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
      {/* Row 3: Deposit Capture Volume — Full Width Bar Chart              */}
      {/* ---------------------------------------------------------------- */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
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
      {/* Summary stat cards                                                */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Appointments"
          value={data.summary.totalAppointments}
          subtitle={`${data.summary.avgDaily} per day average`}
          icon={CalendarDays}
          gradient="bg-gradient-to-r from-emerald-500 to-teal-500"
          iconBg="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          title="Completion Rate"
          value={`${data.summary.completionRate}%`}
          subtitle={`${data.dailyTrends.reduce((s, d) => s + d.completed, 0)} completed`}
          icon={CheckCircle2}
          gradient="bg-gradient-to-r from-emerald-500 to-green-500"
          iconBg="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
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
      {/* Provider Performance Table                                        */}
      {/* ---------------------------------------------------------------- */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Star className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-base">Provider Performance</CardTitle>
              <p className="text-xs text-muted-foreground">
                Individual metrics for the selected period
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {data.providerPerformance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="size-12 rounded-full bg-muted/50 dark:bg-muted/20 flex items-center justify-center mb-3">
                <Users className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No provider data
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Appointments in this period will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b border-border/60">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Total
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Completed
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Cancelled
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      No-Show Rate
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.providerPerformance.map((provider, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                            <Users className="size-3.5 text-emerald-700 dark:text-emerald-300" />
                          </div>
                          <span className="font-medium text-foreground text-sm">
                            {provider.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-3 font-semibold text-foreground">
                        {provider.total}
                      </td>
                      <td className="text-center py-3 px-3">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs"
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
                                : "text-emerald-600 dark:text-emerald-400"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
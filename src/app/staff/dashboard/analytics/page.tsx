"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  TrendingUp,
  XCircle,
  Clock,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  Star,
  Users,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Legend,
} from "recharts";
import type { ClinicBookSessionUser } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Period = "7d" | "30d" | "90d";

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

interface AnalyticsData {
  period: { start: string; end: string };
  dailyTrends: DailyTrend[];
  modality: ModalityData;
  providerPerformance: ProviderPerf[];
  summary: SummaryStats;
  busiestDay: string;
  busiestHour: string;
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const COLORS = {
  completed: "#10b981",
  checkedIn: "#3b82f6",
  cancelled: "#f87171",
  noShow: "#fbbf24",
  inPerson: "#10b981",
  video: "#0ea5e9",
};

// ---------------------------------------------------------------------------
// Stat Card (same pattern as dashboard)
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
    <div className="rounded-xl border border-border/60 bg-white p-3 shadow-lg text-xs space-y-1.5">
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
  const centerX = cx;
  const centerY = cy;

  return (
    <text x={centerX} y={centerY - 6} textAnchor="middle" dominantBaseline="central">
      <tspan
        className="fill-foreground"
        style={{ fontSize: "20px", fontWeight: 700 }}
      >
        {total}
      </tspan>
      <tspan
        className="fill-muted-foreground"
        x={centerX}
        y={centerY + 14}
        style={{ fontSize: "10px" }}
      >
        total
      </tspan>
    </text>
  );
}

// ---------------------------------------------------------------------------
// Period button group
// ---------------------------------------------------------------------------
function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const options: { label: string; value: Period }[] = [
    { label: "7 Days", value: "7d" },
    { label: "30 Days", value: "30d" },
    { label: "90 Days", value: "90d" },
  ];

  return (
    <div className="inline-flex items-center rounded-xl bg-muted/60 p-1 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
            value === opt.value
              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25"
              : "text-muted-foreground hover:text-foreground hover:bg-white/60"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const user = session?.user as ClinicBookSessionUser | undefined;

  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (p: Period) => {
    if (!user?.clinicId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period: p });
      if (user.role === "SYSTEM_MANAGER" && user.clinicId) {
        params.set("clinicId", user.clinicId);
      }
      const res = await fetch(`/api/staff/analytics?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [user?.clinicId, user?.role]);

  useEffect(() => {
    if (status === "authenticated") fetchAnalytics(period);
  }, [status, period, fetchAnalytics]);

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

  // -------------------------------------
  // Loading skeleton
  // -------------------------------------
  if (status === "loading" || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-9 w-64 rounded-xl" />
        </div>
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-[360px] rounded-xl" />
          <Skeleton className="h-[360px] rounded-xl" />
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  // -------------------------------------
  // Error state
  // -------------------------------------
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/30">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="size-8 text-red-400 mb-3" />
          <p className="text-sm font-medium text-red-800">
            Failed to load analytics
          </p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 cursor-pointer"
            onClick={() => fetchAnalytics(period)}
          >
            <RefreshCw className="size-3.5 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
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
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Appointments"
          value={data.summary.totalAppointments}
          subtitle={`${data.summary.avgDaily} per day average`}
          icon={CalendarDays}
          gradient="bg-gradient-to-r from-emerald-500 to-teal-500"
          iconBg="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Completion Rate"
          value={`${data.summary.completionRate}%`}
          subtitle={`${data.dailyTrends.reduce((s, d) => s + d.completed, 0)} completed`}
          icon={CheckCircle2}
          gradient="bg-gradient-to-r from-emerald-500 to-green-500"
          iconBg="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Cancellation Rate"
          value={`${data.summary.cancellationRate}%`}
          subtitle={`${data.dailyTrends.reduce((s, d) => s + d.cancelled, 0)} cancelled`}
          icon={XCircle}
          gradient="bg-gradient-to-r from-red-400 to-rose-400"
          iconBg="bg-red-100 text-red-600"
        />
        <StatCard
          title="Avg Daily"
          value={data.summary.avgDaily}
          subtitle={`${data.busiestDay} is busiest`}
          icon={TrendingUp}
          gradient="bg-gradient-to-r from-amber-500 to-orange-500"
          iconBg="bg-amber-100 text-amber-600"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart — Daily Trends (2/3) */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Activity className="size-4 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">Appointment Trends</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Daily breakdown by status
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-2">
            <div className="h-[300px] w-full">
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

        {/* Pie Chart — Modality Split (1/3) */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Users className="size-4 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">Modality Split</CardTitle>
                <p className="text-xs text-muted-foreground">
                  In-Person vs Video
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
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-1">
                  Busiest Day
                </p>
                <p className="text-sm font-bold text-foreground">
                  {data.busiestDay}
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
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
      </div>

      {/* Provider Performance Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Star className="size-4 text-emerald-600" />
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
              <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
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
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-sm">
                <thead>
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
                          <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <Users className="size-3.5 text-emerald-700" />
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
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                        >
                          <CheckCircle2 className="size-3 mr-1" />
                          {provider.completed}
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-3">
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-600 border-red-200 text-xs"
                        >
                          <XCircle className="size-3 mr-1" />
                          {provider.cancelled}
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-3">
                        <span
                          className={`text-xs font-semibold ${
                            provider.noShowRate >= 20
                              ? "text-red-600"
                              : provider.noShowRate >= 10
                                ? "text-amber-600"
                                : "text-emerald-600"
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
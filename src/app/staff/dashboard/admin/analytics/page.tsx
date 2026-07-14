"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  TrendingUp,
  XCircle,
  BarChart3,

  Star,
  Activity,
  CheckCircle2,
  DollarSign,
  UserX,
  Search,
  Eye,
  MousePointerClick,
  ShoppingCart,
  ThumbsUp,
  ArrowRight,
  Building2,
  ChevronDown,
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
import type { DoctASessionUser } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Period = "TODAY" | "7D" | "30D" | "90D" | "custom";

interface AnalyticsData {
  period: { start: string; end: string; days: number };
  appointmentVolume: Array<{ date: string; count: number }>;
  modalitySplit: {
    inPerson: number;
    video: number;
    inPersonPct: number;
    videoPct: number;
  };
  noShowDistribution: Array<{ day: string; count: number }>;
  depositCapture: {
    totalDepositCents: number;
    capturedCents: number;
    forfeitedCents: number;
    refundedCents: number;
  };
  summaryStats: {
    totalAppointments: number;
    completedAppointments: number;
    noShowCount: number;
    cancellationRate: number;
    avgRating: number;
    totalRevenue: number;
  };
  clinicBreakdown: Array<{
    clinicId: string;
    clinicName: string;
    appointments: number;
    completed: number;
    noShows: number;
    revenue: number;
    rating: number;
  }>;
}

interface ConversionData {
  period: { start: string; end: string };
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

const PERIODS: { key: Period; label: string }[] = [
  { key: "TODAY", label: "Today" },
  { key: "7D", label: "7 Days" },
  { key: "30D", label: "30 Days" },
  { key: "90D", label: "90 Days" },
];

// ---------------------------------------------------------------------------
// Helper: format cents to dollars
// ---------------------------------------------------------------------------
function fmtCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminAnalyticsPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;

  // Date filtering
  const [period, setPeriod] = useState<Period>("30D");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [calOpen, setCalOpen] = useState<"from" | "to" | null>(null);

  // Data
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [conversion, setConversion] = useState<ConversionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Build params for both calls
    const params = new URLSearchParams();
    if (period === "custom" && dateFrom && dateTo) {
      params.set("dateFrom", format(dateFrom, "yyyy-MM-dd"));
      params.set("dateTo", format(dateTo, "yyyy-MM-dd"));
    } else if (period !== "custom") {
      params.set("period", period);
    }

    const convParams = new URLSearchParams();
    if (dateFrom && dateTo) {
      convParams.set("dateFrom", format(dateFrom, "yyyy-MM-dd"));
      convParams.set("dateTo", format(dateTo, "yyyy-MM-dd"));
    }

    let cancelled = false;

    // Use an async IIFE to avoid synchronous setState in effect body
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [aData, cData] = await Promise.all([
          fetch(`/api/staff/admin/analytics?${params.toString()}`).then((r) => {
            if (!r.ok) throw new Error("Analytics fetch failed");
            return r.json();
          }),
          fetch(`/api/staff/admin/conversion?${convParams.toString()}`).then(
            (r) => {
              if (!r.ok) throw new Error("Conversion fetch failed");
              return r.json();
            }
          ),
        ]);
        if (!cancelled) {
          setAnalytics(aData);
          setConversion(cData);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, period, dateFrom, dateTo, refreshKey]);

  const handleApply = () => {
    setPeriod("custom");
    setRefreshKey((k) => k + 1);
  };

  // ---------------------------------------------------------------------------
  // Render: Loading skeleton
  // ---------------------------------------------------------------------------
  if (loading && !analytics) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Date bar skeleton */}
        <div className="flex flex-wrap gap-2 items-center">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-36 mb-4" />
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-4">
        <XCircle className="size-12 text-red-400 mx-auto" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
          Retry
        </Button>
      </div>
    );
  }

  if (!analytics || !conversion) return null;

  // ---------------------------------------------------------------------------
  // Derived chart data
  // ---------------------------------------------------------------------------
  const maxVolume = Math.max(...analytics.appointmentVolume.map((d) => d.count), 1);
  const maxNoShow = Math.max(...analytics.noShowDistribution.map((d) => d.count), 1);
  const maxDeposit = Math.max(
    analytics.depositCapture.totalDepositCents,
    analytics.depositCapture.capturedCents,
    analytics.depositCapture.forfeitedCents,
    analytics.depositCapture.refundedCents,
    1
  );

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* DATE FILTERING BAR                                                */}
      {/* ================================================================= */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground mr-1">
              Period:
            </span>
            {PERIODS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={period === p.key ? "default" : "outline"}
                className={
                  period === p.key
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : ""
                }
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}

            <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

            {/* Custom date range */}
            <div className="flex items-center gap-2">
              <Popover
                open={calOpen === "from"}
                onOpenChange={(open) =>
                  setCalOpen(open ? "from" : null)
                }
              >
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant={period === "custom" ? "default" : "outline"}
                    className={
                      period === "custom"
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : ""
                    }
                  >
                    {dateFrom
                      ? format(dateFrom, "MMM d, yyyy")
                      : "From"}
                    <ChevronDown className="size-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(d) => {
                      setDateFrom(d);
                      setPeriod("custom");
                      setCalOpen("to");
                    }}
                    disabled={(d) =>
                      dateTo ? d > dateTo : d > new Date()
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-xs text-muted-foreground">to</span>

              <Popover
                open={calOpen === "to"}
                onOpenChange={(open) => setCalOpen(open ? "to" : null)}
              >
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant={period === "custom" ? "default" : "outline"}
                    className={
                      period === "custom"
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : ""
                    }
                  >
                    {dateTo
                      ? format(dateTo, "MMM d, yyyy")
                      : "To"}
                    <ChevronDown className="size-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(d) => {
                      setDateTo(d);
                      setPeriod("custom");
                      setCalOpen(null);
                    }}
                    disabled={(d) =>
                      dateFrom ? d < dateFrom || d > new Date() : d > new Date()
                    }
                  initialFocus
                  />
                </PopoverContent>
              </Popover>

              {period === "custom" && (
                <Button size="sm" onClick={handleApply}>
                  Apply
                </Button>
              )}
            </div>

            {analytics.period && (
              <span className="text-xs text-muted-foreground ml-auto">
                {analytics.period.start} → {analytics.period.end}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* SUMMARY STATS ROW                                                 */}
      {/* ================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<CalendarDays className="size-5 text-purple-500" />}
          label="Total Appointments"
          value={analytics.summaryStats.totalAppointments.toLocaleString()}
          sub={`Last ${analytics.period.days} days`}
        />
        <StatCard
          icon={<CheckCircle2 className="size-5 text-brand" />}
          label="Completed"
          value={analytics.summaryStats.completedAppointments.toLocaleString()}
          sub={
            analytics.summaryStats.totalAppointments > 0
              ? `${Math.round((analytics.summaryStats.completedAppointments / analytics.summaryStats.totalAppointments) * 100)}% completion`
              : "N/A"
          }
        />
        <StatCard
          icon={<UserX className="size-5 text-amber-500" />}
          label="No-Shows"
          value={analytics.summaryStats.noShowCount.toLocaleString()}
          sub={
            analytics.summaryStats.totalAppointments > 0
              ? `${Math.round((analytics.summaryStats.noShowCount / analytics.summaryStats.totalAppointments) * 100)}% rate`
              : "N/A"
          }
        />
        <StatCard
          icon={<XCircle className="size-5 text-red-400" />}
          label="Cancellation Rate"
          value={`${analytics.summaryStats.cancellationRate}%`}
          sub="of total appointments"
        />
        <StatCard
          icon={<Star className="size-5 text-yellow-500" />}
          label="Avg Rating"
          value={analytics.summaryStats.avgRating.toFixed(1)}
          sub="across all reviews"
        />
      </div>

      {/* ================================================================= */}
      {/* CHARTS SECTION (G1)                                               */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- Appointment Volume (Area Chart) --- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-purple-500" />
              Appointment Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-48 flex items-end gap-px">
              {analytics.appointmentVolume.map((d, idx) => {
                const heightPct = (d.count / maxVolume) * 100;
                const showLabel =
                  analytics.period.days <= 7 ||
                  idx === 0 ||
                  idx === analytics.appointmentVolume.length - 1 ||
                  idx === Math.floor(analytics.appointmentVolume.length / 2);
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-0"
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-popover border border-border rounded-md px-2 py-1 shadow-md whitespace-nowrap">
                      <p className="text-xs font-medium">
                        {format(parseISO(d.date), "MMM d")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.count} appointments
                      </p>
                    </div>
                    {/* Bar */}
                    <div
                      className="w-full bg-purple-500/80 hover:bg-purple-600 rounded-t-sm transition-all duration-200 min-h-[2px]"
                      style={{ height: `${Math.max(heightPct, 1)}%` }}
                    />
                    {/* Label */}
                    {showLabel && (
                      <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                        {format(parseISO(d.date), "MMM d")}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {analytics.appointmentVolume.every((d) => d.count === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No appointment data for this period
              </p>
            )}
          </CardContent>
        </Card>

        {/* --- Modality Split (Donut Chart) --- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="size-4 text-brand" />
              Modality Split
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {analytics.modalitySplit.inPerson + analytics.modalitySplit.video ===
            0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No modality data for this period
              </p>
            ) : (
              <div className="flex items-center gap-8">
                {/* CSS Donut Chart */}
                <div className="relative size-40 shrink-0">
                  <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.91549"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-muted/30"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.91549"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${analytics.modalitySplit.inPersonPct} ${100 - analytics.modalitySplit.inPersonPct}`}
                      strokeDashoffset="0"
                      className="text-purple-600"
                      style={{
                        transition: "stroke-dasharray 0.6s ease",
                      }}
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.91549"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${analytics.modalitySplit.videoPct} ${100 - analytics.modalitySplit.videoPct}`}
                      strokeDashoffset={`${-analytics.modalitySplit.inPersonPct}`}
                      className="text-brand"
                      style={{
                        transition: "stroke-dasharray 0.6s ease",
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-semibold">
                      {analytics.modalitySplit.inPerson +
                        analytics.modalitySplit.video}
                    </span>
                  </div>
                </div>
                {/* Legend */}
                <div className="space-y-4 flex-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-3 rounded-full bg-purple-600" />
                        <span className="text-sm font-medium">
                          In-Person
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold">
                          {analytics.modalitySplit.inPerson}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({analytics.modalitySplit.inPersonPct}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-purple-600 rounded-full transition-all duration-500"
                        style={{
                          width: `${analytics.modalitySplit.inPersonPct}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="size-3 rounded-full bg-brand-muted" />
                        <span className="text-sm font-medium">Video</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold">
                          {analytics.modalitySplit.video}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({analytics.modalitySplit.videoPct}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-brand-muted rounded-full transition-all duration-500"
                        style={{
                          width: `${analytics.modalitySplit.videoPct}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- No-Show Distribution (Bar Chart) --- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UserX className="size-4 text-amber-500" />
              No-Show Distribution by Day
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {analytics.noShowDistribution.every((d) => d.count === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No no-show data for this period
              </p>
            ) : (
              <div className="space-y-2">
                {analytics.noShowDistribution.map((d) => {
                  const widthPct = (d.count / maxNoShow) * 100;
                  return (
                    <div key={d.day} className="flex items-center gap-3 group">
                      <span className="text-xs font-medium w-8 text-right text-muted-foreground">
                        {d.day}
                      </span>
                      <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 rounded-md transition-all duration-300 flex items-center px-2"
                          style={{
                            width: `${Math.max(widthPct, d.count > 0 ? 8 : 0)}%`,
                          }}
                        >
                          {widthPct > 20 && (
                            <span className="text-[10px] font-semibold text-white">
                              {d.count}
                            </span>
                          )}
                        </div>
                        {widthPct <= 20 && d.count > 0 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
                            {d.count}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- Deposit Capture (Stacked Horizontal Bar) --- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="size-4 text-brand" />
              Deposit Capture
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {analytics.depositCapture.totalDepositCents === 0 &&
            analytics.depositCapture.capturedCents === 0 &&
            analytics.depositCapture.forfeitedCents === 0 &&
            analytics.depositCapture.refundedCents === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No deposit data for this period
              </p>
            ) : (
              <div className="space-y-4">
                {/* Stacked bar */}
                <div className="h-10 rounded-lg overflow-hidden flex bg-muted">
                  {[
                    {
                      label: "Authorized",
                      value: analytics.depositCapture.totalDepositCents,
                      color: "bg-blue-500",
                    },
                    {
                      label: "Captured",
                      value: analytics.depositCapture.capturedCents,
                      color: "bg-brand-muted",
                    },
                    {
                      label: "Forfeited",
                      value: analytics.depositCapture.forfeitedCents,
                      color: "bg-amber-500",
                    },
                    {
                      label: "Refunded",
                      value: analytics.depositCapture.refundedCents,
                      color: "bg-red-400",
                    },
                  ].map((seg) => {
                    const widthPct =
                      maxDeposit > 0
                        ? (seg.value / maxDeposit) * 100
                        : 0;
                    if (widthPct === 0) return null;
                    return (
                      <div
                        key={seg.label}
                        className={`${seg.color} flex items-center justify-center transition-all duration-500 min-w-0`}
                        style={{ width: `${widthPct}%` }}
                        title={`${seg.label}: ${fmtCents(seg.value)}`}
                      >
                        {widthPct > 12 && (
                          <span className="text-[10px] font-semibold text-white truncate px-1">
                            {seg.label}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="grid grid-cols-2 gap-3">
                  <DepositLegendItem
                    color="bg-blue-500"
                    label="Authorized"
                    value={fmtCents(analytics.depositCapture.totalDepositCents)}
                  />
                  <DepositLegendItem
                    color="bg-brand-muted"
                    label="Captured"
                    value={fmtCents(analytics.depositCapture.capturedCents)}
                  />
                  <DepositLegendItem
                    color="bg-amber-500"
                    label="Forfeited"
                    value={fmtCents(analytics.depositCapture.forfeitedCents)}
                  />
                  <DepositLegendItem
                    color="bg-red-400"
                    label="Refunded"
                    value={fmtCents(analytics.depositCapture.refundedCents)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ================================================================= */}
      {/* CLINIC BREAKDOWN TABLE                                            */}
      {/* ================================================================= */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="size-4 text-purple-500" />
            Clinic Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {analytics.clinicBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No clinic data for this period
            </p>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground pr-4">
                      Clinic Name
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground text-right pr-4">
                      Appts
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground text-right pr-4">
                      Completed
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground text-right pr-4">
                      No-Shows
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground text-right pr-4">
                      Revenue
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {analytics.clinicBreakdown.map((clinic) => (
                    <tr key={clinic.clinicId} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 pr-4 font-medium truncate max-w-[200px]">
                        {clinic.clinicName}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {clinic.appointments}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-brand">
                        {clinic.completed}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-amber-600">
                        {clinic.noShows}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                        {fmtCents(clinic.revenue)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-1">
                          <Star className="size-3 text-yellow-500 fill-yellow-500" />
                          {clinic.rating > 0 ? clinic.rating.toFixed(1) : "—"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* CONVERSION METRICS SECTION (G2)                                   */}
      {/* ================================================================= */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="size-4 text-purple-500" />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-6">
            {/* Overall Rate */}
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
                {conversion.conversionRates.searchToBooking}%
              </span>
            </div>

            {/* Funnel Steps */}
            <div className="space-y-0">
              {[
                {
                  icon: <Search className="size-4" />,
                  label: "Searches",
                  count: conversion.funnel.totalSearches,
                  unique: conversion.uniqueSessions.searches,
                  color: "bg-purple-500",
                  pct: 100,
                },
                {
                  icon: <Eye className="size-4" />,
                  label: "Clinic Views",
                  count: conversion.funnel.clinicViews,
                  unique: conversion.uniqueSessions.clinicViews,
                  color: "bg-indigo-500",
                  rate: conversion.conversionRates.searchToClinicView,
                  pct:
                    conversion.funnel.totalSearches > 0
                      ? (conversion.funnel.clinicViews /
                          conversion.funnel.totalSearches) *
                        100
                      : 0,
                },
                {
                  icon: <MousePointerClick className="size-4" />,
                  label: "Booking Starts",
                  count: conversion.funnel.bookingStarts,
                  unique: conversion.uniqueSessions.bookingStarts,
                  color: "bg-blue-500",
                  rate: conversion.conversionRates.clinicViewToBookingStart,
                  pct:
                    conversion.funnel.totalSearches > 0
                      ? (conversion.funnel.bookingStarts /
                          conversion.funnel.totalSearches) *
                        100
                      : 0,
                },
                {
                  icon: <ShoppingCart className="size-4" />,
                  label: "Booking Completes",
                  count: conversion.funnel.bookingCompletes,
                  unique: conversion.uniqueSessions.bookingCompletes,
                  color: "bg-brand-muted",
                  rate: conversion.conversionRates.bookingStartToComplete,
                  pct:
                    conversion.funnel.totalSearches > 0
                      ? (conversion.funnel.bookingCompletes /
                          conversion.funnel.totalSearches) *
                        100
                      : 0,
                },
              ].map((step, idx) => (
                <div key={step.label}>
                  {/* Step row */}
                  <div className="flex items-center gap-4 py-3">
                    {/* Icon */}
                    <div
                      className={`${step.color} text-white rounded-lg p-2 shrink-0`}
                    >
                      {step.icon}
                    </div>
                    {/* Label + count */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {step.label}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          {step.count}
                        </Badge>
                        {step.unique > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            ({step.unique} sessions)
                          </span>
                        )}
                      </div>
                      {step.rate !== undefined && idx > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {step.rate}% from previous step
                        </p>
                      )}
                    </div>
                    {/* Percentage bar */}
                    <div className="w-32 md:w-48 h-5 bg-muted rounded-full overflow-hidden shrink-0">
                      <div
                        className={`${step.color} h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
                        style={{
                          width: `${Math.max(step.pct, step.count > 0 ? 2 : 0)}%`,
                        }}
                      >
                        {step.pct > 15 && (
                          <span className="text-[9px] font-semibold text-white">
                            {Math.round(step.pct)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Arrow connector */}
                  {idx < 3 && (
                    <div className="flex justify-center">
                      <ArrowRight className="size-4 text-muted-foreground/40 -my-1" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Recommendation Acceptance */}
            <div className="flex items-center justify-between bg-brand-muted rounded-lg p-4 border border-brand-border ">
              <div className="flex items-center gap-3">
                <ThumbsUp className="size-5 text-brand" />
                <div>
                  <p className="text-sm font-medium text-brand-hover">
                    Recommendation Acceptance Rate
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Patients who accepted clinic recommendations
                  </p>
                </div>
              </div>
              <span className="text-2xl font-bold text-brand">
                {conversion.recommendationAcceptRate}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue highlight */}
      <Card className="bg-gradient-to-r from-purple-600 to-brand border-0">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-white/20 flex items-center justify-center">
              <DollarSign className="size-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/80">
                Total Revenue (Completed Appointments)
              </p>
              <p className="text-xs text-white/60">
                Capture + Full + Balance payments
              </p>
            </div>
          </div>
          <span className="text-3xl font-bold text-white">
            {fmtCents(analytics.summaryStats.totalRevenue)}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function DepositLegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`size-2.5 rounded-sm ${color} shrink-0`} />
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}
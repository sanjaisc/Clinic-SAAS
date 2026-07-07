"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarPlus,
  XCircle,
  UserCheck,
  CheckCheck,
  UserX,
  Activity,
  CheckCircle2,
  RefreshCw,
  BellOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { AUDIT_ACTIONS } from "@/lib/constants";
import type { DoctASessionUser } from "@/lib/auth";
import { useClinicContext } from "@/hooks/use-clinic-context";
import { ClinicSelectorBar } from "@/components/clinic-selector-bar";

// ---- Types ----

interface ActivityNotification {
  id: string;
  action: string;
  createdAt: string;
  patientName: string | null;
  providerName: string | null;
  serviceName: string | null;
  appointmentStatus: string | null;
  triggeredBy: string | null;
}

interface NotificationsResponse {
  notifications: ActivityNotification[];
  unreadCount: number;
}

// ---- Filter config ----

type FilterTab = "all" | "bookings" | "cancellations" | "checkins" | "completions" | "noshow";

const FILTER_MAP: Record<FilterTab, string[] | null> = {
  all: null,
  bookings: [AUDIT_ACTIONS.BOOKING_CREATED],
  cancellations: [AUDIT_ACTIONS.BOOKING_CANCELLED],
  checkins: [AUDIT_ACTIONS.BOOKING_CHECKED_IN],
  completions: [AUDIT_ACTIONS.BOOKING_COMPLETED],
  noshow: [AUDIT_ACTIONS.BOOKING_NO_SHOW],
};

// ---- Action visual config ----

const ACTION_CONFIG: Record<
  string,
  {
    icon: React.ElementType;
    circleBg: string;
    circleColor: string;
    borderColor: string;
    label: string;
  }
> = {
  [AUDIT_ACTIONS.BOOKING_CREATED]: {
    icon: CalendarPlus,
    circleBg: "bg-emerald-100",
    circleColor: "text-emerald-600",
    borderColor: "border-l-emerald-500",
    label: "New booking",
  },
  [AUDIT_ACTIONS.BOOKING_CANCELLED]: {
    icon: XCircle,
    circleBg: "bg-red-100",
    circleColor: "text-red-500",
    borderColor: "border-l-red-500",
    label: "Cancelled",
  },
  [AUDIT_ACTIONS.BOOKING_CHECKED_IN]: {
    icon: UserCheck,
    circleBg: "bg-blue-100",
    circleColor: "text-blue-600",
    borderColor: "border-l-blue-500",
    label: "Checked in",
  },
  [AUDIT_ACTIONS.BOOKING_COMPLETED]: {
    icon: CheckCheck,
    circleBg: "bg-green-100",
    circleColor: "text-green-600",
    borderColor: "border-l-green-500",
    label: "Completed",
  },
  [AUDIT_ACTIONS.BOOKING_NO_SHOW]: {
    icon: UserX,
    circleBg: "bg-amber-100",
    circleColor: "text-amber-600",
    borderColor: "border-l-amber-500",
    label: "No-show",
  },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] ?? {
    icon: Activity,
    circleBg: "bg-muted",
    circleColor: "text-muted-foreground",
    borderColor: "border-l-muted-foreground/30",
    label: action,
  };
}

function getActivityDescription(n: ActivityNotification): string {
  const patient = n.patientName ?? "Patient";
  const provider = n.providerName ?? "Provider";
  const service = n.serviceName ?? "";

  switch (n.action) {
    case AUDIT_ACTIONS.BOOKING_CREATED:
      return `New booking for ${patient}`;
    case AUDIT_ACTIONS.BOOKING_CANCELLED:
      return `Booking cancelled for ${patient}`;
    case AUDIT_ACTIONS.BOOKING_CHECKED_IN:
      return `${patient} checked in`;
    case AUDIT_ACTIONS.BOOKING_COMPLETED:
      return `${patient}'s appointment completed`;
    case AUDIT_ACTIONS.BOOKING_NO_SHOW:
      return `${patient} did not show up`;
    default:
      return n.action;
  }
}

// ---- Skeleton rows ----

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="size-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4 max-w-[400px]" />
            <Skeleton className="h-3 w-1/2 max-w-[250px]" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ---- Empty state ----

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mb-4 animate-slow-rotate">
        <BellOff className="size-6 text-muted-foreground" />
      </div>
      <p className="text-base font-medium text-foreground">No activity yet</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">
        When bookings, check-ins, or other events occur, they will appear here.
      </p>
    </div>
  );
}

// ---- Notification card ----

function NotificationCard({ notification, index }: { notification: ActivityNotification; index: number }) {
  const cfg = getActionConfig(notification.action);
  const Icon = cfg.icon;

  return (
    <div
      className={`
        flex items-center gap-4 p-4 rounded-xl border-l-[3px] ${cfg.borderColor}
        hover:bg-muted/50 transition-all duration-200 hover:border-l-[5px]
        animate-[slide-in-right_0.3s_ease-out_both]
      `}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Left: icon in colored circle */}
      <div
        className={`size-9 rounded-full ${cfg.circleBg} flex items-center justify-center shrink-0`}
      >
        <Icon className={`size-4 ${cfg.circleColor}`} />
      </div>

      {/* Middle: description + details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">
          {getActivityDescription(notification)}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
          {notification.patientName && (
            <span className="text-xs font-semibold text-foreground">
              {notification.patientName}
            </span>
          )}
          {notification.providerName && (
            <>
              <span className="text-xs text-muted-foreground">&middot;</span>
              <span className="text-xs text-muted-foreground">
                {notification.providerName}
              </span>
            </>
          )}
          {notification.serviceName && (
            <>
              <span className="text-xs text-muted-foreground">&middot;</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground border-border/60"
              >
                {notification.serviceName}
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Right: relative timestamp */}
      <div className="shrink-0 text-right">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </span>
      </div>
    </div>
  );
}

// ---- Main page ----

export default function ActivityPage() {
  const { data: session, status } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const {
    clinicId: effectiveClinicId,
    isSystemManager,
    clinics,
    setClinicId,
    clinicsLoading,
  } = useClinicContext();

  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [lastFetchTime, setLastFetchTime] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!effectiveClinicId) return;
    try {
      const res = await fetch(
        `/api/staff/notifications?clinicId=${effectiveClinicId}`
      );
      if (!res.ok) return;
      const json: NotificationsResponse = await res.json();
      setNotifications(json.notifications);
      setLastFetchTime(new Date().toLocaleTimeString());
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [effectiveClinicId]);

  // Initial fetch + 30-second polling
  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchNotifications]);

  // Filter notifications by active tab
  const filteredNotifications =
    activeTab === "all"
      ? notifications
      : notifications.filter((n) => FILTER_MAP[activeTab]?.includes(n.action));

  const handleMarkAllRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
  };

  // Loading state
  if (status === "loading" || loading) {
    return (
      <div className="space-y-6 animate-in fade-in-0 duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <Card className="border-border/50 shadow-sm">
          <div className="p-4">
            <Skeleton className="h-10 w-full max-w-xl rounded-lg" />
          </div>
          <CardContent className="pt-2">
            <SkeletonRows />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) return null;

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
            Activity Feed
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time stream of booking events and clinic activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            Live
          </span>
          {lastFetchTime && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Updated {lastFetchTime}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={fetchNotifications}
          >
            <RefreshCw className="size-3.5 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={handleMarkAllRead}
          >
            <CheckCircle2 className="size-3.5 mr-2" />
            Mark all as read
          </Button>
        </div>
      </div>

      {/* Activity card */}
      <Card className="border-border/50 shadow-sm">
        {/* Subtle gradient header strip */}
        <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-xl" />

        {/* Filter tabs */}
        <div className="px-4 pt-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as FilterTab)}
          >
            <TabsList className="flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="all" className={`text-xs underline-animated ${activeTab === "all" ? "active" : ""}`}>
                All
              </TabsTrigger>
              <TabsTrigger value="bookings" className={`text-xs underline-animated ${activeTab === "bookings" ? "active" : ""}`}>
                Bookings
              </TabsTrigger>
              <TabsTrigger value="cancellations" className={`text-xs underline-animated ${activeTab === "cancellations" ? "active" : ""}`}>
                Cancellations
              </TabsTrigger>
              <TabsTrigger value="checkins" className={`text-xs underline-animated ${activeTab === "checkins" ? "active" : ""}`}>
                Check-ins
              </TabsTrigger>
              <TabsTrigger value="completions" className={`text-xs underline-animated ${activeTab === "completions" ? "active" : ""}`}>
                Completions
              </TabsTrigger>
              <TabsTrigger value="noshow" className={`text-xs underline-animated ${activeTab === "noshow" ? "active" : ""}`}>
                No-shows
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Notification list */}
        <CardContent className="pt-4 pb-4">
          {filteredNotifications.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {filteredNotifications.map((n, i) => (
                <NotificationCard key={n.id} notification={n} index={i} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
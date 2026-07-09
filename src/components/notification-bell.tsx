"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CalendarPlus,
  XCircle,
  CheckCircle,
  CheckCheck,
  UserX,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DoctASessionUser } from "@/lib/auth";

// ---- Types ----

interface NotificationItem {
  id: string;
  action: string;
  createdAt: string;
  patientName: string | null;
  startTime: string | null;
  providerName: string | null;
  serviceName: string | null;
  appointmentStatus: string | null;
  triggeredBy: string | null;
}

interface NotificationResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

// ---- Helpers ----

const ACTION_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  BOOKING_CREATED: {
    icon: CalendarPlus,
    color: "text-brand",
    bgColor: "bg-brand-subtle",
    label: "New booking",
  },
  BOOKING_CANCELLED: {
    icon: XCircle,
    color: "text-red-500",
    bgColor: "bg-red-100",
    label: "Booking cancelled",
  },
  BOOKING_CHECKED_IN: {
    icon: CheckCircle,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    label: "Checked in",
  },
  BOOKING_COMPLETED: {
    icon: CheckCheck,
    color: "text-sky-600",
    bgColor: "bg-sky-100",
    label: "Completed",
  },
  BOOKING_NO_SHOW: {
    icon: UserX,
    color: "text-orange-500",
    bgColor: "bg-orange-100",
    label: "No-show",
  },
};

function getNotificationDescription(n: NotificationItem): string {
  const config = ACTION_CONFIG[n.action];
  if (!config) return n.action;

  switch (n.action) {
    case "BOOKING_CREATED":
      return `New booking: ${n.patientName ?? "Patient"} with ${n.providerName ?? "Provider"}`;
    case "BOOKING_CANCELLED":
      return `Cancelled: ${n.patientName ?? "Patient"}'s appointment`;
    case "BOOKING_CHECKED_IN":
      return `Checked in: ${n.patientName ?? "Patient"}`;
    case "BOOKING_COMPLETED":
      return `Completed: ${n.patientName ?? "Patient"} with ${n.providerName ?? "Provider"}`;
    case "BOOKING_NO_SHOW":
      return `No-show: ${n.patientName ?? "Patient"}`;
    default:
      return config.label;
  }
}

function isUnread(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 15 * 60 * 1000;
}

// ---- Skeleton Loader ----

function NotificationSkeleton() {
  return (
    <div className="space-y-3 p-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-2.5">
          <Skeleton className="size-8 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Main Component ----

export function NotificationBell() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const user = session?.user as DoctASessionUser | undefined;

  const fetchNotifications = useCallback(async () => {
    if (!user?.clinicId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/staff/notifications?clinicId=${user.clinicId}`
      );
      if (res.ok) {
        const json: NotificationResponse = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      setLoading(false);
    }
  }, [user?.clinicId]);

  // Fetch on mount and every 60 seconds
  useEffect(() => {
    if (status === "authenticated") {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60_000);
      return () => clearInterval(interval);
    }
  }, [status, fetchNotifications]);

  const handleMarkAllRead = () => {
    if (!data) return;
    const allIds = new Set(data.notifications.map((n) => n.id));
    setReadIds(allIds);
  };

  const handleNotificationClick = (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  };

  const displayCount =
    data && !loading
      ? data.notifications.filter(
          (n) => !readIds.has(n.id) && isUnread(n.createdAt)
        ).length
      : 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative cursor-pointer"
        >
          <Bell className="size-4.5 text-muted-foreground" />
          {displayCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-coral text-[10px] font-bold text-white px-1">
              {displayCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 p-0 mr-2"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {data && data.unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-medium text-brand hover:text-brand-hover transition-colors cursor-pointer"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Content */}
        {loading && !data ? (
          <NotificationSkeleton />
        ) : !data || data.notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <Bell className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No recent notifications
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Booking activity will appear here
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="divide-y divide-border/40">
              {data.notifications.map((n) => {
                const config = ACTION_CONFIG[n.action];
                const Icon = config?.icon ?? Bell;
                const unread = !readIds.has(n.id) && isUnread(n.createdAt);

                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n.id)}
                    className={`
                      w-full flex items-start gap-3 px-4 py-3 text-left
                      transition-colors cursor-pointer
                      hover:bg-muted/50
                      ${unread ? "border-l-2 border-l-brand" : "border-l-2 border-l-transparent"}
                    `}
                  >
                    <div
                      className={`size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        config?.bgColor ?? "bg-muted"
                      }`}
                    >
                      <Icon
                        className={`size-4 ${config?.color ?? "text-muted-foreground"}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug truncate">
                        {getNotificationDescription(n)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(n.createdAt), {
                          addSuffix: true,
                        })}
                        {n.triggeredBy && (
                          <span>
                            {" "}
                            &middot; by {n.triggeredBy}
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
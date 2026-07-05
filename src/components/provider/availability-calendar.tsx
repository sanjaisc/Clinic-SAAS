"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Video,
  Building2,
  Loader2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  modality: string;
  timeLabel: string;
}

interface DayColumn {
  date: string;        // YYYY-MM-DD
  dayName: string;     // "Mon"
  fullDayName: string; // "Monday"
  monthDay: string;    // "Jul 6"
  isToday: boolean;
  isPast: boolean;
  slots: Slot[];
}

interface Service {
  id: string;
  name: string;
  specialtyId: string;
}

interface AvailabilityData {
  providerId: string;
  weekStart: string;
  weekEnd: string;
  days: DayColumn[];
  services: Service[];
  totalSlots: number;
}

interface ProviderAvailabilityCalendarProps {
  providerId: string;
  providerName: string;
  initialServiceId?: string;
  initialSpecialtyId?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ProviderAvailabilityCalendar({
  providerId,
  providerName,
  initialServiceId,
  initialSpecialtyId,
}: ProviderAvailabilityCalendarProps) {
  const router = useRouter();

  // ---- State ----
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split("T")[0];
  });

  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId || "all");
  const [modalityFilter, setModalityFilter] = useState<"all" | "IN_PERSON" | "VIDEO">("all");
  const [data, setData] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Fetch availability ----
  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ weekStart: currentWeekStart });
    if (modalityFilter !== "all") {
      params.set("modality", modalityFilter);
    }

    try {
      const res = await fetch(`/api/providers/${providerId}/availability?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load availability (${res.status})`);
      }
      const json: AvailabilityData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, [providerId, currentWeekStart, modalityFilter]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // ---- Week navigation ----
  const goNextWeek = () => {
    const d = addDays(parseISO(currentWeekStart), 7);
    setCurrentWeekStart(d.toISOString().split("T")[0]);
  };

  const goPrevWeek = () => {
    const d = subDays(parseISO(currentWeekStart), 7);
    // Don't navigate before today's week
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + diff);
    thisMonday.setHours(0, 0, 0, 0);

    if (d < thisMonday) return;
    setCurrentWeekStart(d.toISOString().split("T")[0]);
  };

  const goToThisWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday.toISOString().split("T")[0]);
  };

  const weekLabel = useMemo(() => {
    const start = parseISO(currentWeekStart);
    const end = addDays(start, 6);
    const startFmt = format(start, "MMM d");
    const endFmt = format(end, "MMM d, yyyy");
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
    }
    return `${startFmt} – ${endFmt}`;
  }, [currentWeekStart]);

  const isThisWeek = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diff);
    thisMonday.setHours(0, 0, 0, 0);
    return currentWeekStart === thisMonday.toISOString().split("T")[0];
  }, [currentWeekStart]);

  // ---- Slot click ----
  const handleSlotClick = (slot: Slot) => {
    const params = new URLSearchParams({
      providerId,
      slotId: slot.id,
    });
    if (selectedServiceId && selectedServiceId !== "all") {
      params.set("serviceId", selectedServiceId);
    }
    router.push(`/book?${params.toString()}`);
  };

  // ---- Render ----
  return (
    <div className="space-y-4">
      {/* Header with navigation and filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8 cursor-pointer"
            onClick={goPrevWeek}
            disabled={isThisWeek}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <button
            onClick={goToThisWeek}
            className="text-sm font-semibold text-foreground hover:text-emerald-700 transition-colors min-w-[180px] text-center cursor-pointer"
            aria-label="Go to this week"
          >
            <Calendar className="inline size-3.5 mr-1 -mt-0.5" />
            {weekLabel}
          </button>

          <Button
            variant="outline"
            size="icon"
            className="size-8 cursor-pointer"
            onClick={goNextWeek}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Modality filter */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {([
              { value: "all", label: "All", icon: Clock },
              { value: "IN_PERSON", label: "In-Clinic", icon: Building2 },
              { value: "VIDEO", label: "Video", icon: Video },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setModalityFilter(opt.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  modalityFilter === opt.value
                    ? "bg-emerald-600 text-white"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                <opt.icon className="size-3" />
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Service selector (if multiple services) */}
      {data && data.services.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Service:</span>
          <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-[220px]">
              <SelectValue placeholder="All services" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              {data.services.map((svc) => (
                <SelectItem key={svc.id} value={svc.id}>
                  {svc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-10 w-full rounded-md" />
              <div className="space-y-1.5">
                <Skeleton className="h-8 w-full rounded" />
                <Skeleton className="h-8 w-full rounded" />
                <Skeleton className="h-8 w-3/4 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="size-10 text-amber-500 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAvailability} className="cursor-pointer">
            <Loader2 className="size-3.5 mr-1.5" />
            Try Again
          </Button>
        </div>
      )}

      {/* Empty state (no slots this week) */}
      {!loading && !error && data && data.totalSlots === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No availability this week</p>
          <p className="text-xs text-muted-foreground mb-3">
            Try checking the next week for {providerName}&apos;s schedule.
          </p>
          <Button variant="outline" size="sm" onClick={goNextWeek} className="cursor-pointer">
            Next Week
            <ChevronRight className="size-3.5 ml-1" />
          </Button>
        </div>
      )}

      {/* Calendar grid */}
      {!loading && !error && data && data.totalSlots > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Day headers row */}
          <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
            {data.days.map((day) => (
              <div
                key={day.date}
                className={cn(
                  "py-2.5 px-1 text-center border-r border-border last:border-r-0",
                  day.isToday && "bg-emerald-50/80"
                )}
              >
                <p className={cn(
                  "text-[10px] font-medium uppercase tracking-wider",
                  day.isToday ? "text-emerald-700" : "text-muted-foreground"
                )}>
                  {day.dayName}
                </p>
                <p className={cn(
                  "text-sm font-bold mt-0.5",
                  day.isToday ? "text-emerald-700" : "text-foreground"
                )}>
                  {day.monthDay}
                </p>
              </div>
            ))}
          </div>

          {/* Slots grid */}
          <div className="grid grid-cols-7 min-h-[200px]">
            {data.days.map((day) => (
              <div
                key={day.date}
                className={cn(
                  "p-1.5 border-r border-border last:border-r-0 space-y-1.5",
                  day.isToday && "bg-emerald-50/30",
                  day.isPast && "bg-muted/20"
                )}
              >
                {day.isPast ? (
                  <p className="text-[10px] text-muted-foreground/50 text-center mt-4">
                    Past
                  </p>
                ) : day.slots.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/50 text-center mt-4">
                    —
                  </p>
                ) : (
                  day.slots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => handleSlotClick(slot)}
                      className={cn(
                        "w-full group relative rounded-lg border text-left transition-all duration-150 cursor-pointer",
                        "hover:shadow-md hover:scale-[1.02] hover:border-emerald-400",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1",
                        slot.modality === "VIDEO"
                          ? "border-blue-200 bg-blue-50/60 hover:bg-blue-50"
                          : "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50"
                      )}
                    >
                      <div className="px-2 py-1.5">
                        <p className={cn(
                          "text-xs font-semibold leading-tight",
                          slot.modality === "VIDEO" ? "text-blue-800" : "text-emerald-800"
                        )}>
                          {slot.timeLabel}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {slot.modality === "VIDEO" ? (
                            <Video className="size-2.5 text-blue-500" />
                          ) : (
                            <Building2 className="size-2.5 text-emerald-500" />
                          )}
                          <span className={cn(
                            "text-[9px] leading-none",
                            slot.modality === "VIDEO" ? "text-blue-500" : "text-emerald-500"
                          )}>
                            {slot.modality === "VIDEO" ? "Video" : "In-Clinic"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer: slot count */}
      {!loading && data && data.totalSlots > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {data.totalSlots} appointment{data.totalSlots !== 1 ? "s" : ""} available this week
        </p>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, addDays, subDays, parseISO, isToday, getMinutes, getHours, startOfToday } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  UserX,
  Building2,
  Video,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SLOT_STATUS, SLOT_MODALITY, APPOINTMENT_STATUS } from "@/lib/enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderInfo {
  id: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
}

interface AppointmentInfo {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  reasonForVisit: string;
  status: string;
  service: { id: string; name: string } | null;
}

interface SlotInfo {
  id: string;
  startTime: string;
  endTime: string;
  modality: string;
  status: string;
  provider: ProviderInfo;
  appointment: AppointmentInfo | null;
}

interface SlotsByHour {
  [hour: number]: SlotInfo[];
}

interface CalendarData {
  date: string;
  formattedDate: string;
  isToday: boolean;
  providers: ProviderInfo[];
  slots: SlotInfo[];
  slotsByHour: SlotsByHour;
  summary: {
    total: number;
    booked: number;
    available: number;
    blocked: number;
    checkedIn: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime12(iso: string): string {
  return format(parseISO(iso), "h:mm a");
}

function getMinuteOffset(iso: string): number {
  const d = parseISO(iso);
  return d.getMinutes();
}

function getHourFromIso(iso: string): number {
  return getHours(parseISO(iso));
}

function providerLabel(p: ProviderInfo): string {
  return `Dr. ${p.firstName} ${p.lastName}${p.credentials ? `, ${p.credentials}` : ""}`;
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

function SlotStatusBadge({ status }: { status: string }) {
  switch (status) {
    case APPOINTMENT_STATUS.BOOKED:
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
          <CheckCircle2 className="size-3 mr-1" />
          Booked
        </Badge>
      );
    case APPOINTMENT_STATUS.CHECKED_IN:
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">
          <Clock className="size-3 mr-1" />
          Checked In
        </Badge>
      );
    case APPOINTMENT_STATUS.COMPLETED:
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-[10px] px-1.5 py-0">
          Completed
        </Badge>
      );
    case APPOINTMENT_STATUS.CANCELLED:
      return (
        <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px] px-1.5 py-0">
          <XCircle className="size-3 mr-1" />
          Cancelled
        </Badge>
      );
    case APPOINTMENT_STATUS.NO_SHOW:
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
          <UserX className="size-3 mr-1" />
          No Show
        </Badge>
      );
    default:
      return null;
  }
}

function ModalityBadge({ modality }: { modality: string }) {
  if (modality === SLOT_MODALITY.VIDEO) {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0">
        <Video className="size-3 mr-1" />
        Video
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] px-1.5 py-0">
      <Building2 className="size-3 mr-1" />
      In-Clinic
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Slot Card Component
// ---------------------------------------------------------------------------

function SlotCard({ slot }: { slot: SlotInfo }) {
  const isBooked =
    slot.status === SLOT_STATUS.BOOKED ||
    slot.status === SLOT_STATUS.BOOKED_EXTERNALLY;
  const isAvailable = slot.status === SLOT_STATUS.AVAILABLE;
  const isBlocked =
    slot.status === SLOT_STATUS.BLOCKED || slot.status === SLOT_STATUS.CLOSED;
  const isLocked = slot.status === SLOT_STATUS.LOCKED;

  const startTime = formatTime12(slot.startTime);
  const endTime = formatTime12(slot.endTime);
  const minuteOffset = getMinuteOffset(slot.startTime);

  // Booked slot
  if (isBooked && slot.appointment) {
    return (
      <Card
        className={cn(
          "border rounded-lg shadow-sm transition-all duration-150 hover:shadow-md",
          "border-l-4",
          slot.appointment.status === APPOINTMENT_STATUS.CHECKED_IN
            ? "border-l-blue-500 bg-blue-50/40"
            : slot.appointment.status === APPOINTMENT_STATUS.COMPLETED
              ? "border-l-gray-400 bg-gray-50/40"
              : slot.appointment.status === APPOINTMENT_STATUS.CANCELLED
                ? "border-l-red-400 bg-red-50/30"
                : slot.appointment.status === APPOINTMENT_STATUS.NO_SHOW
                  ? "border-l-amber-400 bg-amber-50/30"
                  : "border-l-emerald-500 bg-white"
        )}
        style={{ marginTop: minuteOffset > 0 ? `${(minuteOffset / 60) * 100}%` : 0 }}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-semibold text-foreground">
                  {slot.appointment.patientName}
                </span>
                <ModalityBadge modality={slot.modality} />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>
                  {startTime} – {endTime}
                </span>
                <span className="text-border">|</span>
                <span className="truncate">
                  {slot.appointment.service?.name || slot.appointment.reasonForVisit}
                </span>
              </div>
              {slot.appointment.patientPhone && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {slot.appointment.patientPhone}
                </div>
              )}
            </div>
            <SlotStatusBadge status={slot.appointment.status} />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Available slot
  if (isAvailable) {
    return (
      <Card
        className="border border-emerald-200 bg-emerald-50/60 rounded-lg shadow-sm hover:shadow-md hover:bg-emerald-50 transition-all duration-150 cursor-pointer border-l-4 border-l-emerald-400"
        style={{ marginTop: minuteOffset > 0 ? `${(minuteOffset / 60) * 100}%` : 0 }}
      >
        <CardContent className="p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-emerald-700">
              {startTime} – {endTime}
            </span>
          </div>
          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full">
            Available
          </span>
        </CardContent>
      </Card>
    );
  }

  // Blocked / Closed slot
  if (isBlocked) {
    return (
      <div
        className="rounded-lg bg-gray-100 border border-gray-200 p-2.5 flex items-center justify-between"
        style={{ marginTop: minuteOffset > 0 ? `${(minuteOffset / 60) * 100}%` : 0 }}
      >
        <span className="text-xs text-gray-400 line-through">
          {startTime} – {endTime}
        </span>
        <Badge variant="outline" className="bg-gray-100 text-gray-400 border-gray-200 text-[10px] px-1.5 py-0">
          {slot.status === SLOT_STATUS.CLOSED ? "Closed" : "Blocked"}
        </Badge>
      </div>
    );
  }

  // Locked slot
  if (isLocked) {
    return (
      <div
        className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 flex items-center justify-between"
        style={{ marginTop: minuteOffset > 0 ? `${(minuteOffset / 60) * 100}%` : 0 }}
      >
        <span className="text-xs text-amber-600">
          {startTime} – {endTime}
        </span>
        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] px-1.5 py-0">
          <Clock className="size-3 mr-1" />
          Locked
        </Badge>
      </div>
    );
  }

  // Booked externally (no appointment object)
  if (slot.status === SLOT_STATUS.BOOKED_EXTERNALLY) {
    return (
      <Card
        className="border border-purple-200 bg-purple-50/40 rounded-lg shadow-sm border-l-4 border-l-purple-400"
        style={{ marginTop: minuteOffset > 0 ? `${(minuteOffset / 60) * 100}%` : 0 }}
      >
        <CardContent className="p-2.5 flex items-center justify-between">
          <span className="text-xs font-medium text-purple-700">
            {startTime} – {endTime}
          </span>
          <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 text-[10px] px-1.5 py-0">
            External
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Current Time Indicator
// ---------------------------------------------------------------------------

function CurrentTimeIndicator({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [position, setPosition] = useState<number | null>(null);

  useEffect(() => {
    function updatePosition() {
      const now = new Date();
      const hour = getHours(now);
      const minute = getMinutes(now);
      if (hour >= 7 && hour < 19) {
        const totalMinutes = (hour - 7) * 60 + minute;
        const rowHeight = 72; // Each hour row is 72px (h-18)
        setPosition(totalMinutes * (rowHeight / 60));
      } else {
        setPosition(null);
      }
    }

    updatePosition();
    const interval = setInterval(updatePosition, 60000);
    return () => clearInterval(interval);
  }, []);

  if (position === null) return null;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
      style={{ top: `${position}px` }}
    >
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shrink-0" />
      <div className="flex-1 h-[2px] bg-red-500" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function CalendarSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="rounded-xl border bg-white p-4 space-y-0">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 h-18 py-1">
            <Skeleton className="h-5 w-14 shrink-0 mt-1" />
            <Skeleton className="h-14 flex-1 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Calendar Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [providerId, setProviderId] = useState<string>("all");
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const fetchCalendar = useCallback(async (date: Date, pId: string) => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const params = new URLSearchParams({ date: dateStr });
      if (pId && pId !== "all") {
        params.set("providerId", pId);
      }
      const res = await fetch(`/api/staff/calendar?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load calendar");
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar(selectedDate, providerId);
  }, [selectedDate, providerId, fetchCalendar]);

  const goToPrevDay = () => setSelectedDate((d) => subDays(d, 1));
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(startOfToday());

  const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7..18

  // Scroll to current time on initial load
  useEffect(() => {
    if (data?.isToday && gridRef.current) {
      const now = new Date();
      const hour = getHours(now);
      if (hour >= 7 && hour < 19) {
        const rowHeight = 72;
        const scrollTarget = Math.max(0, (hour - 7) * rowHeight - 100);
        gridRef.current.scrollTo({ top: scrollTarget, behavior: "smooth" });
      }
    }
  }, [data?.isToday]);

  // --- Loading ---
  if (loading && !data) {
    return (
      <div className="max-w-5xl mx-auto">
        <CalendarSkeleton />
      </div>
    );
  }

  // --- Error ---
  if (error && !data) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <div className="size-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="size-6 text-red-600" />
            </div>
            <p className="text-sm font-medium text-red-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCalendar(selectedDate, providerId)}
              className="cursor-pointer"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { formattedDate, isToday: _isToday, providers, slotsByHour, summary } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-300">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-9 cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
            onClick={goToPrevDay}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "h-9 gap-2 font-semibold min-w-[220px] justify-start text-left cursor-pointer",
                  "hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                )}
              >
                <CalendarIcon className="size-4 text-emerald-600" />
                {formattedDate}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  if (d) {
                    setSelectedDate(d);
                    setCalendarOpen(false);
                  }
                }}
                className="rounded-lg border"
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            className="size-9 cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
            onClick={goToNextDay}
          >
            <ChevronRight className="size-4" />
          </Button>

          {!isToday(selectedDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-emerald-700 border-emerald-200"
            >
              Today
            </Button>
          )}
        </div>

        {/* Provider Filter */}
        {providers.length > 1 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <Users className="size-4 text-muted-foreground shrink-0" />
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger className="w-[200px] cursor-pointer hover:border-emerald-300">
                <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {providerLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ---- Summary Cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Booked</span>
            </div>
            <p className="text-2xl font-bold text-emerald-700">{summary.booked}</p>
          </CardContent>
        </Card>

        <Card className="border-sky-100 bg-gradient-to-br from-sky-50 to-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-7 rounded-lg bg-sky-100 flex items-center justify-center">
                <Clock className="size-3.5 text-sky-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Checked In</span>
            </div>
            <p className="text-2xl font-bold text-sky-700">{summary.checkedIn}</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <CalendarIcon className="size-3.5 text-amber-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Available</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">{summary.available}</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 bg-gradient-to-br from-gray-50 to-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-7 rounded-lg bg-gray-100 flex items-center justify-center">
                <XCircle className="size-3.5 text-gray-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Blocked</span>
            </div>
            <p className="text-2xl font-bold text-gray-600">{summary.blocked}</p>
          </CardContent>
        </Card>
      </div>

      {/* ---- Time Grid ---- */}
      <Card className="shadow-sm border overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={gridRef}
            className="relative max-h-[600px] overflow-y-auto custom-scrollbar"
          >
            {/* Current time indicator */}
            {_isToday && <CurrentTimeIndicator containerRef={gridRef} />}

            {hours.map((hour, idx) => {
              const hourSlots = slotsByHour[hour] || [];
              const timeLabel = format(new Date(2000, 0, 1, hour, 0), "h a");

              return (
                <div
                  key={hour}
                  className={cn(
                    "flex min-h-18",
                    idx % 2 === 0 ? "bg-white" : "bg-muted/20",
                    "border-b border-border/40 last:border-b-0"
                  )}
                >
                  {/* Time label column */}
                  <div className="w-16 sm:w-20 shrink-0 pt-2.5 pb-1 text-right pr-3">
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {timeLabel}
                    </span>
                  </div>

                  {/* Slot cards column */}
                  <div className="flex-1 py-1.5 pr-2 min-w-0">
                    {hourSlots.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {hourSlots.map((slot) => (
                          <SlotCard key={slot.id} slot={slot} />
                        ))}
                      </div>
                    ) : (
                      <div className="h-10 flex items-center">
                        <span className="text-[11px] text-muted-foreground/50 italic">
                          No slots
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* End of day */}
            <div className="flex min-h-10">
              <div className="w-16 sm:w-20 shrink-0 text-right pr-3 pt-2">
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  7 pm
                </span>
              </div>
              <div className="flex-1 border-l-2 border-dashed border-emerald-200 ml-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Footer info ---- */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground pb-2">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-emerald-200 border border-emerald-300" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-emerald-500" />
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-blue-400" />
          <span>Checked In</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-gray-300 border border-gray-400" />
          <span>Blocked / Closed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-purple-300 border border-purple-400" />
          <span>Booked Externally</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-full bg-red-500" />
          <span>Current Time</span>
        </div>
      </div>
    </div>
  );
}
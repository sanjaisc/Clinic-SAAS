"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  format,
  startOfWeek,
  addWeeks,
  subWeeks,
  parseISO,
  isToday,
  startOfToday,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Video,
  AlertCircle,
  Ban,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SLOT_STATUS, SLOT_MODALITY, APPOINTMENT_STATUS } from "@/lib/enums";
import { useToast } from "@/hooks/use-toast";

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

interface DayData {
  date: string;
  formattedDate: string;
  isToday: boolean;
  providers: ProviderInfo[];
  slots: SlotInfo[];
  summary: {
    total: number;
    booked: number;
    available: number;
    blocked: number;
    checkedIn: number;
  };
}

interface WeekSummary {
  booked: number;
  checkedIn: number;
  available: number;
  blocked: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime12(iso: string): string {
  return format(parseISO(iso), "h:mm a");
}

function providerLabel(p: ProviderInfo): string {
  return `Dr. ${p.firstName} ${p.lastName}${p.credentials ? `, ${p.credentials}` : ""}`;
}

function providerShortLabel(p: ProviderInfo): string {
  return `Dr. ${p.lastName}`;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------------------------------------------------------------------------
// Status color helpers
// ---------------------------------------------------------------------------

function getStatusColor(appointmentStatus: string) {
  switch (appointmentStatus) {
    case APPOINTMENT_STATUS.BOOKED:
      return {
        bg: "bg-brand-muted",
        border: "border-brand-border border-l-brand",
        text: "text-brand-hover",
        dot: "bg-brand-muted",
      };
    case APPOINTMENT_STATUS.CHECKED_IN:
      return {
        bg: "bg-amber-50",
        border: "border-amber-300 border-l-amber-500",
        text: "text-amber-700",
        dot: "bg-amber-500",
      };
    case APPOINTMENT_STATUS.COMPLETED:
      return {
        bg: "bg-gray-50",
        border: "border-gray-300 border-l-gray-400",
        text: "text-gray-500",
        dot: "bg-gray-400",
      };
    case APPOINTMENT_STATUS.CANCELLED:
      return {
        bg: "bg-red-50",
        border: "border-red-300 border-l-red-400",
        text: "text-red-600",
        dot: "bg-red-500",
      };
    case APPOINTMENT_STATUS.NO_SHOW:
      return {
        bg: "bg-gray-50",
        border: "border-gray-300 border-l-gray-400",
        text: "text-gray-500",
        dot: "bg-gray-400",
      };
    default:
      return {
        bg: "bg-white",
        border: "border-border",
        text: "text-foreground",
        dot: "bg-gray-300",
      };
  }
}

// ---------------------------------------------------------------------------
// Compact Appointment Card (for weekly cells)
// ---------------------------------------------------------------------------

const MAX_VISIBLE_CARDS = 3;

function AppointmentCard({ slot }: { slot: SlotInfo }) {
  if (!slot.appointment) return null;

  const appt = slot.appointment;
  const isBooked = slot.status === SLOT_STATUS.BOOKED || slot.status === SLOT_STATUS.BOOKED_EXTERNALLY;
  if (!isBooked) return null;

  const colors = getStatusColor(appt.status);
  const time = formatTime12(slot.startTime);
  const isVideo = slot.modality === SLOT_MODALITY.VIDEO;

  return (
    <div
      className={cn(
        "rounded-md border-l-3 px-2 py-1.5 text-[11px] leading-tight border border",
        colors.bg,
        colors.border,
        colors.text
      )}
    >
      <div className="flex items-center gap-1 font-semibold">
        <span className="tabular-nums">{time}</span>
        {isVideo && <Video className="size-3 shrink-0 text-brand" />}
      </div>
      <div className="truncate font-medium">{appt.patientName}</div>
      <div className="truncate text-[10px] opacity-75">
        {appt.service?.name || appt.reasonForVisit}
      </div>
    </div>
  );
}

function SlotCell({
  slots,
  providerId,
  onBlockSlots,
}: {
  slots: SlotInfo[];
  providerId: string;
  onBlockSlots: (providerId: string, date: string) => void;
}) {
  // Only show booked/externally booked slots as appointment cards
  const bookedSlots = slots.filter(
    (s) =>
      s.status === SLOT_STATUS.BOOKED || s.status === SLOT_STATUS.BOOKED_EXTERNALLY
  );

  if (bookedSlots.length === 0) {
    return (
      <div
        className="min-h-[60px] flex items-center justify-center cursor-pointer rounded-md border border-dashed border-transparent hover:border-muted-foreground/30 hover:bg-muted/20 transition-colors group"
        onClick={() => {
          if (slots.length > 0) {
            const date = format(parseISO(slots[0].startTime), "yyyy-MM-dd");
            onBlockSlots(providerId, date);
          }
        }}
      >
        <Plus className="size-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      </div>
    );
  }

  const visibleSlots = bookedSlots.slice(0, MAX_VISIBLE_CARDS);
  const remaining = bookedSlots.length - MAX_VISIBLE_CARDS;

  const dateStr = slots.length > 0 ? format(parseISO(slots[0].startTime), "yyyy-MM-dd") : "";

  return (
    <div
      className="space-y-1.5 cursor-pointer rounded-md hover:ring-2 hover:ring-brand/20 transition-all p-1 -m-1"
      onClick={() => onBlockSlots(providerId, dateStr)}
    >
      {visibleSlots.map((slot) => (
        <AppointmentCard key={slot.id} slot={slot} />
      ))}
      {remaining > 0 && (
        <button
          className="text-[11px] font-medium text-brand hover:text-brand-hover hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          +{remaining} more
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block Slots Modal
// ---------------------------------------------------------------------------

interface BlockModalState {
  open: boolean;
  providerId: string;
  date: string;
}

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = i;
  const label = format(new Date(2000, 0, 1, h, 0), "h:mm a");
  return { value: `${h.toString().padStart(2, "0")}:00`, label };
});

function BlockSlotsModal({
  modal,
  onClose,
  providers,
  onSuccess,
}: {
  modal: BlockModalState;
  onClose: () => void;
  providers: ProviderInfo[];
  onSuccess: () => void;
}) {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Reset form when modal opens
  useEffect(() => {
    if (modal.open) {
      setStartTime("09:00");
      setEndTime("12:00");
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [modal.open]);

  if (!modal.open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal.providerId || !modal.date) return;
    if (startTime >= endTime) {
      setError("End time must be after start time");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/slots/block-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: modal.providerId,
          date: modal.date,
          startTime,
          endTime,
          reason: reason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to block slots");
      }
      const json = await res.json();
      toast({
        title: "Slots Blocked",
        description: `${json.blockedCount} slot(s) blocked successfully.`,
      });
      onClose();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProvider = providers.find((p) => p.id === modal.providerId);
  const dateDisplay = modal.date ? format(parseISO(modal.date), "EEE, MMM d, yyyy") : "";

  return (
    <Dialog open={modal.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="size-5 text-amber-600" />
            Block Time Slots
          </DialogTitle>
          <DialogDescription>
            Block all available slots within a time range for a provider.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider */}
          <div className="space-y-2">
            <Label htmlFor="block-provider">Provider</Label>
            <Select
              value={modal.providerId}
              onValueChange={(val) => {
                // Update modal provider
              }}
            >
              <SelectTrigger id="block-provider" className="cursor-pointer">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {selectedProvider ? (
                  <SelectItem value={selectedProvider.id}>
                    {providerLabel(selectedProvider)}
                  </SelectItem>
                ) : (
                  providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {providerLabel(p)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="block-date">Date</Label>
            <Input
              id="block-date"
              value={dateDisplay}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Start / End Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="block-start">Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger id="block-start" className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-end">End Time</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger id="block-end" className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="block-reason">
              Reason <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="block-reason"
              placeholder="e.g., Lunch break, Meeting"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
            >
              {submitting ? "Blocking…" : "Block Slots"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function CalendarSkeleton() {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-9 w-[200px] ml-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Calendar Page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(startOfToday(), { weekStartsOn: 1 })
  );
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [weekData, setWeekData] = useState<DayData[] | null>(null);
  const [allProviders, setAllProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Block modal state
  const [blockModal, setBlockModal] = useState<BlockModalState>({
    open: false,
    providerId: "",
    date: "",
  });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addWeeks(weekStart, 0) && new Date(weekStart.getTime() + i * 86400000)),
    [weekStart]
  );

  // Fetch all 7 days in parallel
  const fetchWeek = useCallback(
    async (start: Date, pFilter: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = pFilter && pFilter !== "all" ? `&providerId=${pFilter}` : "";
        const promises = weekDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          return fetch(`/api/staff/calendar?date=${dateStr}${params}`).then((res) => {
            if (!res.ok) throw new Error("Failed to load");
            return res.json() as Promise<DayData>;
          });
        });
        const results = await Promise.all(promises);
        setWeekData(results);
        if (results.length > 0 && results[0].providers.length > 0) {
          setAllProviders(results[0].providers);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [weekDays]
  );

  useEffect(() => {
    fetchWeek(weekStart, providerFilter);
  }, [weekStart, providerFilter, fetchWeek]);

  const goToPrevWeek = () => setWeekStart((d) => subWeeks(d, 1));
  const goToNextWeek = () => setWeekStart((d) => addWeeks(d, 1));
  const goToToday = () => setWeekStart(startOfWeek(startOfToday(), { weekStartsOn: 1 }));

  const isCurrentWeek = (() => {
    const current = startOfWeek(startOfToday(), { weekStartsOn: 1 });
    return format(weekStart, "yyyy-MM-dd") === format(current, "yyyy-MM-dd");
  })();

  const weekRangeLabel = (() => {
    const start = weekDays[0];
    const end = weekDays[6];
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
    }
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  })();

  // Aggregate week summary
  const weekSummary: WeekSummary = useMemo(() => {
    if (!weekData) return { booked: 0, checkedIn: 0, available: 0, blocked: 0 };
    return weekData.reduce(
      (acc, day) => ({
        booked: acc.booked + day.summary.booked,
        checkedIn: acc.checkedIn + day.summary.checkedIn,
        available: acc.available + day.summary.available,
        blocked: acc.blocked + day.summary.blocked,
      }),
      { booked: 0, checkedIn: 0, available: 0, blocked: 0 }
    );
  }, [weekData]);

  // Build provider×day matrix
  const matrixData = useMemo(() => {
    if (!weekData || allProviders.length === 0) return { providers: [], cells: {} as Record<string, SlotInfo[]> };

    const filteredProviders =
      providerFilter && providerFilter !== "all"
        ? allProviders.filter((p) => p.id === providerFilter)
        : allProviders;

    const cells: Record<string, SlotInfo[]> = {};
    for (const day of weekData) {
      for (const provider of filteredProviders) {
        const key = `${provider.id}|${day.date}`;
        cells[key] = day.slots.filter((s) => s.providerId === provider.id);
      }
    }

    return { providers: filteredProviders, cells };
  }, [weekData, allProviders, providerFilter]);

  const openBlockModal = (providerId: string, date: string) => {
    setBlockModal({ open: true, providerId, date });
  };

  const closeBlockModal = () => {
    setBlockModal({ open: false, providerId: "", date: "" });
  };

  // --- Loading ---
  if (loading && !weekData) {
    return (
      <div className="max-w-7xl mx-auto">
        <CalendarSkeleton />
      </div>
    );
  }

  // --- Error ---
  if (error && !weekData) {
    return (
      <div className="max-w-7xl mx-auto">
        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <div className="size-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="size-6 text-red-600" />
            </div>
            <p className="text-sm font-medium text-red-700">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchWeek(weekStart, providerFilter)}
              className="cursor-pointer"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!weekData) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-5 animate-in fade-in duration-300">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-lg font-bold text-foreground">Calendar</h1>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-9 cursor-pointer hover:bg-brand-muted hover:text-brand-hover hover:border-brand-border"
            onClick={goToPrevWeek}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="min-w-[200px] text-center">
            <span className="text-sm font-semibold text-foreground px-3 py-1.5 rounded-lg border bg-white">
              {weekRangeLabel}
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="size-9 cursor-pointer hover:bg-brand-muted hover:text-brand-hover hover:border-brand-border"
            onClick={goToNextWeek}
          >
            <ChevronRight className="size-4" />
          </Button>

          {!isCurrentWeek && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="cursor-pointer hover:bg-brand-muted hover:text-brand-hover hover:border-brand-border text-brand-hover border-brand-border"
            >
              Today
            </Button>
          )}
        </div>

        {/* Provider Filter */}
        {allProviders.length > 1 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <Users className="size-4 text-muted-foreground shrink-0" />
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-[220px] cursor-pointer hover:border-brand-border">
                <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {allProviders.map((p) => (
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
        <Card className="border-brand-muted bg-gradient-to-br from-brand-muted to-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-7 rounded-lg bg-brand-subtle flex items-center justify-center">
                <CheckCircle2 className="size-3.5 text-brand" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Booked</span>
            </div>
            <p className="text-2xl font-bold text-brand-hover">{weekSummary.booked}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">this week</p>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="size-3.5 text-amber-600" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Checked In</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">{weekSummary.checkedIn}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">this week</p>
          </CardContent>
        </Card>

        <Card className="border-lavender-border bg-gradient-to-br from-lavender-muted to-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-7 rounded-lg bg-lavender-muted flex items-center justify-center">
                <CheckCircle2 className="size-3.5 text-lavender-hover" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Available</span>
            </div>
            <p className="text-2xl font-bold text-lavender">{weekSummary.available}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">this week</p>
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
            <p className="text-2xl font-bold text-gray-600">{weekSummary.blocked}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">this week</p>
          </CardContent>
        </Card>
      </div>

      {/* ---- Weekly Grid ---- */}
      <Card className="shadow-sm border overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto custom-scrollbar">
            <div className="min-w-[800px]">
              {/* Header Row */}
              <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b bg-muted/40">
                {/* Provider header */}
                <div className="p-3 font-semibold text-xs text-muted-foreground uppercase tracking-wider border-r flex items-center">
                  <Users className="size-3.5 mr-1.5" />
                  Provider
                </div>
                {/* Day headers */}
                {weekDays.map((day, idx) => {
                  const today = isToday(day);
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "p-3 text-center border-r last:border-r-0",
                        today && "bg-brand-muted"
                      )}
                    >
                      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        {DAY_NAMES[idx]}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-bold tabular-nums mt-0.5",
                          today ? "text-brand-hover" : "text-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      {today && (
                        <Badge className="bg-brand text-white text-[9px] px-1.5 py-0 mt-1 hover:bg-brand">
                          Today
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Provider Rows */}
              {matrixData.providers.length === 0 && (
                <div className="p-12 text-center text-muted-foreground text-sm">
                  No providers found for this clinic.
                </div>
              )}

              {matrixData.providers.map((provider, pIdx) => (
                <div
                  key={provider.id}
                  className={cn(
                    "grid grid-cols-[200px_repeat(7,1fr)] border-b last:border-b-0",
                    pIdx % 2 === 1 && "bg-muted/20"
                  )}
                >
                  {/* Provider name (sticky) */}
                  <div className="p-3 border-r bg-white z-10 flex items-start sticky left-0">
                    <div>
                      <div className="text-sm font-semibold text-foreground leading-tight">
                        {providerLabel(provider)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {providerShortLabel(provider)}
                      </div>
                    </div>
                  </div>

                  {/* Day cells */}
                  {weekDays.map((day, dIdx) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const key = `${provider.id}|${dateStr}`;
                    const slots = matrixData.cells[key] || [];
                    const today = isToday(day);

                    return (
                      <div
                        key={dIdx}
                        className={cn(
                          "p-2 border-r last:border-r-0 min-h-[80px]",
                          today && "bg-brand-muted/30"
                        )}
                        onClick={() => openBlockModal(provider.id, dateStr)}
                      >
                        <SlotCell
                          slots={slots}
                          providerId={provider.id}
                          onBlockSlots={openBlockModal}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- Legend ---- */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground pb-2">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm border-l-3 border-l-brand bg-brand-muted border border-brand-border" />
          <span>Booked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm border-l-3 border-l-amber-500 bg-amber-50 border border-amber-300" />
          <span>Checked In</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm border-l-3 border-l-gray-400 bg-gray-50 border border-gray-300" />
          <span>Completed / No Show</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm border-l-3 border-l-red-400 bg-red-50 border border-red-300" />
          <span>Cancelled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Video className="size-3 text-brand" />
          <span>Video Visit</span>
        </div>
      </div>

      {/* ---- Block Slots Modal ---- */}
      <BlockSlotsModal
        modal={blockModal}
        onClose={closeBlockModal}
        providers={allProviders}
        onSuccess={() => fetchWeek(weekStart, providerFilter)}
      />
    </div>
  );
}
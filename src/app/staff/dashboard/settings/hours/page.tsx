"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import {
  Clock,
  Plus,
  Trash2,
  Save,
  CalendarOff,
  Edit3,
  X,
  CalendarDays,
  Copy,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DoctASessionUser } from "@/lib/auth";
import { useActiveClinicId } from "@/components/active-clinic-context";
import { DAYS_OF_WEEK } from "@/lib/enums";

// ---- Types ----
interface TimeRange {
  open: string;
  close: string;
}

interface DayHours {
  isOpen: boolean;
  ranges: TimeRange[];
}

type WeeklyHours = Record<string, DayHours>;

interface Closure {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdAt: string;
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

function getDefaultWeeklyHours(): WeeklyHours {
  const hours: WeeklyHours = {};
  for (const day of DAY_KEYS) {
    hours[day] = { isOpen: day !== "sun", ranges: [{ open: "09:00", close: "17:00" }] };
  }
  return hours;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isUpcoming(startDateStr: string, endDateStr: string): boolean {
  const today = new Date(new Date().toDateString());
  return new Date(endDateStr) >= today;
}

// ---- Main Component ----
export default function HoursPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const clinicId = useActiveClinicId(user?.clinicId ?? null);

  // Hours state
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(getDefaultWeeklyHours());
  const [originalHours, setOriginalHours] = useState<WeeklyHours>({});
  const [hoursLoading, setHoursLoading] = useState(true);
  const [hoursSaving, setHoursSaving] = useState(false);

  // Closures state
  const [closures, setClosures] = useState<Closure[]>([]);
  const [closuresLoading, setClosuresLoading] = useState(true);

  // Error state
  const [loadError, setLoadError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingClosureId, setDeletingClosureId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Dialog state
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState<Closure | null>(null);
  const [closureTitle, setClosureTitle] = useState("");
  const [closureStart, setClosureStart] = useState("");
  const [closureEnd, setClosureEnd] = useState("");
  const [closureIsRecurring, setClosureIsRecurring] = useState(false);
  const [closureRecurrence, setClosureRecurrence] = useState("YEARLY");
  const [closureSaving, setClosureSaving] = useState(false);

  const fetchHours = useCallback(async () => {
    try {
      setHoursLoading(true);
      const res = await fetch(`/api/staff/hours?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed to load hours");
      const data = await res.json();
      const parsed: WeeklyHours = data.hoursOfOperation || {};
      // Normalize to our format
      const normalized = getDefaultWeeklyHours();
      for (const day of DAY_KEYS) {
        if (parsed[day]) {
          if (typeof parsed[day] === "object" && !Array.isArray(parsed[day])) {
            const d = parsed[day] as { isOpen?: boolean; ranges?: TimeRange[]; open?: string; close?: string };
            normalized[day].isOpen = d.isOpen !== false;
            if (d.ranges && Array.isArray(d.ranges)) {
              normalized[day].ranges = d.ranges;
            } else if (d.open && d.close) {
              normalized[day].ranges = [{ open: d.open, close: d.close }];
            }
          }
        }
      }
      setWeeklyHours(normalized);
      setOriginalHours(JSON.parse(JSON.stringify(normalized)));
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to load operating hours";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setHoursLoading(false);
    }
  }, [clinicId]);

  const fetchClosures = useCallback(async () => {
    try {
      setClosuresLoading(true);
      const res = await fetch(`/api/staff/closures?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed to load closures");
      const data = await res.json();
      setClosures(data.closures || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load closures");
    } finally {
      setClosuresLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    if (clinicId) {
      fetchHours();
      fetchClosures();
    }
  }, [clinicId, fetchHours, fetchClosures]);

  // Hours handlers
  const toggleDay = (day: string) => {
    setWeeklyHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], isOpen: !prev[day].isOpen },
    }));
  };

  const updateRange = (day: string, rangeIdx: number, field: "open" | "close", value: string) => {
    setWeeklyHours((prev) => {
      const newRanges = [...prev[day].ranges];
      newRanges[rangeIdx] = { ...newRanges[rangeIdx], [field]: value };
      return { ...prev, [day]: { ...prev[day], ranges: newRanges } };
    });
  };

  const addRange = (day: string) => {
    setWeeklyHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        ranges: [...prev[day].ranges, { open: "09:00", close: "12:00" }],
      },
    }));
  };

  const removeRange = (day: string, rangeIdx: number) => {
    setWeeklyHours((prev) => {
      const newRanges = prev[day].ranges.filter((_, i) => i !== rangeIdx);
      return { ...prev, [day]: { ...prev[day], ranges: newRanges } };
    });
  };

  const hasHoursChanged = () => {
    return JSON.stringify(weeklyHours) !== JSON.stringify(originalHours);
  };

  const saveHours = async () => {
    // Validate: no open time before close time within any range
    for (const [day, data] of Object.entries(weeklyHours)) {
      if (!data.isOpen) continue;
      for (let i = 0; i < data.ranges.length; i++) {
        const range = data.ranges[i];
        if (range.open >= range.close) {
          toast.error(`${day}: Close time must be after open time in range ${i + 1}`);
          return;
        }
      }
      // Check for overlapping ranges
      for (let i = 0; i < data.ranges.length; i++) {
        for (let j = i + 1; j < data.ranges.length; j++) {
          const a = data.ranges[i];
          const b = data.ranges[j];
          if (a.open < b.close && b.open < a.close) {
            toast.error(`${day}: Time ranges ${i + 1} and ${j + 1} overlap`);
            return;
          }
        }
      }
    }
    try {
      setHoursSaving(true);
      const res = await fetch(`/api/staff/hours?clinicId=${clinicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hoursOfOperation: weeklyHours }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Operating hours saved");
      setOriginalHours(JSON.parse(JSON.stringify(weeklyHours)));
    } catch {
      toast.error("Failed to save operating hours");
    } finally {
      setHoursSaving(false);
    }
  };

  // Closure handlers
  const openAddClosure = () => {
    setEditingClosure(null);
    setClosureTitle("");
    setClosureStart("");
    setClosureEnd("");
    setClosureIsRecurring(false);
    setClosureRecurrence("YEARLY");
    setClosureDialogOpen(true);
  };

  const openEditClosure = (closure: Closure) => {
    setEditingClosure(closure);
    setClosureTitle(closure.title);
    setClosureStart(closure.startDate.split("T")[0]);
    setClosureEnd(closure.endDate.split("T")[0]);
    setClosureIsRecurring(closure.isRecurring);
    setClosureRecurrence(closure.recurrenceRule || "YEARLY");
    setClosureDialogOpen(true);
  };

  const saveClosure = async () => {
    if (!closureTitle || !closureStart || !closureEnd) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      setClosureSaving(true);
      const body = {
        title: closureTitle,
        startDate: closureStart,
        endDate: closureEnd,
        isRecurring: closureIsRecurring,
        recurrenceRule: closureIsRecurring ? closureRecurrence : null,
      };

      if (editingClosure) {
        const res = await fetch(
          `/api/staff/closures/${editingClosure.id}?clinicId=${clinicId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Closure updated");
      } else {
        const res = await fetch(`/api/staff/closures?clinicId=${clinicId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to create");
        toast.success("Closure created");
      }

      setClosureDialogOpen(false);
      fetchClosures();
    } catch {
      toast.error("Failed to save closure");
    } finally {
      setClosureSaving(false);
    }
  };

  const confirmDeleteClosure = (id: string) => {
    setDeletingClosureId(id);
    setDeleteConfirmOpen(true);
  };

  const deleteClosure = async () => {
    if (!deletingClosureId) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(
        `/api/staff/closures/${deletingClosureId}?clinicId=${clinicId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Closure deleted");
      setDeleteConfirmOpen(false);
      setDeletingClosureId(null);
      fetchClosures();
    } catch {
      toast.error("Failed to delete closure");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ---- Error State ----
  if (loadError) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="size-8 text-destructive" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">Failed to load hours</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-md">{loadError}</p>
          </div>
          <Button variant="outline" onClick={() => { setLoadError(null); fetchHours(); fetchClosures(); }} className="gap-2">
            <RefreshCw className="size-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb items={[{ label: "Settings" }, { label: "Hours & Closures" }]} />
      {/* Card 1: Weekly Operating Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-brand-muted ">
                <Clock className="size-5 text-brand" />
              </div>
              <div>
                <CardTitle className="text-lg">Weekly Operating Hours</CardTitle>
                <CardDescription>
                  Define regular hours for each day of the week
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={saveHours}
              disabled={hoursSaving || !hasHoursChanged()}
              size="sm"
            >
              <Save className="size-4 mr-1.5" />
              {hoursSaving ? "Saving..." : "Save Hours"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {hoursLoading ? (
            <div className="space-y-3">
              {[...Array(7)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {DAY_KEYS.map((day) => {
                const dayData = weeklyHours[day];
                return (
                  <div
                    key={day}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 py-3 px-3 rounded-lg border ${
                      dayData.isOpen
                        ? "border-border bg-background"
                        : "border-border/50 bg-muted/30"
                    }`}
                  >
                    {/* Day label + toggle */}
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <Switch
                        checked={dayData.isOpen}
                        onCheckedChange={() => toggleDay(day)}
                      />
                      <span
                        className={`text-sm font-medium w-10 ${
                          dayData.isOpen ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </span>
                      {!dayData.isOpen && (
                        <Badge variant="secondary" className="text-xs">
                          Closed
                        </Badge>
                      )}
                    </div>

                    {/* Time ranges */}
                    {dayData.isOpen && (
                      <div className="flex-1 flex flex-col gap-2 ml-0 sm:ml-4">
                        {dayData.ranges.map((range, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={range.open}
                              aria-label={`Open time for ${DAY_LABELS[day]}, range ${idx + 1}`}
                              onChange={(e) =>
                                updateRange(day, idx, "open", e.target.value)
                              }
                              className="w-32 h-9 text-sm"
                            />
                            <span className="text-muted-foreground text-sm">to</span>
                            <Input
                              type="time"
                              value={range.close}
                              aria-label={`Close time for ${DAY_LABELS[day]}, range ${idx + 1}`}
                              onChange={(e) =>
                                updateRange(day, idx, "close", e.target.value)
                              }
                              className="w-32 h-9 text-sm"
                            />
                            {dayData.ranges.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                                onClick={() => removeRange(day, idx)}
                              >
                                <X className="size-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-fit text-xs h-7"
                          onClick={() => addRange(day)}
                        >
                          <Plus className="size-3 mr-1" />
                          Add Range
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Clinic Closures */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-amber-50 dark:bg-amber-950/50">
                <CalendarOff className="size-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Clinic Closures</CardTitle>
                <CardDescription>
                  Manage holidays and one-off closures
                </CardDescription>
              </div>
            </div>
            <Button onClick={openAddClosure} size="sm">
              <Plus className="size-4 mr-1.5" />
              Add Closure
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {closuresLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : closures.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No closures configured</p>
              <p className="text-xs mt-1">
                Add holidays or one-off closures to block booking
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {closures.map((closure) => {
                const upcoming = isUpcoming(closure.startDate, closure.endDate);
                return (
                  <div
                    key={closure.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      upcoming
                        ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`size-2 rounded-full flex-shrink-0 ${
                          upcoming ? "bg-amber-500" : "bg-muted-foreground/30"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-medium truncate ${
                              upcoming
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {closure.title}
                          </p>
                          {closure.isRecurring && (
                            <Badge
                              variant="outline"
                              className="text-xs text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/50"
                            >
                              {closure.recurrenceRule || "Recurring"}
                            </Badge>
                          )}
                          {!upcoming && (
                            <Badge variant="secondary" className="text-xs">
                              Past
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(closure.startDate)}
                          {closure.startDate !== closure.endDate &&
                            ` — ${formatDate(closure.endDate)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEditClosure(closure)}
                      >
                        <Edit3 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => confirmDeleteClosure(closure.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Closure</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this clinic closure? This action cannot
              be undone and will re-open those dates for booking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteClosure}
              disabled={deleteLoading}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Closure Dialog */}
      <Dialog open={closureDialogOpen} onOpenChange={setClosureDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClosure ? "Edit Closure" : "Add Closure"}
            </DialogTitle>
            <DialogDescription>
              {editingClosure
                ? "Update the closure details below."
                : "Create a new closure to block bookings."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="closure-title">Title *</Label>
              <Input
                id="closure-title"
                placeholder="e.g., Christmas Holiday"
                value={closureTitle}
                onChange={(e) => setClosureTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="closure-start">Start Date *</Label>
                <Input
                  id="closure-start"
                  type="date"
                  value={closureStart}
                  onChange={(e) => setClosureStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closure-end">End Date *</Label>
                <Input
                  id="closure-end"
                  type="date"
                  value={closureEnd}
                  onChange={(e) => setClosureEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Recurring</Label>
                <p className="text-xs text-muted-foreground">
                  Repeats annually on these dates
                </p>
              </div>
              <Switch
                checked={closureIsRecurring}
                onCheckedChange={setClosureIsRecurring}
              />
            </div>
            {closureIsRecurring && (
              <div className="space-y-2">
                <Label>Recurrence Rule</Label>
                <Select value={closureRecurrence} onValueChange={setClosureRecurrence}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClosureDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={saveClosure} disabled={closureSaving}>
              {closureSaving
                ? "Saving..."
                : editingClosure
                  ? "Update Closure"
                  : "Create Closure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
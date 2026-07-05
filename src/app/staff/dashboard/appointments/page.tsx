"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Search,
  Calendar,
  MoreHorizontal,
  Eye,
  UserCheck,
  CheckCircle2,
  XCircle,
  UserX,
  Clock,
  Phone,
  Mail,
  User,
  FileText,
  CreditCard,
  Shield,
  Baby,
  Send,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Loader2,
  CalendarDays,
  StickyNote,
  DollarSign,
  Hash,
  Bell,
  QrCode,
} from "lucide-react";
import { QrCodeDisplay } from "@/components/qr-code-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";

// =============================================================================
// Types
// =============================================================================

interface AppointmentRow {
  id: string;
  patientName: string;
  patientDob: string;
  patientPhone: string;
  patientEmail: string;
  patientType: string;
  guardianName: string | null;
  guardianRelation: string | null;
  reasonForVisit: string;
  modality: string;
  startTime: string;
  endTime: string;
  status: string;
  isDemoInsurance: boolean;
  depositCents: number;
  selfPayCents: number;
  paymentStatus: string;
  paymentMethod: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  intakeCompleted: boolean;
  insuranceVerified: boolean;
  createdAt: string;
  provider: { id: string; firstName: string; lastName: string; credentials: string | null };
  service: { id: string; name: string };
  slot: { id: string; modality: string; status: string };
  insurance: { id: string; name: string; isDemo: boolean } | null;
}

interface AppointmentDetail extends AppointmentRow {
  specialty: { id: string; name: string };
  clinic: { id: string; name: string; phoneNumber: string };
  ledger: {
    id: string;
    type: string;
    amountCents: number;
    description: string | null;
    paymentStatus: string | null;
    processedBy: string | null;
    createdAt: string;
  } | null;
  tokens: {
    id: string;
    purpose: string;
    createdAt: string;
    expiresAt: string;
    consumedAt: string | null;
  }[];
  notes: NoteItem[];
  validTransitions: string[];
}

interface NoteItem {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; role: string } | null;
}

interface ProviderOption {
  id: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
}

interface WaitlistRow {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientType: string;
  preferredModality: string | null;
  status: string;
  contactCount: number;
  lastContactAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  providerName: string;
  specialtyName: string;
}

// =============================================================================
// Status Helpers
// =============================================================================

const STATUS_STYLES: Record<string, string> = {
  BOOKED: "bg-blue-100 text-blue-700 border-blue-200",
  CHECKED_IN: "bg-amber-100 text-amber-700 border-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  NO_SHOW: "bg-gray-100 text-gray-600 border-gray-200",
  ARCHIVED: "bg-muted text-muted-foreground border-muted",
};

const STATUS_LABELS: Record<string, string> = {
  BOOKED: "Booked",
  CHECKED_IN: "Checked In",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
  ARCHIVED: "Archived",
};

const TRANSITION_LABELS: Record<string, string> = {
  CHECKED_IN: "Check In",
  COMPLETED: "Complete",
  CANCELLED: "Cancel",
  NO_SHOW: "No Show",
  ARCHIVED: "Archive",
};

const TRANSITION_ICONS: Record<string, React.ReactNode> = {
  CHECKED_IN: <UserCheck className="size-3.5" />,
  COMPLETED: <CheckCircle2 className="size-3.5" />,
  CANCELLED: <XCircle className="size-3.5" />,
  NO_SHOW: <UserX className="size-3.5" />,
  ARCHIVED: <FileText className="size-3.5" />,
};

// =============================================================================
// Component
// =============================================================================

export default function AppointmentsPage() {
  const { data: session } = useSession();
  const clinicId = session?.user?.clinicId as string | undefined;

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  // Data
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Providers
  const [providers, setProviders] = useState<ProviderOption[]>([]);

  // Detail dialog
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Notes
  const [noteContent, setNoteContent] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Status transition
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  // QR Code dialog
  const [qrAppointmentId, setQrAppointmentId] = useState<string | null>(null);
  const [qrPatientName, setQrPatientName] = useState<string | undefined>(undefined);

  // View mode: appointments or waitlist
  const [viewMode, setViewMode] = useState<"appointments" | "waitlist">("appointments");

  // Waitlist data
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistRow[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [waitlistActionId, setWaitlistActionId] = useState<string | null>(null);

  // Build query params
  const buildQuery = useCallback(
    (overrides?: { pageOverride?: number }) => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (search) params.set("search", search);
      if (providerFilter) params.set("providerId", providerFilter);
      params.set("page", String(overrides?.pageOverride ?? page));
      params.set("limit", "20");
      if (clinicId) params.set("clinicId", clinicId);
      return params.toString();
    },
    [statusFilter, dateFrom, dateTo, search, providerFilter, page, clinicId]
  );

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/appointments?${buildQuery()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch appointments");
      }
      const data = await res.json();
      setAppointments(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  // Fetch providers
  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      try {
        const res = await fetch(`/api/taxonomies?clinicId=${clinicId}&include=providers`);
        if (res.ok) {
          // Providers come from the dashboard or we use a simpler approach
        }
      } catch {
        // non-critical
      }
    })();
  }, [clinicId]);

  // Track previous filter values to detect non-page filter changes
  const prevFiltersRef = useRef({ statusFilter, dateFrom, dateTo, search, providerFilter });

  // Single effect: fetch appointments on any dependency change, reset page on filter change
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filterChanged =
      prev.statusFilter !== statusFilter ||
      prev.dateFrom !== dateFrom ||
      prev.dateTo !== dateTo ||
      prev.search !== search ||
      prev.providerFilter !== providerFilter;
    prevFiltersRef.current = { statusFilter, dateFrom, dateTo, search, providerFilter };

    if (filterChanged) {
      setPage(1);
      // fetchAppointments will re-run with page=1 via the dependency update below
      return;
    }
    fetchAppointments();
  }, [statusFilter, dateFrom, dateTo, search, providerFilter, page, fetchAppointments]);

  // Fetch providers for the clinic
  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      try {
        const res = await fetch(`/api/staff/dashboard?clinicId=${clinicId}`);
        if (res.ok) {
          const data = await res.json();
          // We need a provider list - let's fetch from appointments
          // Actually, let's use the taxonomies endpoint or a separate query
          // For now, we'll extract unique providers from the dashboard data
        }
      } catch {
        // non-critical
      }
      // Fallback: fetch providers from the clinic via search/taxonomies
      try {
        const res = await fetch(
          `/api/search/providers?specialty=&patientType=ADULT&lat=40.758&lng=-73.985&radius=50&limit=50`
        );
        if (res.ok) {
          const data = await res.json();
          const allProviders = (data.providers || []).map(
            (p: Record<string, unknown>) => ({
              id: p.id as string,
              firstName: (p.firstName as string) || "",
              lastName: (p.lastName as string) || "",
              credentials: (p.credentials as string) || null,
            })
          );
          // Filter by clinic if possible
          setProviders(allProviders);
        }
      } catch {
        // non-critical
      }
    })();
  }, [clinicId]);

  // Open detail dialog
  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    setNoteContent("");
    try {
      const res = await fetch(`/api/staff/appointments/${id}`);
      if (!res.ok) throw new Error("Failed to load appointment");
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Status transition
  const handleTransition = async (appointmentId: string, newStatus: string) => {
    setTransitioningId(appointmentId);
    try {
      const res = await fetch(`/api/staff/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update status");
      }
      // Refresh list
      fetchAppointments();
      // Refresh detail if open
      if (selectedId === appointmentId) {
        openDetail(appointmentId);
      }
      const statusLabels: Record<string, string> = {
        CHECKED_IN: "checked in",
        COMPLETED: "marked as completed",
        CANCELLED: "cancelled",
        NO_SHOW: "marked as no-show",
      };
      toast.success(`Appointment ${statusLabels[newStatus] || "updated"}`, {
        description: `Patient: ${currentAppointment?.patientName || "Unknown"}`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setTransitioningId(null);
    }
  };

  // Add note
  const handleAddNote = async () => {
    if (!selectedId || !noteContent.trim()) return;
    setNoteSubmitting(true);
    try {
      const res = await fetch(`/api/staff/appointments/${selectedId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNoteContent("");
      // Refresh detail
      openDetail(selectedId);
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setNoteSubmitting(false);
    }
  };

  // Fetch waitlist entries
  const fetchWaitlist = useCallback(async () => {
    if (!clinicId) return;
    setWaitlistLoading(true);
    setWaitlistError(null);
    try {
      const res = await fetch(`/api/staff/waitlist?clinicId=${clinicId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch waitlist");
      }
      const data = await res.json();
      setWaitlistEntries(data.data || []);
    } catch (err) {
      setWaitlistError(err instanceof Error ? err.message : "Failed to fetch waitlist");
    } finally {
      setWaitlistLoading(false);
    }
  }, [clinicId]);

  // Fetch waitlist when view mode changes
  useEffect(() => {
    if (viewMode === "waitlist") {
      fetchWaitlist();
    }
  }, [viewMode, fetchWaitlist]);

  // Waitlist action handler (update status or contact)
  const handleWaitlistAction = async (entryId: string, action: string) => {
    setWaitlistActionId(entryId);
    try {
      const body: Record<string, unknown> = { id: entryId };
      if (action === "contact") {
        body.incrementContact = true;
      } else {
        body.status = action;
      }
      const res = await fetch("/api/staff/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update waitlist entry");
      }
      fetchWaitlist();
      const actionLabels: Record<string, string> = {
        OFFERED: "marked as offered",
        EXPIRED: "marked as expired",
        contact: "contact recorded",
      };
      toast.success(`Entry ${actionLabels[action] || "updated"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update entry");
    } finally {
      setWaitlistActionId(null);
    }
  };

  // Format cents
  const formatCents = (cents: number) => {
    if (cents === 0) return "Free";
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Modality badge
  const ModalityBadge = ({ modality }: { modality: string }) => {
    if (modality === "VIDEO") {
      return (
        <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50">
          <Calendar className="size-3 mr-1" />
          Video
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50">
        <CalendarDays className="size-3 mr-1" />
        In-Clinic
      </Badge>
    );
  };

  // Status badge
  const StatusBadge = ({ status }: { status: string }) => (
    <Badge className={`${STATUS_STYLES[status] || STATUS_STYLES.ARCHIVED} border`}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );

  // Filter tabs
  const statusTabs = [
    { key: "", label: "All" },
    { key: "BOOKED", label: "Booked" },
    { key: "CHECKED_IN", label: "Checked In" },
    { key: "COMPLETED", label: "Completed" },
    { key: "CANCELLED", label: "Cancelled" },
    { key: "NO_SHOW", label: "No Show" },
    { key: "__WAITLIST__", label: "Waitlist", isWaitlist: true },
  ];

  // Waitlist status styles
  const WL_STATUS_STYLES: Record<string, string> = {
    WAITING: "bg-amber-100 text-amber-700 border-amber-200",
    OFFERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    EXPIRED: "bg-gray-100 text-gray-600 border-gray-200",
    ACCEPTED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };

  const WL_STATUS_LABELS: Record<string, string> = {
    WAITING: "Waiting",
    OFFERED: "Offered",
    EXPIRED: "Expired",
    ACCEPTED: "Accepted",
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Appointments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage and review all clinic appointments
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-border/60 shadow-sm p-4 space-y-3">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {statusTabs.map((tab) => {
            const isWl = 'isWaitlist' in tab && tab.isWaitlist;
            const isActive = isWl
              ? viewMode === "waitlist"
              : viewMode === "appointments" && statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (isWl) {
                    setViewMode("waitlist");
                  } else {
                    setViewMode("appointments");
                    setStatusFilter(tab.key);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer border ${
                  isActive
                    ? isWl
                      ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                      : "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-white text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                {isWl && <Bell className="size-3 mr-1 inline" />}
                {tab.label}
              </button>
            );
          })}
        </div>

        <Separator />

        {/* Search + Filters Row — only show for appointments view */}
        {viewMode === "appointments" && (
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
            <Input
              placeholder="Search patient name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Provider Filter */}
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-full sm:w-48 h-9">
              <SelectValue placeholder="All Providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All Providers</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}{p.credentials ? `, ${p.credentials}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date From */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-36"
            />
          </div>

          {/* Date To */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-36"
            />
          </div>
        </div>
        )}
      </div>

      {/* Results Count — only show for appointments view */}
      {viewMode === "appointments" && (
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? (
            "Loading..."
          ) : (
            <>
              <span className="font-medium text-foreground">{total}</span> appointment{total !== 1 ? "s" : ""} found
            </>
          )}
        </p>
        {(statusFilter || search || providerFilter || dateFrom !== format(new Date(), "yyyy-MM-dd") || dateTo !== format(new Date(), "yyyy-MM-dd")) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setSearch("");
              setProviderFilter("");
              setDateFrom(format(new Date(), "yyyy-MM-dd"));
              setDateTo(format(new Date(), "yyyy-MM-dd"));
            }}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer flex items-center gap-1"
          >
            <Filter className="size-3" />
            Clear filters
          </button>
        )}
      </div>
      )}

      {/* ================================================================== */}
      {/* WAITLIST VIEW                                                       */}
      {/* ================================================================== */}
      {viewMode === "waitlist" ? (
        <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Joined</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Patient</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">Provider</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">Specialty</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Contacts</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {waitlistLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-3 px-4 hidden md:table-cell"><Skeleton className="h-4 w-28" /></td>
                      <td className="py-3 px-4 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-5 w-16" /></td>
                      <td className="py-3 px-4 hidden sm:table-cell"><Skeleton className="h-4 w-8" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-8 w-8 ml-auto" /></td>
                    </tr>
                  ))
                ) : waitlistError ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <p className="text-sm text-red-500">{waitlistError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchWaitlist}
                        className="mt-2 cursor-pointer"
                      >
                        Retry
                      </Button>
                    </td>
                  </tr>
                ) : waitlistEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center">
                          <Bell className="size-5 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No waitlist entries</p>
                        <p className="text-xs text-muted-foreground/70">
                          Patients will appear here when they join the waitlist
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  waitlistEntries.map((entry, index) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-border/30 transition-colors hover:bg-amber-50/30 ${
                        index % 2 === 0 ? "bg-white" : "bg-muted/15"
                      }`}
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-muted-foreground/60" />
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(entry.createdAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        {entry.expiresAt && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            Expires: {format(parseISO(entry.expiresAt), "MMM d")}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                            <User className="size-3.5 text-amber-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{entry.patientName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.patientEmail}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell whitespace-nowrap">
                        <span className="text-sm">{entry.providerName}</span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell whitespace-nowrap text-muted-foreground">
                        {entry.specialtyName}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${WL_STATUS_STYLES[entry.status] || WL_STATUS_STYLES.WAITING} border`}>
                          {WL_STATUS_LABELS[entry.status] || entry.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {entry.contactCount}
                        </span>
                        {entry.lastContactAt && (
                          <p className="text-[10px] text-muted-foreground/60">
                            Last: {format(parseISO(entry.lastContactAt), "MMM d")}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 cursor-pointer"
                              disabled={waitlistActionId === entry.id}
                            >
                              {waitlistActionId === entry.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="size-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {entry.status === "WAITING" && (
                              <DropdownMenuItem
                                onClick={() => handleWaitlistAction(entry.id, "OFFERED")}
                                className="cursor-pointer"
                              >
                                <CheckCircle2 className="size-3.5 mr-2 text-emerald-600" />
                                Mark as Offered
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleWaitlistAction(entry.id, "contact")}
                              className="cursor-pointer"
                            >
                              <Phone className="size-3.5 mr-2 text-amber-600" />
                              Record Contact
                            </DropdownMenuItem>
                            {(entry.status === "WAITING" || entry.status === "OFFERED") && (
                              <DropdownMenuSeparator />
                            )}
                            {(entry.status === "WAITING" || entry.status === "OFFERED") && (
                              <DropdownMenuItem
                                onClick={() => handleWaitlistAction(entry.id, "EXPIRED")}
                                className="cursor-pointer text-red-600 focus:text-red-600"
                              >
                                <XCircle className="size-3.5 mr-2" />
                                Mark as Expired
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Time</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Patient</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">Provider</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">Service</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Modality</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3 px-4 hidden md:table-cell"><Skeleton className="h-4 w-28" /></td>
                    <td className="py-3 px-4 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4 hidden sm:table-cell"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-5 w-16" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-8 w-8 ml-auto" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <p className="text-sm text-red-500">{error}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchAppointments}
                      className="mt-2"
                    >
                      Retry
                    </Button>
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center">
                        <Calendar className="size-5 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">No appointments found</p>
                      <p className="text-xs text-muted-foreground/70">
                        Try adjusting your filters or date range
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                appointments.map((apt, index) => (
                  <tr
                    key={apt.id}
                    className={`border-b border-border/30 transition-colors hover:bg-emerald-50/30 ${
                      index % 2 === 0 ? "bg-white" : "bg-muted/15"
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-muted-foreground/60" />
                        <span className="font-medium">
                          {format(parseISO(apt.startTime), "h:mm a")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(apt.startTime), "MMM d, yyyy")}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <User className="size-3.5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{apt.patientName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {apt.patientEmail}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell whitespace-nowrap">
                      <span className="text-sm">
                        Dr. {apt.provider.firstName} {apt.provider.lastName}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell whitespace-nowrap text-muted-foreground">
                      {apt.service.name}
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <ModalityBadge modality={apt.modality} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={apt.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 cursor-pointer"
                            disabled={transitioningId === apt.id}
                          >
                            {transitioningId === apt.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => openDetail(apt.id)} className="cursor-pointer">
                            <Eye className="size-3.5 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {apt.status === "BOOKED" && (
                            <DropdownMenuItem
                              onClick={() => handleTransition(apt.id, "CHECKED_IN")}
                              className="cursor-pointer"
                            >
                              <UserCheck className="size-3.5 mr-2 text-amber-600" />
                              Check In
                            </DropdownMenuItem>
                          )}
                          {apt.status === "CHECKED_IN" && (
                            <DropdownMenuItem
                              onClick={() => handleTransition(apt.id, "COMPLETED")}
                              className="cursor-pointer"
                            >
                              <CheckCircle2 className="size-3.5 mr-2 text-emerald-600" />
                              Complete
                            </DropdownMenuItem>
                          )}
                          {(apt.status === "BOOKED" || apt.status === "CHECKED_IN") && (
                            <DropdownMenuItem
                              onClick={() => handleTransition(apt.id, "CANCELLED")}
                              className="cursor-pointer text-red-600 focus:text-red-600"
                            >
                              <XCircle className="size-3.5 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {(apt.status === "BOOKED" || apt.status === "CONFIRMED") && (
                            <DropdownMenuItem
                              onClick={() => {
                                setQrAppointmentId(apt.id);
                                setQrPatientName(apt.patientName);
                              }}
                              className="cursor-pointer"
                            >
                              <QrCode className="size-3.5 mr-2 text-emerald-600" />
                              QR Code
                            </DropdownMenuItem>
                          )}
                          {apt.status === "BOOKED" && (
                            <DropdownMenuItem
                              onClick={() => handleTransition(apt.id, "NO_SHOW")}
                              className="cursor-pointer"
                            >
                              <UserX className="size-3.5 mr-2" />
                              Mark No Show
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8 cursor-pointer"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "default" : "outline"}
                    size="icon"
                    className={`size-8 cursor-pointer ${pageNum === page ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="icon"
                className="size-8 cursor-pointer"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ================================================================== */}
      {/* QR CODE DIALOG                                                     */}
      {/* ================================================================== */}
      <Dialog
        open={!!qrAppointmentId}
        onOpenChange={(open) => {
          if (!open) {
            setQrAppointmentId(null);
            setQrPatientName(undefined);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="size-5 text-emerald-600" />
              Appointment QR Code
            </DialogTitle>
            <DialogDescription>
              {qrPatientName
                ? `QR code for ${qrPatientName}'s appointment`
                : "Scannable QR code for this appointment"}
            </DialogDescription>
          </DialogHeader>
          {qrAppointmentId && (
            <QrCodeDisplay
              appointmentId={qrAppointmentId}
              patientName={qrPatientName}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* DETAIL DIALOG                                                      */}
      {/* ================================================================== */}
      <Dialog
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setDetail(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {detailLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="grid grid-cols-2 gap-4 pt-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            </div>
          ) : detail ? (
            <>
              {/* Dialog Header */}
              <div className="px-6 pt-6 pb-4 border-b border-border/40">
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-lg font-semibold">
                      Appointment Details
                    </DialogTitle>
                    <StatusBadge status={detail.status} />
                  </div>
                  <DialogDescription className="text-sm text-muted-foreground">
                    {format(parseISO(detail.startTime), "EEEE, MMMM d, yyyy 'at' h:mm a")} —{" "}
                    {format(parseISO(detail.endTime), "h:mm a")}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="px-6 py-4 space-y-5">
                {/* Status Transition Buttons */}
                {detail.validTransitions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {detail.validTransitions.map((t) => (
                      <Button
                        key={t}
                        variant="outline"
                        size="sm"
                        className={`cursor-pointer transition-all ${
                          t === "CANCELLED"
                            ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            : t === "COMPLETED"
                              ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              : t === "CHECKED_IN"
                                ? "border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                : ""
                        }`}
                        disabled={transitioningId === detail.id}
                        onClick={() => handleTransition(detail.id, t)}
                      >
                        {transitioningId === detail.id ? (
                          <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                        ) : (
                          TRANSITION_ICONS[t] || null
                        )}
                        {TRANSITION_LABELS[t] || t}
                      </Button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Patient Info Card */}
                  <div className="rounded-lg border border-border/60 p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <User className="size-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{detail.patientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {detail.patientType === "PEDIATRIC" ? (
                            <span className="flex items-center gap-1">
                              <Baby className="size-3" /> Pediatric
                            </span>
                          ) : (
                            "Adult"
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="size-3.5 shrink-0" />
                        <a href={`tel:${detail.patientPhone}`} className="hover:text-foreground transition-colors">
                          {detail.patientPhone}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="size-3.5 shrink-0" />
                        <a href={`mailto:${detail.patientEmail}`} className="hover:text-foreground transition-colors truncate">
                          {detail.patientEmail}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="size-3.5 shrink-0" />
                        <span>DOB: {format(parseISO(detail.patientDob), "MMM d, yyyy")}</span>
                      </div>
                      {detail.guardianName && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="size-3.5 shrink-0" />
                          <span>
                            Guardian: {detail.guardianName} ({detail.guardianRelation})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Appointment Info Card */}
                  <div className="rounded-lg border border-border/60 p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <FileText className="size-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Appointment Info</p>
                        <p className="text-xs text-muted-foreground">{detail.service.name}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserCheck className="size-3.5 shrink-0" />
                        <span>
                          Dr. {detail.provider.firstName} {detail.provider.lastName}
                          {detail.provider.credentials ? `, ${detail.provider.credentials}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Shield className="size-3.5 shrink-0" />
                        <span>Specialty: {detail.specialty.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ModalityBadge modality={detail.modality} />
                        {detail.intakeCompleted && (
                          <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50 text-[10px]">
                            <CheckCircle2 className="size-2.5 mr-0.5" /> Intake Done
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground">
                        <span className="font-medium">Reason:</span> {detail.reasonForVisit}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Insurance Info */}
                <div className="rounded-lg border border-border/60 p-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Shield className="size-4 text-emerald-600" />
                    Insurance
                  </h4>
                  {detail.insurance ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{detail.insurance.name}</p>
                        {detail.isDemoInsurance && (
                          <Badge variant="outline" className="mt-1 border-emerald-200 text-emerald-600 bg-emerald-50 text-[10px]">
                            Demo Plan
                          </Badge>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        {detail.isDemoInsurance ? (
                          <span className="text-emerald-600 font-medium">Free</span>
                        ) : detail.depositCents > 0 ? (
                          <div>
                            <p className="text-muted-foreground">Deposit: {formatCents(detail.depositCents)}</p>
                            {detail.selfPayCents > 0 && (
                              <p className="text-muted-foreground">Self-pay: {formatCents(detail.selfPayCents)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No insurance on file</p>
                  )}
                </div>

                {/* Financial / Ledger */}
                {detail.ledger && (
                  <div className="rounded-lg border border-border/60 p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <CreditCard className="size-4 text-emerald-600" />
                      Financial Info
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Payment Method</p>
                        <p className="font-medium capitalize">
                          {detail.paymentMethod?.replace(/_/g, " ") || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Payment Status</p>
                        <Badge variant="outline" className="text-[10px]">
                          {detail.paymentStatus}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Deposit</p>
                        <p className="font-medium">{formatCents(detail.depositCents)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Self-pay Total</p>
                        <p className="font-medium">{formatCents(detail.selfPayCents)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ledger Type</p>
                        <p className="font-medium">{detail.ledger.type.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ledger Amount</p>
                        <p className="font-medium">{formatCents(detail.ledger.amountCents)}</p>
                      </div>
                      {detail.ledger.description && (
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Note</p>
                          <p className="text-xs">{detail.ledger.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Patient Token */}
                {detail.tokens.length > 0 && (
                  <div className="rounded-lg border border-border/60 p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Hash className="size-4 text-emerald-600" />
                      Patient Management Token
                    </h4>
                    <div className="space-y-1.5">
                      {detail.tokens.map((token) => (
                        <div
                          key={token.id}
                          className="flex items-center justify-between text-xs bg-muted/40 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {token.purpose}
                            </Badge>
                            <span className="text-muted-foreground">
                              {token.consumedAt ? "Consumed" : token.expiresAt < new Date().toISOString() ? "Expired" : "Active"}
                            </span>
                          </div>
                          <span className="text-muted-foreground">
                            Expires: {format(parseISO(token.expiresAt), "MMM d, yyyy")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cancellation Info */}
                {detail.status === "CANCELLED" && detail.cancellationReason && (
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                    <h4 className="text-sm font-semibold text-red-700 mb-1 flex items-center gap-2">
                      <XCircle className="size-4" />
                      Cancellation Details
                    </h4>
                    <p className="text-sm text-red-600">
                      Reason: {detail.cancellationReason.replace(/_/g, " ")}
                    </p>
                    {detail.cancelledAt && (
                      <p className="text-xs text-red-500 mt-1">
                        Cancelled: {format(parseISO(detail.cancelledAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                )}

                {/* Internal Notes */}
                <div className="rounded-lg border border-border/60 p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <StickyNote className="size-4 text-emerald-600" />
                    Internal Notes
                    {detail.notes.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] ml-1">
                        {detail.notes.length}
                      </Badge>
                    )}
                  </h4>

                  <div className="space-y-3 max-h-60 overflow-y-auto mb-3">
                    {detail.notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No notes yet. Add one below.
                      </p>
                    ) : (
                      detail.notes.map((note) => (
                        <div key={note.id} className="flex gap-2.5">
                          {/* Author avatar */}
                          <div className="shrink-0 mt-0.5">
                            <div className="size-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-semibold text-emerald-700">
                              {note.author?.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                          </div>
                          {/* Note bubble */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium">
                                {note.author?.name || "Unknown"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(parseISO(note.createdAt), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/90 mt-0.5 bg-muted/40 rounded-lg px-3 py-2">
                              {note.content}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Note Form */}
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add an internal note..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="min-h-[60px] text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          handleAddNote();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="size-9 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer self-end"
                      disabled={!noteContent.trim() || noteSubmitting}
                      onClick={handleAddNote}
                    >
                      {noteSubmitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Created Info */}
                <div className="text-xs text-muted-foreground text-right">
                  Created: {format(parseISO(detail.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  {detail.id && (
                    <span className="ml-2 font-mono text-[10px]">
                      ID: {detail.id.slice(0, 8)}...
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              Could not load appointment details.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
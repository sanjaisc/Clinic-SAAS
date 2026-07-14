"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Pencil,
  Check,
  ArrowRight,
  RefreshCw,
  LayoutGrid,
  List,
  Video,
  Link2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ClipboardCopy,
  CalendarPlus,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { QrCodeDisplay } from "@/components/qr-code-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, parseISO, addDays } from "date-fns";
import { cn } from "@/lib/utils";

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
  provider: { id: string; firstName: string; lastName: string; credentials: string | null; videoVisitLink?: string | null };
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

interface RescheduleSlot {
  id: string;
  startTime: string;
  endTime: string;
  modality: string;
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
  serviceName: string;
}

// =============================================================================
// Status Helpers
// =============================================================================

const STATUS_STYLES: Record<string, string> = {
  BOOKED: "bg-blue-100 text-blue-700 border-blue-200",
  CHECKED_IN: "bg-amber-100 text-amber-700 border-amber-200",
  COMPLETED: "bg-brand-subtle text-brand-hover border-brand-border",
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
  const router = useRouter();
  const clinicId = session?.user?.clinicId as string | undefined;

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(addDays(new Date(), 30), "yyyy-MM-dd"));
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

  // Patient edit mode in detail dialog
  const [editingPatient, setEditingPatient] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editInsuranceVerified, setEditInsuranceVerified] = useState(false);
  const [patientSaving, setPatientSaving] = useState(false);

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

  // Reschedule dialog
  const [rescheduleApt, setRescheduleApt] = useState<AppointmentRow | null>(null);
  const [rescheduleProviderId, setRescheduleProviderId] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleSlots, setRescheduleSlots] = useState<RescheduleSlot[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleSelectedSlotId, setRescheduleSelectedSlotId] = useState("");
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  // Feature 1.1: Column sorting
  const [sortField, setSortField] = useState<string>("startTime");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Feature 1.2: Grid/table view toggle
  const [listView, setListView] = useState<"table" | "grid">("table");

  // Feature 5.1: Video link manager
  const [editVideoLink, setEditVideoLink] = useState("");
  const [videoLinkSaving, setVideoLinkSaving] = useState(false);
  const [videoLinkSending, setVideoLinkSending] = useState(false);

  // Feature 6.1: Payment request
  const [paymentRequestSending, setPaymentRequestSending] = useState(false);
  const [paymentRequestAmount, setPaymentRequestAmount] = useState("");

  // Feature 6.2: Refund confirmation
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // Feature 7.1: Conflict alert
  const [conflictIds, setConflictIds] = useState<Set<string>>(new Set());

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
        const res = await fetch(`/api/staff/providers?clinicId=${clinicId}`);
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
          setProviders(allProviders);
        }
      } catch {
        // non-critical
      }
    })();
  }, [clinicId]);

  // Fetch conflict IDs on mount
  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      try {
        const res = await fetch(`/api/staff/appointments/conflicts?clinicId=${clinicId}`);
        if (res.ok) {
          const data = await res.json();
          const ids = new Set<string>();
          for (const group of (data.conflicts || []) as Array<{ appointments: Array<{ id: string }> }>) {
            for (const apt of group.appointments) {
              ids.add(apt.id);
            }
          }
          setConflictIds(ids);
        }
      } catch {
        // non-critical
      }
    })();
  }, [clinicId]);

  // Feature 1.1: Client-side sorting
  const sortedAppointments = useMemo(() => {
    const sorted = [...appointments];
    const dir = sortDir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      let valA: string;
      let valB: string;
      switch (sortField) {
        case "startTime":
          valA = a.startTime;
          valB = b.startTime;
          break;
        case "patientName":
          valA = a.patientName.toLowerCase();
          valB = b.patientName.toLowerCase();
          break;
        case "provider": {
          valA = `${a.provider.lastName} ${a.provider.firstName}`.toLowerCase();
          valB = `${b.provider.lastName} ${b.provider.firstName}`.toLowerCase();
          break;
        }
        case "status":
          valA = a.status;
          valB = b.status;
          break;
        default:
          valA = a.startTime;
          valB = b.startTime;
      }
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
    return sorted;
  }, [appointments, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="size-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="size-3 ml-1 text-brand" /> : <ArrowDown className="size-3 ml-1 text-brand" />;
  };

  // Open detail dialog
  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    setNoteContent("");
    setEditingPatient(false);
    setPaymentRequestAmount("");
    try {
      const res = await fetch(`/api/staff/appointments/${id}`);
      if (!res.ok) throw new Error("Failed to load appointment");
      const data = await res.json();
      setDetail(data);
      // Populate edit fields
      setEditName(data.patientName);
      setEditEmail(data.patientEmail);
      setEditPhone(data.patientPhone);
      setEditDob(data.patientDob ? format(parseISO(data.patientDob), "yyyy-MM-dd") : "");
      setEditInsuranceVerified(data.insuranceVerified ?? false);
      // Populate video link
      setEditVideoLink(data.provider?.videoVisitLink || "");
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
      toast.success(`Appointment ${statusLabels[newStatus] || "updated"}`);
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

  // Save patient contact details + insurance verified + DOB
  const handleSavePatient = async () => {
    if (!selectedId || !detail) return;
    setPatientSaving(true);
    try {
      const body: Record<string, unknown> = {
        patientName: editName,
        patientEmail: editEmail,
        patientPhone: editPhone,
        patientDob: editDob,
        insuranceVerified: editInsuranceVerified,
      };
      const res = await fetch(`/api/staff/appointments/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update patient details");
      }
      setEditingPatient(false);
      // Refresh detail to get updated data
      openDetail(selectedId);
      toast.success("Patient details updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update patient details");
    } finally {
      setPatientSaving(false);
    }
  };

  // ---- Reschedule ----
  const openReschedule = (apt: AppointmentRow) => {
    setRescheduleApt(apt);
    setRescheduleProviderId(apt.provider.id);
    setRescheduleDate(undefined);
    setRescheduleSlots([]);
    setRescheduleSelectedSlotId("");
  };

  const handleRescheduleProviderChange = async (providerId: string) => {
    setRescheduleProviderId(providerId);
    setRescheduleSelectedSlotId("");
    if (rescheduleDate) {
      await fetchRescheduleSlots(providerId, rescheduleDate);
    } else {
      setRescheduleSlots([]);
    }
  };

  const handleRescheduleDateChange = async (date: Date | undefined) => {
    setRescheduleDate(date);
    setRescheduleSelectedSlotId("");
    if (date && rescheduleProviderId) {
      await fetchRescheduleSlots(rescheduleProviderId, date);
    } else {
      setRescheduleSlots([]);
    }
  };

  const fetchRescheduleSlots = async (providerId: string, date: Date) => {
    setRescheduleSlotsLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const res = await fetch(`/api/staff/book?providerId=${providerId}&date=${dateStr}`);
      if (!res.ok) throw new Error("Failed to load slots");
      const data = await res.json();
      setRescheduleSlots(data.slots || []);
    } catch {
      setRescheduleSlots([]);
      toast.error("Failed to load available slots");
    } finally {
      setRescheduleSlotsLoading(false);
    }
  };

  const handleRescheduleConfirm = async () => {
    if (!rescheduleApt || !rescheduleSelectedSlotId || rescheduleSubmitting) return;
    setRescheduleSubmitting(true);
    try {
      const res = await fetch(`/api/staff/appointments/${rescheduleApt.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSlotId: rescheduleSelectedSlotId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Reschedule failed");
      }
      toast.success("Appointment rescheduled successfully");
      setRescheduleApt(null);
      fetchAppointments();
      // Also refresh detail if this appointment's detail is open
      if (selectedId === rescheduleApt.id) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reschedule");
    } finally {
      setRescheduleSubmitting(false);
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
        REMOVED: "removed",
        contact: "contact recorded",
      };
      toast.success(`Entry ${actionLabels[action] || "updated"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update entry");
    } finally {
      setWaitlistActionId(null);
    }
  };

  // Feature 5.1: Save video link (on the provider)
  const handleSaveVideoLink = async () => {
    if (!selectedId || !detail) return;
    setVideoLinkSaving(true);
    try {
      const res = await fetch(`/api/staff/appointments/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoVisitLink: editVideoLink }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save video link");
      }
      toast.success("Video link saved");
      // Refresh detail to pick up updated provider data
      openDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save video link");
    } finally {
      setVideoLinkSaving(false);
    }
  };

  // Feature 5.2: Send video link to patient
  const handleSendVideoLink = async () => {
    if (!selectedId) return;
    setVideoLinkSending(true);
    try {
      const res = await fetch(`/api/staff/appointments/${selectedId}/send-video-link`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send video link");
      }
      toast.success("Video link sent to patient");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send video link");
    } finally {
      setVideoLinkSending(false);
    }
  };

  // Feature 6.1: Send payment request
  const handleSendPaymentRequest = async () => {
    if (!selectedId || !detail) return;
    const amountCents = Math.round(parseFloat(paymentRequestAmount) * 100);
    if (!amountCents || amountCents <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setPaymentRequestSending(true);
    try {
      const res = await fetch("/api/staff/payments/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: selectedId, amountCents }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send payment request");
      }
      const data = await res.json();
      toast.success(`Payment request sent — ${data.paymentUrl}`);
      setPaymentRequestAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send payment request");
    } finally {
      setPaymentRequestSending(false);
    }
  };

  // Feature 6.2: Manual refund
  const handleConfirmRefund = async () => {
    if (!selectedId || !detail) return;
    setRefundSubmitting(true);
    try {
      const res = await fetch("/api/staff/payments/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: selectedId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to process refund");
      }
      toast.success("Refund processed successfully");
      setRefundDialogOpen(false);
      // Refresh detail
      openDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process refund");
    } finally {
      setRefundSubmitting(false);
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
          <Video className="size-3 mr-1" />
          Video
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-brand-border text-brand bg-brand-muted">
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

  // Waitlist status styles (Feature 10: fixed labels)
  const WL_STATUS_STYLES: Record<string, string> = {
    ACTIVE: "bg-amber-100 text-amber-700 border-amber-200",
    OFFERED: "bg-brand-subtle text-brand-hover border-brand-border",
    EXPIRED: "bg-gray-100 text-gray-600 border-gray-200",
    FULFILLED: "bg-brand-subtle text-brand-hover border-brand-border",
    REMOVED: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const WL_STATUS_LABELS: Record<string, string> = {
    ACTIVE: "Waiting",
    OFFERED: "Offered",
    EXPIRED: "Expired",
    FULFILLED: "Fulfilled",
    REMOVED: "Removed",
  };

  // Appointment row actions dropdown (shared between table and grid)
  const AppointmentActions = ({ apt }: { apt: AppointmentRow }) => (
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
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => openDetail(apt.id)} className="cursor-pointer">
          <Eye className="size-3.5 mr-2" />
          View Details
        </DropdownMenuItem>

        {/* ---- Status-transition section ---- */}
        {(apt.status === "BOOKED" || apt.status === "CONFIRMED" || apt.status === "CHECKED_IN" || apt.status === "CANCELLED" || apt.status === "NO_SHOW") && (
          <>
            <DropdownMenuSeparator />
            {(apt.status === "BOOKED" || apt.status === "CONFIRMED") && (
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
                <CheckCircle2 className="size-3.5 mr-2 text-brand" />
                Complete
              </DropdownMenuItem>
            )}
            {(apt.status === "BOOKED" || apt.status === "CONFIRMED" || apt.status === "CANCELLED" || apt.status === "NO_SHOW") && (
              <DropdownMenuItem
                onClick={() => openReschedule(apt)}
                className="cursor-pointer"
              >
                <RefreshCw className="size-3.5 mr-2 text-blue-600" />
                Reschedule
              </DropdownMenuItem>
            )}
            {(apt.status === "BOOKED" || apt.status === "CONFIRMED" || apt.status === "CHECKED_IN") && (
              <DropdownMenuItem
                onClick={() => handleTransition(apt.id, "CANCELLED")}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <XCircle className="size-3.5 mr-2" />
                Cancel
              </DropdownMenuItem>
            )}
            {(apt.status === "BOOKED" || apt.status === "CONFIRMED") && (
              <DropdownMenuItem
                onClick={() => handleTransition(apt.id, "NO_SHOW")}
                className="cursor-pointer"
              >
                <UserX className="size-3.5 mr-2" />
                Mark No Show
              </DropdownMenuItem>
            )}
          </>
        )}

        {/* ---- Quick-access section (QR Code, Video Link) ---- */}
        {(apt.status === "BOOKED" || apt.status === "CONFIRMED" || (apt.modality === "VIDEO" && apt.status === "CHECKED_IN")) && (
          <>
            <DropdownMenuSeparator />
            {(apt.status === "BOOKED" || apt.status === "CONFIRMED") && (
              <DropdownMenuItem
                onClick={() => {
                  setQrAppointmentId(apt.id);
                  setQrPatientName(apt.patientName);
                }}
                className="cursor-pointer"
              >
                <QrCode className="size-3.5 mr-2 text-brand" />
                QR Code
              </DropdownMenuItem>
            )}
            {apt.modality === "VIDEO" && (apt.status === "BOOKED" || apt.status === "CONFIRMED" || apt.status === "CHECKED_IN") && (
              <DropdownMenuItem
                onClick={async () => {
                  await openDetail(apt.id);
                  setTimeout(() => {
                    const el = document.querySelector("[data-video-link-section]");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }, 400);
                }}
                className="cursor-pointer"
              >
                <Video className="size-3.5 mr-2 text-purple-600" />
                Send Video Link
              </DropdownMenuItem>
            )}
          </>
        )}

        {/* ---- Universal actions — available for ALL statuses ---- */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await openDetail(apt.id);
            setTimeout(() => {
              const el = document.querySelector("[data-notes-section]");
              el?.scrollIntoView({ behavior: "smooth" });
            }, 400);
          }}
          className="cursor-pointer"
        >
          <StickyNote className="size-3.5 mr-2 text-amber-600" />
          Add Note
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const summary = `${apt.patientName} — ${apt.service.name} with Dr. ${apt.provider.firstName} ${apt.provider.lastName}\n${format(parseISO(apt.startTime), "MMM d, yyyy 'at' h:mm a")} · ${apt.modality} · ${apt.status}`;
            navigator.clipboard.writeText(summary).then(
              () => toast.success("Appointment details copied"),
              () => toast.error("Failed to copy")
            );
          }}
          className="cursor-pointer"
        >
          <ClipboardCopy className="size-3.5 mr-2" />
          Copy Details
        </DropdownMenuItem>
        {(apt.status === "COMPLETED" || apt.status === "CANCELLED" || apt.status === "NO_SHOW") && (
          <DropdownMenuItem
            onClick={() => {
              router.push(`/staff/dashboard/book?rebookFrom=${apt.id}`);
            }}
            className="cursor-pointer"
          >
            <CalendarPlus className="size-3.5 mr-2 text-brand" />
            Rebook Patient
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Grid card for an appointment
  const AppointmentGridCard = ({ apt }: { apt: AppointmentRow }) => (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-white p-4 shadow-sm hover:shadow-md transition-all",
        conflictIds.has(apt.id) && "ring-2 ring-orange-300"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0">
            <User className="size-4 text-brand" />
          </div>
          <button
            type="button"
            onClick={() => openDetail(apt.id)}
            className="text-left cursor-pointer hover:text-brand-hover transition-colors min-w-0"
          >
            <p className={cn("font-medium truncate text-sm", conflictIds.has(apt.id) ? "text-orange-600" : "")}>
              {conflictIds.has(apt.id) && <AlertTriangle className="size-3 inline mr-1 text-orange-500" />}
              {apt.patientName}
            </p>
          </button>
        </div>
        <AppointmentActions apt={apt} />
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <UserCheck className="size-3.5 shrink-0" />
          <span className="truncate">Dr. {apt.provider.firstName} {apt.provider.lastName}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">{apt.service.name}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          <span>{format(parseISO(apt.startTime), "h:mm a")}</span>
          <span className="text-xs">·</span>
          <span className="text-xs">{format(parseISO(apt.startTime), "MMM d, yyyy")}</span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <StatusBadge status={apt.status} />
          <ModalityBadge modality={apt.modality} />
        </div>
      </div>
    </div>
  );

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
                      : "bg-brand text-white border-brand shadow-sm"
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
              placeholder="Search by name, email, phone, booking ID, or token..."
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

          {/* Search Button */}
          <Button
            size="sm"
            className="h-9 px-4 bg-brand hover:bg-brand-hover text-white shrink-0 cursor-pointer"
            onClick={() => { setPage(1); fetchAppointments(); }}
          >
            <Search className="size-3.5 mr-1.5" />
            Search
          </Button>
        </div>
        )}
      </div>

      {/* Results Count + View Toggle — only show for appointments view */}
      {viewMode === "appointments" && (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {loading ? (
              "Loading..."
            ) : (
              <>
                <span className="font-medium text-foreground">{total}</span> appointment{total !== 1 ? "s" : ""} found
              </>
            )}
          </p>
          {/* Grid/Table toggle */}
          <div className="flex items-center border border-border/60 rounded-lg overflow-hidden">
            <button
              onClick={() => setListView("table")}
              className={cn(
                "p-1.5 transition-colors cursor-pointer",
                listView === "table"
                  ? "bg-brand text-white"
                  : "bg-white text-muted-foreground hover:bg-muted/60"
              )}
              title="Table view"
            >
              <List className="size-3.5" />
            </button>
            <button
              onClick={() => setListView("grid")}
              className={cn(
                "p-1.5 transition-colors cursor-pointer",
                listView === "grid"
                  ? "bg-brand text-white"
                  : "bg-white text-muted-foreground hover:bg-muted/60"
              )}
              title="Grid view"
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </div>
        </div>
        {(statusFilter || search || providerFilter || dateFrom !== format(new Date(), "yyyy-MM-dd") || dateTo !== format(addDays(new Date(), 30), "yyyy-MM-dd")) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setSearch("");
              setProviderFilter("");
              setDateFrom(format(new Date(), "yyyy-MM-dd"));
              setDateTo(format(addDays(new Date(), 30), "yyyy-MM-dd"));
            }}
            className="text-xs text-brand hover:text-brand-hover font-medium cursor-pointer flex items-center gap-1"
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
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">Service</th>
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
                        {entry.serviceName}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`${WL_STATUS_STYLES[entry.status] || WL_STATUS_STYLES.ACTIVE} border`}>
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
                            {entry.status === "ACTIVE" && (
                              <DropdownMenuItem
                                onClick={() => handleWaitlistAction(entry.id, "OFFERED")}
                                className="cursor-pointer"
                              >
                                <CheckCircle2 className="size-3.5 mr-2 text-brand" />
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
                            {(entry.status === "ACTIVE" || entry.status === "OFFERED") && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleWaitlistAction(entry.id, "EXPIRED")}
                                  className="cursor-pointer text-red-600 focus:text-red-600"
                                >
                                  <XCircle className="size-3.5 mr-2" />
                                  Mark as Expired
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleWaitlistAction(entry.id, "REMOVED")}
                                  className="cursor-pointer text-red-600 focus:text-red-600"
                                >
                                  <UserX className="size-3.5 mr-2" />
                                  Remove
                                </DropdownMenuItem>
                              </>
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
        {/* Feature 7.1: Conflict banner */}
        {conflictIds.size > 0 && (
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-2.5 flex items-center gap-2">
            <AlertTriangle className="size-4 text-orange-600 shrink-0" />
            <p className="text-sm text-orange-700 font-medium">
              ⚠️ {conflictIds.size} potential double-booking{conflictIds.size !== 1 ? "s" : ""} detected
            </p>
          </div>
        )}

        {listView === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th
                  className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort("startTime")}
                >
                  <span className="inline-flex items-center">
                    Time
                    <SortIcon field="startTime" />
                  </span>
                </th>
                <th
                  className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort("patientName")}
                >
                  <span className="inline-flex items-center">
                    Patient
                    <SortIcon field="patientName" />
                  </span>
                </th>
                <th
                  className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort("provider")}
                >
                  <span className="inline-flex items-center">
                    Provider
                    <SortIcon field="provider" />
                  </span>
                </th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">Service</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Modality</th>
                <th
                  className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
                  onClick={() => handleSort("status")}
                >
                  <span className="inline-flex items-center">
                    Status
                    <SortIcon field="status" />
                  </span>
                </th>
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
              ) : sortedAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center">
                        <Calendar className="size-5 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">No appointments found</p>
                      <p className="text-xs text-muted-foreground/70">
                        {statusFilter || search || providerFilter
                          ? "Try adjusting your filters"
                          : "No upcoming appointments in this date range. Try expanding the date range or check past dates."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedAppointments.map((apt, index) => (
                  <tr
                    key={apt.id}
                    className={`border-b border-border/30 transition-colors hover:bg-brand-muted/30 ${
                      index % 2 === 0 ? "bg-white" : "bg-muted/15"
                    } ${conflictIds.has(apt.id) ? "bg-orange-50/40" : ""}`}
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
                      <button
                        type="button"
                        onClick={() => openDetail(apt.id)}
                        className="flex items-center gap-2 text-left cursor-pointer hover:text-brand-hover transition-colors w-full"
                      >
                        <div className="size-7 rounded-full bg-brand-subtle flex items-center justify-center shrink-0">
                          <User className="size-3.5 text-brand" />
                        </div>
                        <div className="min-w-0">
                          <p className={cn("font-medium truncate", conflictIds.has(apt.id) ? "text-orange-600" : "")}>
                            {conflictIds.has(apt.id) && <AlertTriangle className="size-3 inline mr-1 text-orange-500" />}
                            {apt.patientName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {apt.patientEmail}
                          </p>
                        </div>
                      </button>
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
                      <AppointmentActions apt={apt} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        ) : (
        <div className="p-4">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/60 p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-sm text-red-500">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAppointments}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          ) : sortedAppointments.length === 0 ? (
            <div className="py-16 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <Calendar className="size-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No appointments found</p>
                <p className="text-xs text-muted-foreground/70">
                  {statusFilter || search || providerFilter
                    ? "Try adjusting your filters"
                    : "No upcoming appointments in this date range."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAppointments.map((apt) => (
                <AppointmentGridCard key={apt.id} apt={apt} />
              ))}
            </div>
          )}
        </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && listView === "table" && (
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
                    className={`size-8 cursor-pointer ${pageNum === page ? "bg-brand hover:bg-brand-hover text-white" : ""}`}
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
      {/* RESCHEDULE DIALOG                                                  */}
      {/* ================================================================== */}
      <Dialog
        open={!!rescheduleApt}
        onOpenChange={(open) => {
          if (!open) {
            setRescheduleApt(null);
            setRescheduleSlots([]);
            setRescheduleSelectedSlotId("");
            setRescheduleDate(undefined);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <RefreshCw className="size-4 text-blue-600" />
              </div>
              Reschedule Appointment
            </DialogTitle>
            <DialogDescription>
              Select a new provider, date, and time slot for this appointment.
            </DialogDescription>
          </DialogHeader>

          {rescheduleApt && (
            <div className="space-y-5">
              {/* Current appointment info */}
              <div className="rounded-lg bg-muted/50 border border-border/50 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {rescheduleApt.patientName}
                  </span>
                  <Badge className={cn("text-[10px] border", STATUS_STYLES[rescheduleApt.status])}>
                    {STATUS_LABELS[rescheduleApt.status]}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    Current: {format(parseISO(rescheduleApt.startTime), "EEE, MMM d 'at' h:mm a")} — {format(parseISO(rescheduleApt.endTime), "h:mm a")}
                  </p>
                  <p>
                    Dr. {rescheduleApt.provider.firstName} {rescheduleApt.provider.lastName}
                    {rescheduleApt.provider.credentials && <span>, {rescheduleApt.provider.credentials}</span>}
                    {" · "}{rescheduleApt.service.name}
                  </p>
                </div>
              </div>

              {/* Provider selector */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Provider</Label>
                <Select value={rescheduleProviderId} onValueChange={handleRescheduleProviderChange}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        Dr. {p.firstName} {p.lastName}{p.credentials ? `, ${p.credentials}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date picker */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">New Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-10 justify-start text-left font-normal",
                        !rescheduleDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {rescheduleDate ? format(rescheduleDate, "EEEE, MMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={rescheduleDate}
                      onSelect={handleRescheduleDateChange}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Available slots */}
              {rescheduleDate && rescheduleProviderId && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Available Slots
                    {rescheduleSlotsLoading && (
                      <Loader2 className="inline size-3.5 ml-2 animate-spin text-muted-foreground" />
                    )}
                  </Label>
                  {rescheduleSlotsLoading ? (
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 rounded-lg" />
                      ))}
                    </div>
                  ) : rescheduleSlots.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
                      <Calendar className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No available slots for this date</p>
                      <p className="text-xs text-muted-foreground mt-1">Try selecting a different date</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {rescheduleSlots.map((slot) => {
                        const isSelected = rescheduleSelectedSlotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setRescheduleSelectedSlotId(slot.id)}
                            className={cn(
                              "flex flex-col items-center justify-center rounded-lg border p-2.5 text-center transition-all cursor-pointer",
                              isSelected
                                ? "border-brand bg-brand-muted text-brand-hover shadow-sm ring-1 ring-brand/20"
                                : "border-border/60 hover:border-brand-border hover:bg-brand-muted/50 text-foreground"
                            )}
                          >
                            <span className="text-sm font-medium">
                              {format(parseISO(slot.startTime), "h:mm a")}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {slot.modality === "VIDEO" ? "📹 Video" : "🏢 In-Person"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Summary when slot selected */}
              {rescheduleSelectedSlotId && (
                <div className="rounded-lg bg-brand-muted border border-brand-border p-3">
                  <p className="text-xs font-medium text-brand mb-1">New Appointment Time</p>
                  {(() => {
                    const selectedSlot = rescheduleSlots.find((s) => s.id === rescheduleSelectedSlotId);
                    if (!selectedSlot) return null;
                    return (
                      <div className="flex items-center gap-2 text-sm text-brand-hover">
                        <span className="font-medium">
                          {format(parseISO(selectedSlot.startTime), "EEE, MMM d 'at' h:mm a")}
                        </span>
                        <ArrowRight className="size-3.5" />
                        <span>{format(parseISO(selectedSlot.endTime), "h:mm a")}</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    setRescheduleApt(null);
                    setRescheduleSlots([]);
                    setRescheduleSelectedSlotId("");
                  }}
                  disabled={rescheduleSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  disabled={!rescheduleSelectedSlotId || rescheduleSubmitting}
                  onClick={handleRescheduleConfirm}
                >
                  {rescheduleSubmitting ? (
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4 mr-1.5" />
                  )}
                  Confirm Reschedule
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <QrCode className="size-5 text-brand" />
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
      {/* REFUND CONFIRMATION DIALOG (Feature 6.2)                           */}
      {/* ================================================================== */}
      <AlertDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Refund</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to refund{" "}
              <span className="font-semibold text-foreground">
                {detail?.ledger ? formatCents(detail.ledger.amountCents) : ""}
              </span>
              ? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refundSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRefund}
              disabled={refundSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {refundSubmitting && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              Confirm Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                              ? "border-brand-border text-brand hover:bg-brand-muted hover:text-brand-hover"
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
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center">
                          <User className="size-4 text-brand" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">Patient</p>
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
                      {!editingPatient ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0 cursor-pointer text-muted-foreground hover:text-brand-hover"
                          onClick={() => setEditingPatient(true)}
                          title="Edit patient details"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs cursor-pointer text-muted-foreground hover:text-red-600"
                          onClick={() => {
                            setEditingPatient(false);
                            setEditName(detail.patientName);
                            setEditEmail(detail.patientEmail);
                            setEditPhone(detail.patientPhone);
                            setEditDob(detail.patientDob ? format(parseISO(detail.patientDob), "yyyy-MM-dd") : "");
                            setEditInsuranceVerified(detail.insuranceVerified ?? false);
                          }}
                        >
                          <X className="size-3 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>

                    {editingPatient ? (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-patient-name" className="text-xs font-medium text-muted-foreground">
                            Full Name
                          </Label>
                          <Input
                            id="edit-patient-name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-9 text-sm"
                            disabled={patientSaving}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-patient-phone" className="text-xs font-medium text-muted-foreground">
                            Phone
                          </Label>
                          <Input
                            id="edit-patient-phone"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="h-9 text-sm"
                            disabled={patientSaving}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-patient-email" className="text-xs font-medium text-muted-foreground">
                            Email
                          </Label>
                          <Input
                            id="edit-patient-email"
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="h-9 text-sm"
                            disabled={patientSaving}
                          />
                        </div>
                        {/* Feature 3.1: DOB Edit */}
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-patient-dob" className="text-xs font-medium text-muted-foreground">
                            Date of Birth
                          </Label>
                          <Input
                            id="edit-patient-dob"
                            type="date"
                            value={editDob}
                            onChange={(e) => setEditDob(e.target.value)}
                            className="h-9 text-sm"
                            disabled={patientSaving}
                          />
                        </div>
                        <Button
                          size="sm"
                          className="w-full bg-brand hover:bg-brand-hover text-white cursor-pointer"
                          disabled={patientSaving || !editName.trim() || !editEmail.trim()}
                          onClick={handleSavePatient}
                        >
                          {patientSaving ? (
                            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5 mr-1.5" />
                          )}
                          Save Changes
                        </Button>
                      </div>
                    ) : (
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
                    )}

                    {/* Insurance Info Received checkbox (always visible) */}
                    <Separator />
                    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                      <Checkbox
                        checked={editingPatient ? editInsuranceVerified : (detail.insuranceVerified ?? false)}
                        onCheckedChange={(checked) => {
                          const val = checked === true;
                          if (editingPatient) {
                            setEditInsuranceVerified(val);
                          } else {
                            // Quick-toggle without entering full edit mode
                            if (!selectedId) return;
                            fetch(`/api/staff/appointments/${selectedId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ insuranceVerified: val }),
                            })
                              .then((res) => {
                                if (res.ok) {
                                  setDetail((prev) => prev ? { ...prev, insuranceVerified: val } : null);
                                  toast.success(val ? "Insurance info marked as received" : "Insurance info mark removed");
                                } else {
                                  toast.error("Failed to update");
                                }
                              })
                              .catch(() => toast.error("Failed to update"));
                          }
                        }}
                        disabled={patientSaving}
                        className="data-[state=checked]:bg-brand data-[state=checked]:border-brand"
                      />
                      <div>
                        <span className="text-sm font-medium text-foreground group-hover:text-brand-hover transition-colors">
                          Insurance Info Received
                        </span>
                        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          Confirm that the patient&apos;s insurance card/information has been received
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Appointment Info Card */}
                  <div className="rounded-lg border border-border/60 p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center">
                        <FileText className="size-4 text-brand" />
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
                          <Badge variant="outline" className="border-brand-border text-brand bg-brand-muted text-[10px]">
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

                {/* Feature 5.1 & 5.2: Telehealth / Video Link Section */}
                {detail.modality === "VIDEO" && (
                  <div data-video-link-section className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-blue-700">
                      <Video className="size-4" />
                      Telehealth
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="edit-video-link" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                          Video Link
                        </Label>
                        <Input
                          id="edit-video-link"
                          value={editVideoLink}
                          onChange={(e) => setEditVideoLink(e.target.value)}
                          placeholder="https://meet.example.com/..."
                          className="h-9 text-sm flex-1"
                          disabled={videoLinkSaving}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs cursor-pointer border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                          disabled={videoLinkSaving || !editVideoLink.trim()}
                          onClick={handleSaveVideoLink}
                        >
                          {videoLinkSaving ? (
                            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Link2 className="size-3.5 mr-1.5" />
                          )}
                          Save Link
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs cursor-pointer border-brand-border text-brand hover:bg-brand-subtle hover:text-brand-hover"
                          disabled={videoLinkSending || !editVideoLink.trim()}
                          onClick={handleSendVideoLink}
                        >
                          {videoLinkSending ? (
                            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Send className="size-3.5 mr-1.5" />
                          )}
                          Send Video Link
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Insurance Info */}
                <div className="rounded-lg border border-border/60 p-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Shield className="size-4 text-brand" />
                    Insurance
                  </h4>
                  {detail.insurance ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{detail.insurance.name}</p>
                        {detail.isDemoInsurance && (
                          <Badge variant="outline" className="mt-1 border-brand-border text-brand bg-brand-muted text-[10px]">
                            Demo Plan
                          </Badge>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        {detail.isDemoInsurance ? (
                          <span className="text-brand font-medium">Free</span>
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
                      <CreditCard className="size-4 text-brand" />
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

                    {/* Feature 6.1: Send Payment Request */}
                    <Separator className="my-3" />
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Send Payment Request
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder={detail.selfPayCents > 0 ? formatCents(detail.selfPayCents) : "0.00"}
                            value={paymentRequestAmount}
                            onChange={(e) => setPaymentRequestAmount(e.target.value)}
                            className="pl-8 h-8 text-sm"
                            disabled={paymentRequestSending}
                          />
                        </div>
                        <Button
                          size="sm"
                          className="h-8 text-xs cursor-pointer bg-brand hover:bg-brand-hover text-white"
                          disabled={paymentRequestSending || !paymentRequestAmount || parseFloat(paymentRequestAmount) <= 0}
                          onClick={handleSendPaymentRequest}
                        >
                          {paymentRequestSending ? (
                            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Send className="size-3.5 mr-1.5" />
                          )}
                          Send Request
                        </Button>
                      </div>
                    </div>

                    {/* Feature 6.2: Manual Refund Override */}
                    {detail.paymentStatus === "AUTHORIZED" || detail.paymentStatus === "CAPTURED" ? (
                      <>
                        <Separator className="my-3" />
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Manual Actions</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs cursor-pointer border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setRefundDialogOpen(true)}
                          >
                            <DollarSign className="size-3.5 mr-1.5" />
                            Refund Deposit ({formatCents(detail.ledger.amountCents)})
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}

                {/* Patient Token */}
                {detail.tokens.length > 0 && (
                  <div className="rounded-lg border border-border/60 p-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Hash className="size-4 text-brand" />
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
                <div data-notes-section className="rounded-lg border border-border/60 p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <StickyNote className="size-4 text-brand" />
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
                            <div className="size-6 rounded-full bg-brand-subtle flex items-center justify-center text-[10px] font-semibold text-brand-hover">
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
                      className="size-9 shrink-0 bg-brand hover:bg-brand-hover text-white cursor-pointer self-end"
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
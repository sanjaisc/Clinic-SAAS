"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Search,
  CalendarCheck,
  Clock,
  Video,
  MapPin,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Ban,
  UserX,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  Users,
  Mail,
  Phone,
  Merge,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppointmentRow {
  id: string;
  patientName: string;
  patientDob: string;
  patientPhone: string;
  patientEmail: string;
  patientType: string;
  reasonForVisit: string;
  modality: string;
  startTime: string;
  endTime: string;
  status: string;
  depositCents: number;
  selfPayCents: number;
  paymentStatus: string;
  paymentMethod: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  clinic: { id: string; name: string };
  provider: { id: string; firstName: string; lastName: string; credentials: string | null };
  service: { id: string; name: string };
  slot: { id: string; modality: string; status: string };
}

interface WaitlistRow {
  id: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientType: string;
  modality: string | null;
  status: string;
  dateFrom: string;
  dateTo: string;
  contactCount: number;
  lastContactAt: string | null;
  clinicId: string;
  clinicName: string;
  providerName: string;
  serviceName: string;
  createdAt: string;
  updatedAt: string;
}

interface MatchGroup {
  matchType: "email" | "phone";
  matchValue: string;
  hasNameMismatch: boolean;
  hasCrossClinic: boolean;
  appointments: Array<{
    id: string;
    patientName: string;
    patientEmail: string;
    patientPhone: string;
    clinicId: string;
    clinicName: string;
    providerName: string;
    serviceName: string;
    startTime: string;
    status: string;
  }>;
}

interface ClinicOption {
  id: string;
  name: string;
}

// ─── Status Badge Helper ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    BOOKED: { label: "Booked", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200" },
    CHECKED_IN: { label: "Checked In", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200" },
    COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200" },
    ARCHIVED: { label: "Archived", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200" },
    CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200" },
    NO_SHOW: { label: "No Show", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200" },
  };
  const c = config[status] || { label: status, className: "bg-gray-100 text-gray-600 border-gray-200" };
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function WaitlistStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: "Active", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200" },
    OFFERED: { label: "Offered", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200" },
    FULFILLED: { label: "Fulfilled", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200" },
    EXPIRED: { label: "Expired", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200" },
    REMOVED: { label: "Removed", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200" },
  };
  const c = config[status] || { label: status, className: "bg-gray-100 text-gray-600 border-gray-200" };
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminAppointmentsPage() {
  const { toast } = useToast();

  // ─── Shared state ─────────────────────────────────────────────────────────
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(true);

  // Fetch clinic list for dropdowns
  useEffect(() => {
    async function fetchClinics() {
      try {
        const res = await fetch("/api/staff/admin");
        if (!res.ok) return;
        const data = await res.json();
        if (data.clinicSummary) {
          setClinics(data.clinicSummary.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        }
      } catch {
        // silent
      } finally {
        setClinicsLoading(false);
      }
    }
    fetchClinics();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CalendarCheck className="size-5 text-purple-600" />
          Appointment & Exception Oversight
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Platform-wide appointment search, waitlist oversight, and duplicate patient detection
        </p>
      </div>

      <Tabs defaultValue="appointments" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="appointments" className="gap-1.5">
            <CalendarCheck className="size-3.5" />
            <span className="hidden sm:inline">Global Appointments</span>
            <span className="sm:hidden">Appts</span>
          </TabsTrigger>
          <TabsTrigger value="waitlist" className="gap-1.5">
            <Clock className="size-3.5" />
            <span className="hidden sm:inline">Waitlist</span>
          </TabsTrigger>
          <TabsTrigger value="matches" className="gap-1.5">
            <Users className="size-3.5" />
            <span className="hidden sm:inline">Patient Matches</span>
            <span className="sm:hidden">Matches</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments">
          <GlobalAppointmentsTab clinics={clinics} clinicsLoading={clinicsLoading} />
        </TabsContent>

        <TabsContent value="waitlist">
          <WaitlistTab clinics={clinics} clinicsLoading={clinicsLoading} />
        </TabsContent>

        <TabsContent value="matches">
          <PatientMatchesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tab 1: Global Appointments ─────────────────────────────────────────────

function GlobalAppointmentsTab({
  clinics,
  clinicsLoading,
}: {
  clinics: ClinicOption[];
  clinicsLoading: boolean;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clinicFilter, setClinicFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Refund dialog
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAppt, setRefundAppt] = useState<AppointmentRow | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelAppt, setCancelAppt] = useState<AppointmentRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const totalPages = Math.ceil(total / limit);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (clinicFilter && clinicFilter !== "all") params.set("clinicId", clinicFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/staff/admin/appointments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAppointments(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch {
      toast({ title: "Error", description: "Failed to load appointments", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, clinicFilter, dateFrom, dateTo, page, limit, toast]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleSearch = () => {
    setPage(1);
    fetchAppointments();
  };

  const handleStatusOverride = async (id: string, newStatus: string, reason?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/staff/admin/appointments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, cancellationReason: reason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast({ title: "Updated", description: `Status changed to ${newStatus}` });
      fetchAppointments();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setActionLoading(false);
      setCancelDialogOpen(false);
      setCancelAppt(null);
      setCancelReason("");
    }
  };

  const handleRefund = async () => {
    if (!refundAppt) return;
    setRefundLoading(true);
    try {
      const amount = parseInt(refundAmount, 10);
      if (isNaN(amount) || amount < 0) throw new Error("Invalid amount");
      if (!refundReason.trim()) throw new Error("Reason is required");

      const res = await fetch(`/api/staff/admin/appointments/${refundAppt.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: amount, reason: refundReason }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Refund failed");
      }
      toast({ title: "Refund Processed", description: `$${(amount / 100).toFixed(2)} refund created` });
      setRefundDialogOpen(false);
      setRefundAppt(null);
      setRefundAmount("");
      setRefundReason("");
      fetchAppointments();
    } catch (e) {
      toast({ title: "Refund Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRefundLoading(false);
    }
  };

  const openRefundDialog = (apt: AppointmentRow) => {
    setRefundAppt(apt);
    setRefundAmount(String(apt.depositCents || 0));
    setRefundReason("");
    setRefundDialogOpen(true);
  };

  const openCancelDialog = (apt: AppointmentRow) => {
    setCancelAppt(apt);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="size-4 text-purple-600" />
          Global Appointment Search
        </CardTitle>
        <CardDescription>Search and manage appointments across all clinics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Patient name, email, phone, or booking token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="BOOKED">Booked</SelectItem>
                <SelectItem value="CHECKED_IN">Checked In</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="NO_SHOW">No Show</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={clinicFilter} onValueChange={(v) => { setClinicFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={clinicsLoading ? "Loading..." : "All Clinics"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clinics</SelectItem>
                {clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-[150px]"
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-[150px]"
              placeholder="To"
            />

            <Button onClick={handleSearch} size="sm" className="gap-1.5">
              <Search className="size-3.5" />
              Search
            </Button>
          </div>
        </div>

        {/* Results Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarCheck className="size-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No appointments found matching your criteria</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead className="hidden md:table-cell">Clinic</TableHead>
                    <TableHead className="hidden lg:table-cell">Provider</TableHead>
                    <TableHead className="hidden lg:table-cell">Service</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Payment</TableHead>
                    <TableHead className="hidden sm:table-cell">Modality</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((apt) => {
                    const isExpanded = expandedId === apt.id;
                    return (
                      <>
                        <TableRow key={apt.id}>
                          <TableCell className="p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => setExpandedId(isExpanded ? null : apt.id)}
                            >
                              {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{apt.patientName}</div>
                            <div className="text-xs text-muted-foreground">{apt.patientEmail}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="text-sm">{apt.clinic.name}</div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="text-sm">
                              {apt.provider.firstName} {apt.provider.lastName}
                              {apt.provider.credentials && <span className="text-muted-foreground">, {apt.provider.credentials}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="text-sm">{apt.service.name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {format(new Date(apt.startTime), "MMM d, yyyy")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(apt.startTime), "h:mm a")} – {format(new Date(apt.endTime), "h:mm a")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={apt.status} />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <div className="text-sm">{formatCents(apt.depositCents || 0)}</div>
                            <div className="text-xs text-muted-foreground">{apt.paymentStatus}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="text-xs">
                              {apt.modality === "VIDEO" ? (
                                <><Video className="size-3 mr-1" /> Video</>
                              ) : (
                                <><MapPin className="size-3 mr-1" /> In-Person</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {apt.status !== "CANCELLED" && apt.status !== "NO_SHOW" && apt.status !== "ARCHIVED" && apt.status !== "COMPLETED" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  title="Cancel"
                                  onClick={() => openCancelDialog(apt)}
                                >
                                  <Ban className="size-3.5" />
                                </Button>
                              )}
                              {apt.status !== "NO_SHOW" && apt.status !== "CANCELLED" && apt.status !== "COMPLETED" && apt.status !== "ARCHIVED" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                  title="Mark No-Show"
                                  onClick={() => handleStatusOverride(apt.id, "NO_SHOW")}
                                >
                                  <UserX className="size-3.5" />
                                </Button>
                              )}
                              {(apt.status === "BOOKED" || apt.status === "CHECKED_IN") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                  title="Complete"
                                  onClick={() => handleStatusOverride(apt.id, "COMPLETED")}
                                >
                                  <CheckCircle2 className="size-3.5" />
                                </Button>
                              )}
                              {apt.paymentStatus !== "REFUNDED" && apt.paymentStatus !== "FORFEITED" && (apt.depositCents > 0 || apt.selfPayCents > 0) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  title="Refund"
                                  onClick={() => openRefundDialog(apt)}
                                >
                                  <DollarSign className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${apt.id}-detail`}>
                            <TableCell colSpan={10} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Phone</span>
                                  <span>{apt.patientPhone}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">DOB</span>
                                  <span>{format(new Date(apt.patientDob), "MMM d, yyyy")}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Patient Type</span>
                                  <span>{apt.patientType}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Reason for Visit</span>
                                  <span>{apt.reasonForVisit}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Payment Method</span>
                                  <span>{apt.paymentMethod || "N/A"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Self-Pay</span>
                                  <span>{formatCents(apt.selfPayCents || 0)}</span>
                                </div>
                                {apt.cancellationReason && (
                                  <div>
                                    <span className="text-muted-foreground block text-xs mb-1">Cancel Reason</span>
                                    <span className="text-red-600">{apt.cancellationReason}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground block text-xs mb-1">Appointment ID</span>
                                  <span className="font-mono text-xs">{apt.id}</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {total} result{total !== 1 ? "s" : ""} &middot; Page {page} of {totalPages || 1}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the appointment for <strong>{cancelAppt?.patientName}</strong>?
              This will release the slot and is a system manager override.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="cancel-reason">Cancellation Reason</Label>
            <Select value={cancelReason} onValueChange={setCancelReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLINIC_CANCELLED">Clinic Cancelled</SelectItem>
                <SelectItem value="PATIENT_CANCELLED">Patient Cancelled</SelectItem>
                <SelectItem value="DOUBLE_BOOKING">Double Booking</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!cancelReason || actionLoading}
              onClick={() => cancelAppt && handleStatusOverride(cancelAppt.id, "CANCELLED", cancelReason)}
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Ban className="size-4 mr-1.5" />}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Refund Override</DialogTitle>
            <DialogDescription>
              Issue a refund for <strong>{refundAppt?.patientName}</strong>. This is a system manager override.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund Amount (cents)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  id="refund-amount"
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="2500"
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter amount in cents. {(parseInt(refundAmount) || 0) / 100 > 0 && (
                  <>Display: <strong>${((parseInt(refundAmount) || 0) / 100).toFixed(2)}</strong></>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason</Label>
              <Textarea
                id="refund-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Describe the reason for this manual refund..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!refundReason.trim() || refundLoading}
              onClick={handleRefund}
            >
              {refundLoading ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <DollarSign className="size-4 mr-1.5" />}
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Tab 2: Waitlist Oversight ───────────────────────────────────────────────

function WaitlistTab({ clinics, clinicsLoading }: { clinics: ClinicOption[]; clinicsLoading: boolean }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE,OFFERED");
  const [clinicFilter, setClinicFilter] = useState<string>("all");
  const [entries, setEntries] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWaitlist = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (clinicFilter && clinicFilter !== "all") params.set("clinicId", clinicFilter);

      const res = await fetch(`/api/staff/admin/waitlist?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEntries(data.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load waitlist", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, clinicFilter, toast]);

  useEffect(() => {
    fetchWaitlist();
  }, [fetchWaitlist]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="size-4 text-purple-600" />
          Waitlist Oversight
        </CardTitle>
        <CardDescription>Aggregated waitlist entries across all clinics</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE,OFFERED">Active & Offered</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="OFFERED">Offered</SelectItem>
              <SelectItem value="FULFILLED">Fulfilled</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="REMOVED">Removed</SelectItem>
              <SelectItem value="">All</SelectItem>
            </SelectContent>
          </Select>

          <Select value={clinicFilter} onValueChange={setClinicFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={clinicsLoading ? "Loading..." : "All Clinics"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clinics</SelectItem>
              {clinics.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchWaitlist}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="size-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No waitlist entries found</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Clinic</TableHead>
                  <TableHead className="hidden lg:table-cell">Provider</TableHead>
                  <TableHead className="hidden lg:table-cell">Service</TableHead>
                  <TableHead className="hidden sm:table-cell">Date Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Contacts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{entry.patientName}</div>
                      <div className="text-xs text-muted-foreground">{entry.patientEmail}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">{entry.clinicName}</div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-sm">{entry.providerName}</div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-sm">{entry.serviceName}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="text-sm">
                        {format(new Date(entry.dateFrom), "MMM d")} – {format(new Date(entry.dateTo), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <WaitlistStatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm font-medium">{entry.contactCount}</div>
                      {entry.lastContactAt && (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(entry.lastContactAt), "MMM d")}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab 3: Patient Matches ──────────────────────────────────────────────────

function PatientMatchesTab() {
  const { toast } = useToast();
  const [matches, setMatches] = useState<MatchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staff/admin/patient-matches");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMatches(data.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load patient matches", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleMergeMark = async (group: MatchGroup) => {
    // For now, this just marks as reviewed by showing a toast
    // In a real implementation, this would create a note or flag
    toast({
      title: "Marked as Reviewed",
      description: `Group matching ${group.matchType} "${group.matchValue}" has been marked for review. (Note: full merge functionality pending)`,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4 text-purple-600" />
              Ambiguous Patient Matches
            </CardTitle>
            <CardDescription>
              Potential duplicate profiles sharing the same email or phone
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchMatches}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="size-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No ambiguous patient matches found</p>
            <p className="text-xs mt-1">Matches appear when patients share email/phone but have different names or use different clinics</p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((group, gi) => {
              const isExpanded = expandedGroup === gi;
              return (
                <div
                  key={`${group.matchType}-${group.matchValue}-${gi}`}
                  className="rounded-lg border overflow-hidden"
                >
                  {/* Group Header */}
                  <button
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedGroup(isExpanded ? null : gi)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
                        group.matchType === "email"
                          ? "bg-blue-100 dark:bg-blue-900/40"
                          : "bg-emerald-100 dark:bg-emerald-900/40"
                      }`}>
                        {group.matchType === "email" ? (
                          <Mail className="size-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Phone className="size-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {group.matchType === "email" ? group.matchValue : group.matchValue}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {group.appointments.length} appointment{group.appointments.length !== 1 ? "s" : ""}
                          </span>
                          {group.hasNameMismatch && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                              <AlertTriangle className="size-3 mr-1" />
                              Name Mismatch
                            </Badge>
                          )}
                          {group.hasCrossClinic && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800">
                              Cross-Clinic
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMergeMark(group);
                        }}
                      >
                        <Merge className="size-3" />
                        Merge
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-4">
                      <div className="rounded-lg border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>Patient Name</TableHead>
                              <TableHead className="hidden sm:table-cell">Email</TableHead>
                              <TableHead className="hidden sm:table-cell">Phone</TableHead>
                              <TableHead>Clinic</TableHead>
                              <TableHead className="hidden md:table-cell">Provider</TableHead>
                              <TableHead className="hidden md:table-cell">Service</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.appointments.map((apt) => (
                              <TableRow key={apt.id}>
                                <TableCell className="font-medium">
                                  {group.hasNameMismatch && (
                                    <AlertTriangle className="size-3 text-amber-500 inline mr-1.5" />
                                  )}
                                  {apt.patientName}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm">{apt.patientEmail}</TableCell>
                                <TableCell className="hidden sm:table-cell text-sm">{apt.patientPhone}</TableCell>
                                <TableCell className="text-sm">{apt.clinicName}</TableCell>
                                <TableCell className="hidden md:table-cell text-sm">{apt.providerName}</TableCell>
                                <TableCell className="hidden md:table-cell text-sm">{apt.serviceName}</TableCell>
                                <TableCell className="text-sm">
                                  {format(new Date(apt.startTime), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={apt.status} />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && matches.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">
            {matches.length} potential match group{matches.length !== 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
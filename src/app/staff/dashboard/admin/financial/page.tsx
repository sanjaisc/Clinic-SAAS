"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  ShieldAlert,
  ScrollText,
  FileWarning,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentException {
  id: string;
  type: string;
  appointmentId: string;
  patientName: string;
  clinicName: string;
  amountCents: number;
  createdAt: string;
  resolved: boolean;
  resolvedNote?: string | null;
  ledgerId?: string;
  paymentStatus?: string;
  refundStatus?: string;
}

interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string;
  userClinic: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  appointmentId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface ErrorLogEntry {
  id: string;
  level: string;
  source: string;
  message: string;
  path: string | null;
  stack: string | null;
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FinancialAdminPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="exceptions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="exceptions" className="gap-1.5">
            <ShieldAlert className="size-4" />
            <span className="hidden sm:inline">Payment Exceptions</span>
            <span className="sm:hidden">Exceptions</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <ScrollText className="size-4" />
            <span className="hidden sm:inline">Audit Logs</span>
            <span className="sm:hidden">Audit</span>
          </TabsTrigger>
          <TabsTrigger value="errors" className="gap-1.5">
            <FileWarning className="size-4" />
            <span className="hidden sm:inline">Error Logs</span>
            <span className="sm:hidden">Errors</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exceptions" className="mt-4">
          <PaymentExceptionsTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditLogsTab />
        </TabsContent>
        <TabsContent value="errors" className="mt-4">
          <ErrorLogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: Payment Exception Queue
// ═══════════════════════════════════════════════════════════════════════════════

function PaymentExceptionsTab() {
  const [exceptions, setExceptions] = useState<PaymentException[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [resolvedFilter, setResolvedFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [stats, setStats] = useState({ total: 0, unresolved: 0 });
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<PaymentException | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (resolvedFilter !== "ALL") params.set("resolved", resolvedFilter);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/staff/admin/payments/exceptions?${params}`);
      if (!res.ok) throw new Error("Failed to fetch exceptions");
      const json = await res.json();

      setExceptions(json.data);
      setPagination(json.pagination);

      // Compute stats from full dataset (first page, all types, no resolved filter)
      const statsRes = await fetch("/api/staff/admin/payments/exceptions?limit=1000");
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        setStats({
          total: statsJson.pagination.total,
          unresolved: statsJson.data.filter((e: PaymentException) => !e.resolved).length,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load payment exceptions");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, resolvedFilter, page]);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/staff/admin/payments/exceptions/${resolveTarget.id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: resolveNote || undefined }),
      });
      if (!res.ok) throw new Error("Failed to resolve exception");
      toast.success("Exception resolved successfully");
      setResolveDialogOpen(false);
      setResolveNote("");
      fetchExceptions();
    } catch (err) {
      console.error(err);
      toast.error("Failed to resolve exception");
    } finally {
      setResolving(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "REFUND_FAILED":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">Failed Refund</Badge>;
      case "ORPHANED":
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200">Orphaned</Badge>;
      case "DISPUTED":
        return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200">Disputed</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Exceptions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center size-10 rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.unresolved}</p>
              <p className="text-sm text-muted-foreground">Unresolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Exception Type</Label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="REFUND_FAILED">Failed Refunds</SelectItem>
                  <SelectItem value="ORPHANED">Orphaned Payments</SelectItem>
                  <SelectItem value="DISPUTED">Disputed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={resolvedFilter} onValueChange={(v) => { setResolvedFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="false">Unresolved</SelectItem>
                  <SelectItem value="true">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : exceptions.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="size-8 text-brand mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No exceptions found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Appointment ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead className="hidden md:table-cell">Clinic</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptions.map((exc) => (
                    <TableRow key={exc.id} className={exc.resolved ? "opacity-60" : ""}>
                      <TableCell className="font-mono text-xs">
                        {exc.appointmentId.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="font-medium">{exc.patientName}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {truncate(exc.clinicName, 20)}
                      </TableCell>
                      <TableCell>{getTypeBadge(exc.type)}</TableCell>
                      <TableCell className="font-medium">{formatCents(exc.amountCents)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        {format(new Date(exc.createdAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        {exc.resolved ? (
                          <Badge variant="outline" className="text-brand border-brand-border bg-brand-muted ">
                            <CheckCircle2 className="size-3 mr-1" />
                            Resolved
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setResolveTarget(exc);
                              setResolveNote("");
                              setResolveDialogOpen(true);
                            }}
                          >
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </p>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Payment Exception</DialogTitle>
            <DialogDescription>
              {resolveTarget && (
                <>
                  {resolveTarget.type === "REFUND_FAILED"
                    ? "Mark this failed refund as resolved. The refund status will be set to REFUNDED."
                    : resolveTarget.type === "ORPHANED"
                      ? "Mark this orphaned payment as resolved. The appointment payment status will be set to FORFEITED."
                      : "Mark this disputed refund as resolved. The refund status will be set to REFUNDED."}
                  <div className="mt-2 text-xs text-muted-foreground">
                    Appointment: {resolveTarget.appointmentId.slice(0, 12)}… · Patient: {resolveTarget.patientName} · {formatCents(resolveTarget.amountCents)}
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="resolve-note">Resolution Note</Label>
            <Textarea
              id="resolve-note"
              placeholder="Describe the resolution action taken..."
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)} disabled={resolving}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={resolving}>
              {resolving && <RefreshCw className="size-4 mr-2 animate-spin" />}
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: Audit Logs
// ═══════════════════════════════════════════════════════════════════════════════

const AUDIT_ACTION_OPTIONS = [
  "BOOKING_CREATED", "BOOKING_CANCELLED", "BOOKING_CHECKED_IN", "BOOKING_COMPLETED",
  "BOOKING_NO_SHOW", "BOOKING_RESCHEDULED",
  "SLOT_BLOCKED", "SLOT_UNBLOCKED", "SLOT_GENERATED",
  "DEPOSIT_AUTHORIZED", "DEPOSIT_CAPTURED", "REFUND_INITIATED", "REFUND_COMPLETED", "REFUND_FAILED",
  "CLINIC_CREATED", "CLINIC_UPDATED", "CLINIC_SUSPENDED", "CLINIC_PUBLISHED",
  "PROVIDER_CREATED", "PROVIDER_UPDATED", "PROVIDER_SUSPENDED",
  "STAFF_LOGIN", "STAFF_LOGOUT", "STAFF_INVITATION_CREATED", "STAFF_INVITATION_ACCEPTED", "STAFF_INVITATION_REVOKED",
  "TEMPLATE_CREATED", "TEMPLATE_UPDATED", "TEMPLATE_DEACTIVATED",
  "REVIEW_SUBMITTED", "SYSTEM_CONFIG_UPDATED", "WAITLIST_PROCESSED",
  "PAYMENT_EXCEPTION_RESOLVED", "ERROR_LOG_RESOLVED",
];

const TARGET_TYPE_OPTIONS = [
  "APPOINTMENT", "SLOT", "CLINIC", "PROVIDER", "SERVICE", "SPECIALTY",
  "USER", "APPOINTMENT_LEDGER", "SYSTEM_ERROR_LOG", "SYSTEM_CONFIG",
  "STAFF_INVITATION", "EMAIL_TEMPLATE", "SLOT_TEMPLATE", "CLOSURE",
];

function getActionBadgeColor(action: string) {
  if (action.includes("CANCELLED") || action.includes("FAILED") || action.includes("SUSPENDED") || action.includes("REVOKED") || action.includes("DEACTIVATED")) {
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200";
  }
  if (action.includes("CREATED") || action.includes("COMPLETED") || action.includes("ACCEPTED") || action.includes("PUBLISHED") || action.includes("SUBMITTED")) {
    return "bg-brand-subtle text-brand-hover  border-brand-border";
  }
  if (action.includes("UPDATED") || action.includes("RESCHEDULED") || action.includes("RESOLVED") || action.includes("CAPTURED")) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200";
  }
  if (action.includes("LOGIN") || action.includes("LOGOUT")) {
    return "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200";
  }
  return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200";
}

function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [userFilter, setUserFilter] = useState<string>("ALL");
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      if (userFilter !== "ALL") params.set("userId", userFilter);
      if (targetTypeFilter !== "ALL") params.set("targetType", targetTypeFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      params.set("page", String(page));
      params.set("limit", "50");

      const res = await fetch(`/api/staff/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      const json = await res.json();
      setLogs(json.data);
      setPagination(json.pagination);

      // Collect unique users for dropdown
      const userMap = new Map<string, string>();
      json.data.forEach((log: AuditLogEntry) => {
        if (log.userId && !userMap.has(log.userId)) {
          userMap.set(log.userId, log.userName);
        }
      });
      setAllUsers(
        Array.from(userMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, userFilter, targetTypeFilter, fromDate, toDate, page]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const resetFilters = () => {
    setActionFilter("ALL");
    setUserFilter("ALL");
    setTargetTypeFilter("ALL");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const hasActiveFilters = actionFilter !== "ALL" || userFilter !== "ALL" || targetTypeFilter !== "ALL" || fromDate || toDate;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Action</Label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Actions</SelectItem>
                  {AUDIT_ACTION_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">User</Label>
              <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Users</SelectItem>
                  <SelectItem value="__system__">System</SelectItem>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Target Type</Label>
              <Select value={targetTypeFilter} onValueChange={(v) => { setTargetTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All targets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Target Types</SelectItem>
                  {TARGET_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RefreshCw className="size-3 mr-1" />
                Reset Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center">
                <ScrollText className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No audit logs found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="hidden md:table-cell">Target Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Target ID</TableHead>
                    <TableHead className="hidden xl:table-cell">Clinic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {log.userName}
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionBadgeColor(log.action)}>
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {log.targetType?.replace(/_/g, " ") ?? "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                        {log.targetId ? truncate(log.targetId, 12) : "—"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        {log.userClinic ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </p>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: System Error Logs
// ═══════════════════════════════════════════════════════════════════════════════

const ERROR_LEVEL_OPTIONS = ["ERROR", "WARN", "INFO"];
const ERROR_SOURCE_OPTIONS = ["API", "AUTH", "CRON", "SLOT_GEN", "LOCK_SWEEP", "WAITLIST"];

function getLevelBadge(level: string) {
  switch (level) {
    case "ERROR":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200">ERROR</Badge>;
    case "WARN":
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200">WARN</Badge>;
    case "INFO":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200">INFO</Badge>;
    default:
      return <Badge variant="secondary">{level}</Badge>;
  }
}

function getLevelIcon(level: string) {
  switch (level) {
    case "ERROR":
      return <AlertCircle className="size-4 text-red-500 shrink-0" />;
    case "WARN":
      return <AlertTriangle className="size-4 text-amber-500 shrink-0" />;
    case "INFO":
      return <Info className="size-4 text-blue-500 shrink-0" />;
    default:
      return <Info className="size-4 text-muted-foreground shrink-0" />;
  }
}

function ErrorLogsTab() {
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [resolvedFilter, setResolvedFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchErrorLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (levelFilter !== "ALL") params.set("level", levelFilter);
      if (sourceFilter !== "ALL") params.set("source", sourceFilter);
      if (resolvedFilter !== "ALL") params.set("resolved", resolvedFilter);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/staff/admin/error-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch error logs");
      const json = await res.json();
      setLogs(json.data);
      setPagination(json.pagination);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load error logs");
    } finally {
      setLoading(false);
    }
  }, [levelFilter, sourceFilter, resolvedFilter, page]);

  useEffect(() => {
    fetchErrorLogs();
  }, [fetchErrorLogs]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/staff/admin/error-logs/${id}/resolve`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to resolve error log");
      toast.success("Error log marked as resolved");
      fetchErrorLogs();
    } catch (err) {
      console.error(err);
      toast.error("Failed to resolve error log");
    } finally {
      setResolvingId(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Level</Label>
              <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Levels</SelectItem>
                  {ERROR_LEVEL_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Source</Label>
              <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sources</SelectItem>
                  {ERROR_SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Resolved</Label>
              <Select value={resolvedFilter} onValueChange={(v) => { setResolvedFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="false">Unresolved</SelectItem>
                  <SelectItem value="true">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="size-8 text-brand mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No error logs found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="hidden md:table-cell">Path</TableHead>
                    <TableHead>Resolved</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const isExpanded = expandedId === log.id;
                    return (
                      <>
                        <TableRow key={log.id} className={log.resolved ? "opacity-60" : ""}>
                          <TableCell className="p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              onClick={() => toggleExpand(log.id)}
                            >
                              <ChevronsUpDown className="size-3.5" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                          </TableCell>
                          <TableCell>{getLevelBadge(log.level)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.source}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] lg:max-w-[300px]">
                            <div className="flex items-center gap-1.5">
                              {getLevelIcon(log.level)}
                              <span className="text-xs truncate">{truncate(log.message, 60)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                            {log.path ? truncate(log.path, 30) : "—"}
                          </TableCell>
                          <TableCell>
                            {log.resolved ? (
                              <Badge variant="outline" className="text-brand border-brand-border bg-brand-muted text-xs">
                                <CheckCircle2 className="size-3 mr-1" />
                                Resolved
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-900/20 text-xs">
                                <Clock className="size-3 mr-1" />
                                Open
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!log.resolved && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={resolvingId === log.id}
                                onClick={() => handleResolve(log.id)}
                              >
                                {resolvingId === log.id ? (
                                  <RefreshCw className="size-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="size-3.5 mr-1" />
                                )}
                                Resolve
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {/* Expanded row */}
                        {isExpanded && (
                          <TableRow key={`${log.id}-detail`} className="bg-muted/30">
                            <TableCell colSpan={8} className="p-4">
                              <div className="space-y-2">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Full Message</p>
                                  <pre className="text-xs bg-background border rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                    {log.message}
                                  </pre>
                                </div>
                                {log.stack && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Stack Trace</p>
                                    <pre className="text-xs bg-background border rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto text-red-700 dark:text-red-400">
                                      {log.stack}
                                    </pre>
                                  </div>
                                )}
                                {log.path && (
                                  <p className="text-xs text-muted-foreground">
                                    <span className="font-medium">Path:</span> {log.path}
                                  </p>
                                )}
                                {log.resolved && log.resolvedAt && (
                                  <p className="text-xs text-brand">
                                    Resolved at: {format(new Date(log.resolvedAt), "MMM d, yyyy HH:mm")}
                                    {log.resolvedBy && ` by ${log.resolvedBy}`}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </p>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
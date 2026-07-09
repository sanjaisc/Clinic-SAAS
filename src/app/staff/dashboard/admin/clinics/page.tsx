"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Star,
  Users,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Pencil,
  AlertTriangle,
  Loader2,
  Building2,
  ExternalLink,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  CLINIC_STATUS,
  CLINIC_STATUSES,
  type ClinicStatus,
} from "@/lib/enums";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClinicRow {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  status: string;
  providerCount: number;
  todayAppointments: number;
  avgRating: number;
  createdAt: string;
  updatedAt: string;
}

interface ClinicDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  phoneNumber: string;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  about: string | null;
  hoursOfOperation: string | null;
  faq: string | null;
  galleryUrls: string | null;
  status: string;
  inPersonDepositCents: number;
  videoDepositCents: number;
  selfPayFlatRateCents: number;
  cancellationLeadTimeMin: number;
  videoCancellationLeadTimeMin: number;
  reschedulePolicy: string;
  parkingInstructions: string | null;
  visitInstructions: string | null;
  emailFromName: string | null;
  customEmailHeader: string | null;
  commonInstructions: string | null;
  intakeReminderDays: string;
  intakeFormIds: string | null;
  isFeatured: boolean;
  featuredExpiry: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    providers: number;
    appointments: number;
    reviews: number;
    staff: number;
  };
}

// ─── Status badge config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
  },
  PENDING: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  },
  PUBLISHED: {
    label: "Published",
    className: "bg-brand-muted text-brand-hover border-brand-border  ",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminClinicsPage() {
  // State
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Status change dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusClinic, setStatusClinic] = useState<ClinicRow | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusChanging, setStatusChanging] = useState(false);

  // Emergency edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [clinicDetail, setClinicDetail] = useState<ClinicDetail | null>(null);
  const [editData, setEditData] = useState<Record<string, string | number | boolean | null>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch clinics
  const fetchClinics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/staff/admin/clinics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch clinics");
      const data = await res.json();
      setClinics(data.clinics);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch {
      toast.error("Failed to load clinics");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    fetchClinics();
  }, [fetchClinics]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  // ─── Status Change ─────────────────────────────────────

  const openStatusDialog = (clinic: ClinicRow) => {
    setStatusClinic(clinic);
    setNewStatus(clinic.status);
    setStatusDialogOpen(true);
  };

  const handleStatusChange = async () => {
    if (!statusClinic || newStatus === statusClinic.status) return;
    setStatusChanging(true);
    try {
      const res = await fetch(`/api/staff/admin/clinics/${statusClinic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to change status");
      }
      toast.success(`Clinic status changed to ${newStatus}`);
      setStatusDialogOpen(false);
      fetchClinics();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to change status");
    } finally {
      setStatusChanging(false);
    }
  };

  // ─── Emergency Edit ────────────────────────────────────

  const openEditDialog = async (clinic: ClinicRow) => {
    setEditDialogOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/staff/admin/clinics/${clinic.id}`);
      if (!res.ok) throw new Error("Failed to fetch clinic details");
      const data = await res.json();
      const detail = data.clinic as ClinicDetail;
      setClinicDetail(detail);
      setEditData({
        name: detail.name,
        tagline: detail.tagline || "",
        streetAddress: detail.streetAddress,
        city: detail.city,
        state: detail.state,
        zipCode: detail.zipCode,
        phoneNumber: detail.phoneNumber,
        email: detail.email || "",
        website: detail.website || "",
        description: detail.description || "",
        about: detail.about || "",
        inPersonDepositCents: detail.inPersonDepositCents,
        videoDepositCents: detail.videoDepositCents,
        selfPayFlatRateCents: detail.selfPayFlatRateCents,
        cancellationLeadTimeMin: detail.cancellationLeadTimeMin,
        videoCancellationLeadTimeMin: detail.videoCancellationLeadTimeMin,
        reschedulePolicy: detail.reschedulePolicy,
        parkingInstructions: detail.parkingInstructions || "",
        visitInstructions: detail.visitInstructions || "",
        emailFromName: detail.emailFromName || "",
        customEmailHeader: detail.customEmailHeader || "",
        commonInstructions: detail.commonInstructions || "",
        intakeReminderDays: detail.intakeReminderDays,
        isFeatured: detail.isFeatured,
      });
    } catch {
      toast.error("Failed to load clinic details");
      setEditDialogOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleEmergencyEdit = async () => {
    if (!clinicDetail) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/staff/admin/clinics/${clinicDetail.id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save changes");
      }
      toast.success("Clinic updated successfully");
      setEditDialogOpen(false);
      fetchClinics();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Clinic Oversight
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage all clinics across the platform — {total} total
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="size-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {CLINIC_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_CONFIG[s]?.label || s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Clinics Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : clinics.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No clinics found</p>
            </div>
          ) : (
            <>
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Providers</TableHead>
                      <TableHead className="text-right">Today&apos;s Appts</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinics.map((clinic) => (
                      <ClinicTableRow
                        key={clinic.id}
                        clinic={clinic}
                        isExpanded={expandedId === clinic.id}
                        onToggle={() =>
                          setExpandedId(expandedId === clinic.id ? null : clinic.id)
                        }
                        onStatusChange={() => openStatusDialog(clinic)}
                        onEdit={() => openEditDialog(clinic)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ({total} clinics)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Change Clinic Status
            </DialogTitle>
            <DialogDescription>
              Changing status for <strong>{statusClinic?.name}</strong>
              {newStatus === CLINIC_STATUS.SUSPENDED && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400 text-xs">
                  ⚠ Suspending will block future slot generation. Existing booked appointments will be preserved.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label>Current Status</Label>
            <Badge className={STATUS_CONFIG[statusClinic?.status || ""]?.className}>
              {STATUS_CONFIG[statusClinic?.status || ""]?.label || statusClinic?.status}
            </Badge>
            <div className="pt-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLINIC_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_CONFIG[s]?.label || s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={statusChanging || newStatus === statusClinic?.status}
            >
              {statusChanging && <Loader2 className="size-4 mr-2 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emergency Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5 text-purple-500" />
              Emergency Edit — {clinicDetail?.name}
            </DialogTitle>
            <DialogDescription>
              Edit any clinic field. Changes take effect immediately.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-8 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Basic Info */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Basic Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-name">Clinic Name</Label>
                    <Input
                      id="edit-name"
                      value={String(editData.name || "")}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-tagline">Tagline</Label>
                    <Input
                      id="edit-tagline"
                      value={String(editData.tagline || "")}
                      onChange={(e) => setEditData({ ...editData, tagline: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-desc">Description</Label>
                    <Textarea
                      id="edit-desc"
                      value={String(editData.description || "")}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Location */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Location</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label htmlFor="edit-address">Street Address</Label>
                    <Input
                      id="edit-address"
                      value={String(editData.streetAddress || "")}
                      onChange={(e) => setEditData({ ...editData, streetAddress: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-city">City</Label>
                    <Input
                      id="edit-city"
                      value={String(editData.city || "")}
                      onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-state">State</Label>
                    <Input
                      id="edit-state"
                      value={String(editData.state || "")}
                      onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-zip">Zip Code</Label>
                    <Input
                      id="edit-zip"
                      value={String(editData.zipCode || "")}
                      onChange={(e) => setEditData({ ...editData, zipCode: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={String(editData.phoneNumber || "")}
                      onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={String(editData.email || "")}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-website">Website</Label>
                    <Input
                      id="edit-website"
                      value={String(editData.website || "")}
                      onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Financial */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Financial Configuration</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-inperson-deposit">In-Person Deposit (cents)</Label>
                    <Input
                      id="edit-inperson-deposit"
                      type="number"
                      min="0"
                      value={Number(editData.inPersonDepositCents || 0)}
                      onChange={(e) => setEditData({ ...editData, inPersonDepositCents: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-video-deposit">Video Deposit (cents)</Label>
                    <Input
                      id="edit-video-deposit"
                      type="number"
                      min="0"
                      value={Number(editData.videoDepositCents || 0)}
                      onChange={(e) => setEditData({ ...editData, videoDepositCents: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-flat-rate">Self-Pay Flat Rate (cents)</Label>
                    <Input
                      id="edit-flat-rate"
                      type="number"
                      min="0"
                      value={Number(editData.selfPayFlatRateCents || 0)}
                      onChange={(e) => setEditData({ ...editData, selfPayFlatRateCents: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-cancel-lead">Cancellation Lead Time (min)</Label>
                    <Input
                      id="edit-cancel-lead"
                      type="number"
                      min="0"
                      value={Number(editData.cancellationLeadTimeMin || 0)}
                      onChange={(e) => setEditData({ ...editData, cancellationLeadTimeMin: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-video-cancel-lead">Video Cancel Lead Time (min)</Label>
                    <Input
                      id="edit-video-cancel-lead"
                      type="number"
                      min="0"
                      value={Number(editData.videoCancellationLeadTimeMin || 0)}
                      onChange={(e) => setEditData({ ...editData, videoCancellationLeadTimeMin: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Patient Experience */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">Patient Experience</h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-parking">Parking Instructions</Label>
                    <Textarea
                      id="edit-parking"
                      value={String(editData.parkingInstructions || "")}
                      onChange={(e) => setEditData({ ...editData, parkingInstructions: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-visit">Visit Instructions</Label>
                    <Textarea
                      id="edit-visit"
                      value={String(editData.visitInstructions || "")}
                      onChange={(e) => setEditData({ ...editData, visitInstructions: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-common">Common Instructions</Label>
                    <Textarea
                      id="edit-common"
                      value={String(editData.commonInstructions || "")}
                      onChange={(e) => setEditData({ ...editData, commonInstructions: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEmergencyEdit}
              disabled={editLoading || detailLoading}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {editLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
              Save Emergency Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function ClinicTableRow({
  clinic,
  isExpanded,
  onToggle,
  onStatusChange,
  onEdit,
}: {
  clinic: ClinicRow;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: () => void;
  onEdit: () => void;
}) {
  const cfg = STATUS_CONFIG[clinic.status] || {
    label: clinic.status,
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer group">
          <TableCell className="w-8">
            {isExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground">{clinic.name}</span>
            </div>
          </TableCell>
          <TableCell className="text-xs text-muted-foreground font-mono">
            {clinic.slug}
          </TableCell>
          <TableCell>{clinic.city}, {clinic.state}</TableCell>
          <TableCell>
            <Badge variant="outline" className={cfg.className}>
              {cfg.label}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <span className="flex items-center justify-end gap-1">
              <Users className="size-3.5 text-muted-foreground" />
              {clinic.providerCount}
            </span>
          </TableCell>
          <TableCell className="text-right">
            <span className="flex items-center justify-end gap-1">
              <CalendarCheck className="size-3.5 text-muted-foreground" />
              {clinic.todayAppointments}
            </span>
          </TableCell>
          <TableCell className="text-right">
            {clinic.avgRating > 0 ? (
              <span className="flex items-center justify-end gap-1">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {clinic.avgRating}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange();
                }}
                className="h-7 px-2 text-xs"
              >
                Status
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="h-7 px-2 text-xs text-purple-600 dark:text-purple-400"
              >
                <Pencil className="size-3.5 mr-1" />
                Edit
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/30 px-8 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">ID</span>
                <p className="font-mono text-xs mt-0.5">{clinic.id}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Slug</span>
                <p className="font-mono text-xs mt-0.5">{clinic.slug}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Status</span>
                <Badge variant="outline" className={cfg.className + " mt-0.5"}>
                  {cfg.label}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Location</span>
                <p className="text-xs mt-0.5">{clinic.city}, {clinic.state}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Created</span>
                <p className="text-xs mt-0.5">{new Date(clinic.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Updated</span>
                <p className="text-xs mt-0.5">{new Date(clinic.updatedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Providers</span>
                <p className="text-xs mt-0.5 font-medium">{clinic.providerCount}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Today&apos;s Appointments</span>
                <p className="text-xs mt-0.5 font-medium">{clinic.todayAppointments}</p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}
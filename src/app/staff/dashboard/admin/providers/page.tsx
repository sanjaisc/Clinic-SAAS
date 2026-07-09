"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Star,
  Loader2,
  UserCog,
  Globe,
  Clock,
  GraduationCap,
} from "lucide-react";
import {
  Card,
  CardContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  PROVIDER_STATUS,
  PROVIDER_STATUSES,
  CLINIC_STATUS,
  CLINIC_STATUSES,
} from "@/lib/enums";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClinicOption {
  id: string;
  name: string;
  status: string;
}

interface ProviderRow {
  id: string;
  clinicId: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
  slug: string;
  npiNumber: string | null;
  yearsExperience: number | null;
  rating: number;
  reviewCount: number;
  slotDurationMinutes: number;
  status: string;
  videoVisitLink: string | null;
  createdAt: string;
  updatedAt: string;
  clinic: { id: string; name: string; slug: string; status: string };
  languages: string[];
  _count: {
    appointments: number;
    providerServices: number;
    slotTemplates: number;
  };
}

// ─── Status badge config ────────────────────────────────────────────────────

const PROVIDER_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "Active",
    className: "bg-brand-muted text-brand-hover border-brand-border  ",
  },
  INACTIVE: {
    label: "Inactive",
    className: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  },
};

const CLINIC_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PUBLISHED: {
    label: "Published",
    className: "bg-brand-muted text-brand border-brand-border  ",
  },
  DRAFT: {
    label: "Draft",
    className: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
  PENDING: {
    label: "Pending",
    className: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminProvidersPage() {
  // State
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [clinicFilter, setClinicFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProvider, setEditProvider] = useState<ProviderRow | null>(null);
  const [editData, setEditData] = useState<Record<string, string | number | null>>({});
  const [editLoading, setEditLoading] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch providers
  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (clinicFilter !== "ALL") params.set("clinicId", clinicFilter);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/staff/admin/providers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch providers");
      const data = await res.json();
      setProviders(data.providers);
      setClinics(data.clinics);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch {
      toast.error("Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, clinicFilter, page]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, clinicFilter]);

  // ─── Emergency Edit ────────────────────────────────────

  const openEditDialog = (provider: ProviderRow) => {
    setEditProvider(provider);
    setEditData({
      firstName: provider.firstName,
      lastName: provider.lastName,
      credentials: provider.credentials || "",
      npiNumber: provider.npiNumber || "",
      yearsExperience: provider.yearsExperience ?? "",
      slotDurationMinutes: provider.slotDurationMinutes,
      status: provider.status,
      videoVisitLink: provider.videoVisitLink || "",
      bio: "",
    });
    setEditDialogOpen(true);
  };

  const handleEmergencyEdit = async () => {
    if (!editProvider) return;
    setEditLoading(true);
    try {
      const payload: Record<string, unknown> = { ...editData };
      // Convert empty string yearsExperience to null
      if (payload.yearsExperience === "") {
        payload.yearsExperience = null;
      } else if (payload.yearsExperience !== null && payload.yearsExperience !== undefined) {
        payload.yearsExperience = Number(payload.yearsExperience);
      }

      const res = await fetch(`/api/staff/admin/providers/${editProvider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save changes");
      }
      toast.success("Provider updated successfully");
      setEditDialogOpen(false);
      fetchProviders();
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
          Provider Oversight
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage all providers across all clinics — {total} total
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, credentials, or NPI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={clinicFilter} onValueChange={setClinicFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <UserCog className="size-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Clinics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Clinics</SelectItem>
                {clinics.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({CLINIC_STATUS_CONFIG[c.status]?.label || c.status})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="size-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {PROVIDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PROVIDER_STATUS_CONFIG[s]?.label || s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Providers Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="py-12 text-center">
              <UserCog className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No providers found</p>
            </div>
          ) : (
            <>
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Credentials</TableHead>
                      <TableHead>Clinic</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                      <TableHead>NPI</TableHead>
                      <TableHead>Languages</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((provider) => {
                      const provCfg = PROVIDER_STATUS_CONFIG[provider.status] || {
                        label: provider.status,
                        className: "bg-zinc-100 text-zinc-700 border-zinc-200",
                      };
                      const clinicCfg = CLINIC_STATUS_CONFIG[provider.clinic.status] || {
                        label: provider.clinic.status,
                        className: "bg-zinc-100 text-zinc-600 border-zinc-200",
                      };
                      const fullName = `${provider.firstName} ${provider.lastName}`;

                      return (
                        <TableRow key={provider.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="flex items-center justify-center size-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold shrink-0">
                                {provider.firstName[0]}
                                {provider.lastName[0]}
                              </div>
                              <span className="font-medium text-foreground whitespace-nowrap">
                                {fullName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {provider.credentials ? (
                              <Badge variant="secondary" className="text-xs font-normal">
                                <GraduationCap className="size-3 mr-1" />
                                {provider.credentials}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <span className="text-sm">{provider.clinic.name}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${clinicCfg.className}`}>
                                {clinicCfg.label}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={provCfg.className}>
                              {provCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {provider.rating > 0 ? (
                              <span className="flex items-center justify-end gap-1">
                                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                                <span className="text-sm">{provider.rating}</span>
                                <span className="text-xs text-muted-foreground">({provider.reviewCount})</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">No reviews</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {provider.npiNumber || "—"}
                          </TableCell>
                          <TableCell>
                            {provider.languages.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {provider.languages.slice(0, 2).map((lang) => (
                                  <Badge key={lang} variant="outline" className="text-[10px] px-1.5 py-0">
                                    {lang}
                                  </Badge>
                                ))}
                                {provider.languages.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{provider.languages.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(provider)}
                              className="h-7 px-2 text-xs text-purple-600 dark:text-purple-400"
                            >
                              <Globe className="size-3.5 mr-1" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ({total} providers)
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

      {/* Emergency Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="size-5 text-purple-500" />
              Emergency Edit — {editProvider?.firstName} {editProvider?.lastName}
            </DialogTitle>
            <DialogDescription>
              Edit any provider field. Changes take effect immediately.
              <br />
              <span className="text-xs text-muted-foreground">
                Clinic: {editProvider?.clinic.name} ({editProvider?.clinic.status})
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Personal Info */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Personal Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-firstName">First Name</Label>
                  <Input
                    id="edit-firstName"
                    value={String(editData.firstName || "")}
                    onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-lastName">Last Name</Label>
                  <Input
                    id="edit-lastName"
                    value={String(editData.lastName || "")}
                    onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-credentials">Credentials</Label>
                  <Select
                    value={String(editData.credentials || "")}
                    onValueChange={(v) => setEditData({ ...editData, credentials: v })}
                  >
                    <SelectTrigger id="edit-credentials">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MD">MD</SelectItem>
                      <SelectItem value="DO">DO</SelectItem>
                      <SelectItem value="NP">NP</SelectItem>
                      <SelectItem value="PA-C">PA-C</SelectItem>
                      <SelectItem value="RN">RN</SelectItem>
                      <SelectItem value="PharmD">PharmD</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-npi">NPI Number</Label>
                  <Input
                    id="edit-npi"
                    value={String(editData.npiNumber || "")}
                    onChange={(e) => setEditData({ ...editData, npiNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-years">Years of Experience</Label>
                  <Input
                    id="edit-years"
                    type="number"
                    min="0"
                    value={editData.yearsExperience === null || editData.yearsExperience === "" ? "" : Number(editData.yearsExperience)}
                    onChange={(e) => setEditData({ ...editData, yearsExperience: e.target.value === "" ? null : e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Professional Settings */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3">Professional Settings</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit-slot-duration">Slot Duration</Label>
                  <Select
                    value={String(editData.slotDurationMinutes || "30")}
                    onValueChange={(v) => setEditData({ ...editData, slotDurationMinutes: Number(v) })}
                  >
                    <SelectTrigger id="edit-slot-duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={String(editData.status || "ACTIVE")}
                    onValueChange={(v) => setEditData({ ...editData, status: v })}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {PROVIDER_STATUS_CONFIG[s]?.label || s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-video-link">Video Visit Link</Label>
                  <Input
                    id="edit-video-link"
                    value={String(editData.videoVisitLink || "")}
                    onChange={(e) => setEditData({ ...editData, videoVisitLink: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {editProvider && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Provider Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Appointments:</span>{" "}
                    <span className="font-medium">{editProvider._count.appointments}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Services:</span>{" "}
                    <span className="font-medium">{editProvider._count.providerServices}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Active Templates:</span>{" "}
                    <span className="font-medium">{editProvider._count.slotTemplates}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Languages:</span>{" "}
                    <span className="font-medium">{editProvider.languages.join(", ") || "None"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEmergencyEdit}
              disabled={editLoading}
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
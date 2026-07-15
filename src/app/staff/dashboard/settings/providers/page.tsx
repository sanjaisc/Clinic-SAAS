"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { DoctASessionUser } from "@/lib/auth";
import { useActiveClinicId } from "@/components/active-clinic-context";
import { DAYS_OF_WEEK, PROVIDER_STATUS, SLOT_MODALITY } from "@/lib/enums";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import {
  UserPlus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  Video,
  Building2,
  Plus,
  Stethoscope,
  X,
  CalendarDays,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProviderListItem {
  id: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
  slug: string;
  photoUrl: string | null;
  npiNumber: string | null;
  yearsExperience: number | null;
  slotDurationMinutes: number;
  status: string;
  videoVisitLink: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    providerServices: number;
    slotTemplates: number;
    languages: number;
  };
}

interface SlotTemplate {
  id: string;
  providerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  modality: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProviderServiceWithService {
  id: string;
  providerId: string;
  serviceId: string;
  service: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    specialtyId: string;
    durationMinutes: number;
    selfPayPriceCents: number;
    selfPayPaymentType: string;
    isActive: boolean;
    specialty: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

interface SpecialtyWithServices {
  id: string;
  name: string;
  slug: string;
  services: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    durationMinutes: number;
    selfPayPriceCents: number;
    selfPayPaymentType: string;
    isActive: boolean;
  }>;
}

interface ProviderFull extends ProviderListItem {
  providerServices: ProviderServiceWithService[];
  slotTemplates: SlotTemplate[];
  languages: Array<{ id: string; languageId: string; language: { id: string; name: string; code: string } }>;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CREDENTIALS_OPTIONS = ["MD", "DO", "NP", "PA-C", "RN", "PharmD", "Other"];
const SLOT_DURATION_OPTIONS = [15, 30, 45, 60];
const STATUS_OPTIONS = [
  { value: PROVIDER_STATUS.ACTIVE, label: "Active", color: "bg-brand-subtle text-brand " },
  { value: PROVIDER_STATUS.INACTIVE, label: "Inactive", color: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400" },
  { value: PROVIDER_STATUS.SUSPENDED, label: "Suspended", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
];

// ─── Helper ────────────────────────────────────────────────────────────────────

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function getInitials(first: string, last: string): string {
  return `${(first[0] || "").toUpperCase()}${(last[0] || "").toUpperCase()}`;
}

function statusColor(status: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color || STATUS_OPTIONS[0].color;
}

// ─── Page Component ────────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const clinicId = useActiveClinicId(user?.clinicId ?? null);

  // ── Data State ──
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<ProviderFull | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Services data for mapping ──
  const [specialties, setSpecialties] = useState<SpecialtyWithServices[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // ── Dialog States ──
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderFull | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Delete State ──
  const [deleteTarget, setDeleteTarget] = useState<ProviderListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Template Dialog ──
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SlotTemplate | null>(null);
  const [templateDay, setTemplateDay] = useState(1);
  const [templateStart, setTemplateStart] = useState("09:00");
  const [templateEnd, setTemplateEnd] = useState("17:00");
  const [templateModality, setTemplateModality] = useState<string>(SLOT_MODALITY.IN_PERSON);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateActionLoading, setTemplateActionLoading] = useState<string | null>(null);

  // ── Form State ──
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formCredentials, setFormCredentials] = useState("");
  const [formNpi, setFormNpi] = useState("");
  const [formYears, setFormYears] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const [formVideoLink, setFormVideoLink] = useState("");
  const [formSlotDuration, setFormSlotDuration] = useState("30");
  const [formStatus, setFormStatus] = useState<string>(PROVIDER_STATUS.ACTIVE);

  // ─── Fetch Providers ─────────────────────────────────────────────────────────

  const fetchProviders = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/providers?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed to fetch providers");
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch providers";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  // ─── Fetch Services (for mapping) ───────────────────────────────────────────

  const fetchServices = useCallback(async () => {
    if (!clinicId) return;
    setServicesLoading(true);
    try {
      const res = await fetch(`/api/staff/services?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed to fetch services");
      const data = await res.json();
      setSpecialties(data.specialties || []);
    } catch {
      toast.error("Failed to load services");
    } finally {
      setServicesLoading(false);
    }
  }, [clinicId]);

  // ─── Fetch Provider Detail ──────────────────────────────────────────────────

  const fetchProviderDetail = useCallback(async (providerId: string) => {
    if (!clinicId) return;
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/staff/providers/${providerId}?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed to fetch provider details");
      const data = await res.json();
      setExpandedProvider(data.provider);
      return data.provider as ProviderFull;
    } catch {
      toast.error("Failed to load provider details");
      return null;
    } finally {
      setLoadingDetail(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchProviders();
    fetchServices();
  }, [fetchProviders, fetchServices]);

  // ─── Expand / Collapse ───────────────────────────────────────────────────────

  const handleToggleExpand = async (provider: ProviderListItem) => {
    if (expandedId === provider.id) {
      setExpandedId(null);
      setExpandedProvider(null);
    } else {
      setExpandedId(provider.id);
      const detail = await fetchProviderDetail(provider.id);
      if (detail) {
        // Reset template form
        resetTemplateForm();
      }
    }
  };

  // ─── Provider Dialog (Add/Edit) ─────────────────────────────────────────────

  const openAddDialog = () => {
    setEditingProvider(null);
    setFormFirstName("");
    setFormLastName("");
    setFormCredentials("");
    setFormNpi("");
    setFormYears("");
    setFormBio("");
    setFormPhotoUrl("");
    setFormVideoLink("");
    setFormSlotDuration("30");
    setFormStatus(PROVIDER_STATUS.ACTIVE);
    setShowProviderDialog(true);
  };

  const openEditDialog = (provider: ProviderFull) => {
    setEditingProvider(provider);
    setFormFirstName(provider.firstName);
    setFormLastName(provider.lastName);
    setFormCredentials(provider.credentials || "");
    setFormNpi(provider.npiNumber || "");
    setFormYears(provider.yearsExperience?.toString() || "");
    setFormBio(provider.bio || "");
    setFormPhotoUrl(provider.photoUrl || "");
    setFormVideoLink(provider.videoVisitLink || "");
    setFormSlotDuration(provider.slotDurationMinutes.toString());
    setFormStatus(provider.status);
    setShowProviderDialog(true);
  };

  const handleSaveProvider = async () => {
    if (!formFirstName.trim() || !formLastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    if (!formCredentials.trim()) {
      toast.error("Credentials are required");
      return;
    }

    setSaving(true);
    try {
      const body = {
        firstName: formFirstName,
        lastName: formLastName,
        credentials: formCredentials,
        npiNumber: formNpi || null,
        yearsExperience: formYears ? Number(formYears) : null,
        bio: formBio || null,
        photoUrl: formPhotoUrl || null,
        videoVisitLink: formVideoLink || null,
        slotDurationMinutes: Number(formSlotDuration),
        status: formStatus,
      };

      if (editingProvider) {
        const res = await fetch(`/api/staff/providers/${editingProvider.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update provider");
        }
        toast.success("Provider updated successfully");
      } else {
        const res = await fetch("/api/staff/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create provider");
        }
        toast.success("Provider added successfully");
      }

      setShowProviderDialog(false);
      await fetchProviders();
      // Refresh expanded detail if it was open
      if (expandedId && editingProvider) {
        await fetchProviderDetail(expandedId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Provider ────────────────────────────────────────────────────────

  const handleDeleteProvider = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/staff/providers/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete provider");
      }
      toast.success("Provider removed successfully");
      setDeleteTarget(null);
      if (expandedId === deleteTarget.id) {
        setExpandedId(null);
        setExpandedProvider(null);
      }
      await fetchProviders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Template CRUD ──────────────────────────────────────────────────────────

  const resetTemplateForm = () => {
    setEditingTemplate(null);
    setTemplateDay(1);
    setTemplateStart("09:00");
    setTemplateEnd("17:00");
    setTemplateModality(SLOT_MODALITY.IN_PERSON);
  };

  const openAddTemplate = () => {
    resetTemplateForm();
    setShowTemplateDialog(true);
  };

  const openEditTemplate = (template: SlotTemplate) => {
    setEditingTemplate(template);
    setTemplateDay(template.dayOfWeek);
    setTemplateStart(template.startTime);
    setTemplateEnd(template.endTime);
    setTemplateModality(template.modality);
    setShowTemplateDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!expandedId) return;
    if (templateStart >= templateEnd) {
      toast.error("Start time must be before end time");
      return;
    }

    setTemplateSaving(true);
    try {
      const body = {
        dayOfWeek: templateDay,
        startTime: templateStart,
        endTime: templateEnd,
        modality: templateModality,
        isActive: true,
      };

      if (editingTemplate) {
        const res = await fetch(
          `/api/staff/providers/${expandedId}/templates/${editingTemplate.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update template");
        }
        toast.success("Schedule template updated");
      } else {
        const res = await fetch(`/api/staff/providers/${expandedId}/templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create template");
        }
        toast.success("Schedule template added");
      }

      setShowTemplateDialog(false);
      await fetchProviderDetail(expandedId);
      await fetchProviders(); // Update template counts
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!expandedId) return;
    setTemplateActionLoading(`delete-${templateId}`);
    try {
      const res = await fetch(
        `/api/staff/providers/${expandedId}/templates/${templateId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete template");
      toast.success("Schedule template removed");
      await fetchProviderDetail(expandedId);
      await fetchProviders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTemplateActionLoading(null);
    }
  };

  const handleToggleTemplateActive = async (template: SlotTemplate) => {
    if (!expandedId) return;
    setTemplateActionLoading(`toggle-${template.id}`);
    try {
      const res = await fetch(
        `/api/staff/providers/${expandedId}/templates/${template.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !template.isActive }),
        }
      );
      if (!res.ok) throw new Error("Failed to toggle template");
      await fetchProviderDetail(expandedId);
      await fetchProviders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTemplateActionLoading(null);
    }
  };

  // ─── Service Mapping ────────────────────────────────────────────────────────

  const isServiceAssigned = (serviceId: string): boolean => {
    if (!expandedProvider) return false;
    return expandedProvider.providerServices.some((ps) => ps.serviceId === serviceId);
  };

  const handleToggleService = async (serviceId: string, checked: boolean) => {
    if (!expandedId) return;
    try {
      if (checked) {
        const res = await fetch(`/api/staff/providers/${expandedId}/services`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId }),
        });
        if (!res.ok) {
          const err = await res.json();
          if (res.status === 409) {
            toast.info("Service is already assigned");
            return;
          }
          throw new Error(err.error || "Failed to assign service");
        }
        toast.success("Service assigned");
      } else {
        const res = await fetch(
          `/api/staff/providers/${expandedId}/services/${serviceId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to remove service");
        toast.success("Service removed");
      }
      await fetchProviderDetail(expandedId);
      await fetchProviders(); // Update service counts
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  // ─── Weekly Template Grid ───────────────────────────────────────────────────

  const getTemplatesForDay = (dayOfWeek: number): SlotTemplate[] => {
    if (!expandedProvider) return [];
    return expandedProvider.slotTemplates
      .filter((t) => t.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  // ---- Error State ----
  if (loadError) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="size-8 text-destructive" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-lg">Failed to load providers</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-md">{loadError}</p>
          </div>
          <Button variant="outline" onClick={() => { setLoadError(null); fetchProviders(); }} className="gap-2">
            <RefreshCw className="size-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb items={[{ label: "Settings" }, { label: "Providers" }]} />
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Provider Roster</h2>
          <p className="text-sm text-muted-foreground">
            Manage your providers, schedules, and service assignments
          </p>
        </div>
        <Button onClick={openAddDialog} className="bg-brand hover:bg-brand-hover text-white">
          <UserPlus className="size-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {/* Provider List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <UserPlus className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-foreground">No providers yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add your first provider to start building your team and setting up schedules.
          </p>
          <Button onClick={openAddDialog} variant="outline" className="mt-4">
            <UserPlus className="size-4 mr-2" />
            Add Provider
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((provider, index) => (
            <div
              key={provider.id}
              className={`rounded-lg border bg-card animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ${
                provider.status === "ACTIVE"
                  ? "border-l-4 border-l-brand"
                  : provider.status === "SUSPENDED"
                    ? "border-l-4 border-l-amber-500"
                    : "border-l-4 border-l-muted-foreground/30"
              }`}
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
            >
              {/* Provider Card Row */}
              <div
                className="flex items-center gap-3 sm:gap-4 p-4 cursor-pointer hover:bg-accent/30 transition-colors rounded-lg"
                onClick={() => handleToggleExpand(provider)}
              >
                {/* Expand Arrow */}
                <div className="text-muted-foreground">
                  {expandedId === provider.id ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </div>

                {/* Avatar */}
                <Avatar className="size-10">
                  {provider.photoUrl ? (
                    <AvatarImage src={provider.photoUrl} alt={`${provider.firstName} ${provider.lastName}`} />
                  ) : null}
                  <AvatarFallback className="bg-brand-subtle text-brand-hover text-sm font-medium">
                    {getInitials(provider.firstName, provider.lastName)}
                  </AvatarFallback>
                </Avatar>

                {/* Name & Credentials */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground truncate">
                      {provider.firstName} {provider.lastName}
                    </span>
                    {provider.credentials && (
                      <span className="text-xs text-muted-foreground">, {provider.credentials}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {provider.slotDurationMinutes}min slots
                    </span>
                    <span>{provider._count.providerServices} services</span>
                    <span>{provider._count.slotTemplates} templates</span>
                  </div>
                </div>

                {/* Status Badge */}
                <Badge variant="secondary" className={`text-xs hidden sm:inline-flex ${statusColor(provider.status)}`}>
                  {provider.status}
                </Badge>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      // Need full detail to edit
                      (async () => {
                        const detail = await fetchProviderDetail(provider.id);
                        if (detail) openEditDialog(detail);
                      })();
                    }}
                    title="Edit provider"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(provider)}
                    title="Remove provider"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedId === provider.id && (
                <div className="border-t">
                  {loadingDetail ? (
                    <div className="p-6 space-y-4">
                      <Skeleton className="h-8 w-64" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  ) : expandedProvider ? (
                    <div className="p-4 sm:p-6">
                      <ProviderDetail
                        provider={expandedProvider}
                        specialties={specialties}
                        servicesLoading={servicesLoading}
                        onEditProvider={openEditDialog}
                        onAddTemplate={openAddTemplate}
                        onEditTemplate={openEditTemplate}
                        onDeleteTemplate={handleDeleteTemplate}
                        onToggleTemplate={handleToggleTemplateActive}
                        onToggleService={handleToggleService}
                        isServiceAssigned={isServiceAssigned}
                        getTemplatesForDay={getTemplatesForDay}
                        templateActionLoading={templateActionLoading}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Add/Edit Provider Dialog ─────────────────────────────────────────── */}
      <Dialog open={showProviderDialog} onOpenChange={setShowProviderDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? "Edit Provider" : "Add New Provider"}
            </DialogTitle>
            <DialogDescription>
              {editingProvider
                ? "Update provider information and settings."
                : "Add a new provider to your clinic."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Personal Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="Jane"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Smith"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="credentials">Credentials *</Label>
                  <Select value={formCredentials} onValueChange={setFormCredentials}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CREDENTIALS_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="npi">NPI Number</Label>
                  <Input
                    id="npi"
                    value={formNpi}
                    onChange={(e) => setFormNpi(e.target.value)}
                    placeholder="1234567890"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="years">Years Experience</Label>
                  <Input
                    id="years"
                    type="number"
                    min={0}
                    max={80}
                    value={formYears}
                    onChange={(e) => setFormYears(e.target.value)}
                    placeholder="10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="photoUrl">Photo URL</Label>
                <Input
                  id="photoUrl"
                  value={formPhotoUrl}
                  onChange={(e) => setFormPhotoUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Paste a URL for the provider&apos;s photo. Recommended: square image, at least 200x200px.
                </p>
              </div>
            </div>

            <Separator />

            {/* Professional Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Professional Settings</h3>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Provider biography, specializations, and background..."
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="videoLink">Video Visit Link</Label>
                <Input
                  id="videoLink"
                  value={formVideoLink}
                  onChange={(e) => setFormVideoLink(e.target.value)}
                  placeholder="https://doxy.me/..."
                />
                <p className="text-xs text-muted-foreground">
                  Link to third-party video visit service (e.g., Doxy.me, Zoom).
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Slot Duration *</Label>
                  <Select value={formSlotDuration} onValueChange={setFormSlotDuration}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLOT_DURATION_OPTIONS.map((d) => (
                        <SelectItem key={d} value={d.toString()}>
                          {d} minutes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProviderDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveProvider}
              disabled={saving}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              {saving
                ? "Saving..."
                : editingProvider
                  ? "Update Provider"
                  : "Add Provider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Template Dialog (Add/Edit) ──────────────────────────────────────── */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Schedule Template" : "Add Schedule Template"}
            </DialogTitle>
            <DialogDescription>
              Define a weekly recurring time block for this provider.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Day of Week</Label>
              <Select
                value={templateDay.toString()}
                onValueChange={(v) => setTemplateDay(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d) => (
                    <SelectItem key={d.value} value={d.value.toString()}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tStart">Start Time</Label>
                <Input
                  id="tStart"
                  type="time"
                  value={templateStart}
                  onChange={(e) => setTemplateStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tEnd">End Time</Label>
                <Input
                  id="tEnd"
                  type="time"
                  value={templateEnd}
                  onChange={(e) => setTemplateEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Modality</Label>
              <Select value={templateModality} onValueChange={setTemplateModality}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SLOT_MODALITY.IN_PERSON}>
                    <span className="flex items-center gap-2">
                      <Building2 className="size-3.5" />
                      In Person
                    </span>
                  </SelectItem>
                  <SelectItem value={SLOT_MODALITY.VIDEO}>
                    <span className="flex items-center gap-2">
                      <Video className="size-3.5" />
                      Video
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={templateSaving}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              {templateSaving
                ? "Saving..."
                : editingTemplate
                  ? "Update Template"
                  : "Add Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Provider</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Are you sure you want to remove ${deleteTarget.firstName} ${deleteTarget.lastName}? ${
                    (deleteTarget._count.providerServices > 0 || deleteTarget._count.slotTemplates > 0)
                      ? "This provider has existing data (services/templates) and will be set to inactive instead of deleted."
                      : "This will permanently delete this provider."
                  }`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProvider}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Provider Detail Sub-Component ─────────────────────────────────────────────

function ProviderDetail({
  provider,
  specialties,
  servicesLoading,
  onEditProvider,
  onAddTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onToggleTemplate,
  onToggleService,
  isServiceAssigned,
  getTemplatesForDay,
  templateActionLoading,
}: {
  provider: ProviderFull;
  specialties: SpecialtyWithServices[];
  servicesLoading: boolean;
  onEditProvider: (p: ProviderFull) => void;
  onAddTemplate: () => void;
  onEditTemplate: (t: SlotTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onToggleTemplate: (t: SlotTemplate) => void;
  onToggleService: (serviceId: string, checked: boolean) => void;
  isServiceAssigned: (serviceId: string) => boolean;
  getTemplatesForDay: (dayOfWeek: number) => SlotTemplate[];
  templateActionLoading: string | null;
}) {
  const assignedServiceIds = new Set(provider.providerServices.map((ps) => ps.serviceId));

  return (
    <div className="space-y-4">
      {/* Provider Summary Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary" className={statusColor(provider.status)}>
          {provider.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Slot: {provider.slotDurationMinutes}min
        </span>
        {provider.npiNumber && (
          <span className="text-xs text-muted-foreground">NPI: {provider.npiNumber}</span>
        )}
        {provider.yearsExperience != null && (
          <span className="text-xs text-muted-foreground">
            {provider.yearsExperience}yr exp
          </span>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => onEditProvider(provider)}>
            <Pencil className="size-3.5 mr-1.5" />
            Edit
          </Button>
        </div>
      </div>

      {/* Tabs: Schedule Templates | Service Mapping */}
      <Tabs defaultValue="schedule" className="w-full">
        <TabsList>
          <TabsTrigger value="schedule" className="gap-1.5">
            <CalendarDays className="size-3.5" />
            Schedule Templates
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5">
            <Stethoscope className="size-3.5" />
            Service Mapping
          </TabsTrigger>
        </TabsList>

        {/* ── Schedule Templates Tab ── */}
        <TabsContent value="schedule" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {provider.slotTemplates.length} schedule template{provider.slotTemplates.length !== 1 ? "s" : ""} configured
            </p>
            <Button size="sm" onClick={onAddTemplate} className="bg-brand hover:bg-brand-hover text-white">
              <Plus className="size-3.5 mr-1.5" />
              Add Template
            </Button>
          </div>

          {/* Weekly Grid */}
          <div className="rounded-lg border overflow-hidden">
            <div className="divide-y">
              {[...DAYS_OF_WEEK].sort((a, b) => (a.value === 0 ? 1 : b.value === 0 ? -1 : a.value - b.value)).map((day) => {
                const dayTemplates = getTemplatesForDay(day.value);

                return (
                  <div key={day.value} className="flex items-start gap-3 p-3 hover:bg-accent/20 transition-colors">
                    <div className="w-20 sm:w-24 shrink-0">
                      <span className="text-sm font-medium text-foreground">{day.label}</span>
                      <span className="text-xs text-muted-foreground ml-1.5">{day.short}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      {dayTemplates.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">No schedule</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {dayTemplates.map((template) => (
                            <div
                              key={template.id}
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-all ${
                                template.isActive
                                  ? "bg-background border-border"
                                  : "bg-muted/50 border-border opacity-50"
                              }`}
                            >
                              {template.modality === SLOT_MODALITY.VIDEO && (
                                <Video className="size-3 text-blue-500" />
                              )}
                              {template.modality === SLOT_MODALITY.IN_PERSON && (
                                <Building2 className="size-3 text-brand" />
                              )}
                              <span className="font-medium">
                                {formatTime(template.startTime)} – {formatTime(template.endTime)}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 h-4"
                              >
                                {template.modality === SLOT_MODALITY.VIDEO ? "Video" : "In-Person"}
                              </Badge>
                              <div className="flex items-center gap-0.5 ml-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => onToggleTemplate(template)}
                                  disabled={templateActionLoading === `toggle-${template.id}`}
                                  title={template.isActive ? "Deactivate" : "Activate"}
                                >
                                  {templateActionLoading === `toggle-${template.id}` ? (
                                    <Loader2 className="size-2.5 animate-spin" />
                                  ) : (
                                    <Switch
                                      checked={template.isActive}
                                      className="pointer-events-none scale-75"
                                    />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => onEditTemplate(template)}
                                  disabled={templateActionLoading?.startsWith("toggle-") || templateActionLoading?.startsWith("delete-")}
                                >
                                  <Pencil className="size-2.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                  onClick={() => onDeleteTemplate(template.id)}
                                  disabled={templateActionLoading === `delete-${template.id}`}
                                >
                                  {templateActionLoading === `delete-${template.id}` ? (
                                    <Loader2 className="size-2.5 animate-spin" />
                                  ) : (
                                    <X className="size-2.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ── Service Mapping Tab ── */}
        <TabsContent value="services" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {assignedServiceIds.size} service{assignedServiceIds.size !== 1 ? "s" : ""} assigned
            </p>
          </div>

          {/* Currently Assigned Services (highlighted) */}
          {provider.providerServices.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Currently Assigned
              </h4>
              <div className="flex flex-wrap gap-2">
                {provider.providerServices.map((ps) => (
                  <div
                    key={ps.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-muted border border-brand-border pl-3 pr-1.5 py-1"
                  >
                    <span className="text-xs font-medium text-brand">
                      {ps.service.name}
                    </span>
                    <span className="text-[10px] text-brand">
                      ({ps.service.specialty.name})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 rounded-full hover:bg-brand-subtle"
                      onClick={() => onToggleService(ps.serviceId, false)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Available Services Grouped by Specialty */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              All Services by Specialty
            </h4>

            {servicesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
            ) : specialties.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No services available. Add services in the Services & Insurance tab first.
              </p>
            ) : (
              <ScrollArea className="max-h-96 overflow-y-auto">
                <div className="space-y-4 pr-4">
                  {specialties.map((specialty) => {
                    const activeServices = specialty.services.filter((s) => s.isActive);
                    if (activeServices.length === 0) return null;

                    return (
                      <div key={specialty.id} className="space-y-2">
                        <h5 className="text-sm font-medium text-foreground">
                          {specialty.name}
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {activeServices.map((service) => {
                            const assigned = isServiceAssigned(service.id);
                            return (
                              <label
                                key={service.id}
                                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                  assigned
                                    ? "border-brand-border bg-brand-muted/50  "
                                    : "border-border hover:bg-accent/30"
                                }`}
                              >
                                <Checkbox
                                  checked={assigned}
                                  onCheckedChange={(checked) =>
                                    onToggleService(service.id, !!checked)
                                  }
                                  className="mt-0.5"
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-foreground">
                                    {service.name}
                                  </div>
                                  {service.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                      {service.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="size-3" />
                                      {service.durationMinutes}min
                                    </span>
                                    {service.selfPayPriceCents > 0 && (
                                      <span>
                                        ${(service.selfPayPriceCents / 100).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
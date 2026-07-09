"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Database,
  Stethoscope,
  ClipboardList,
  ShieldCheck,
  Building,
  Globe,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { DoctASessionUser } from "@/lib/auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Specialty {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  _count?: { services: number };
}

interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  specialtyId: string;
  durationMinutes: number;
  selfPayPriceCents: number;
  selfPayPaymentType: string;
  isBookable: boolean;
  isActive: boolean;
  sortOrder: number;
  specialty: { id: string; name: string };
}

interface Insurance {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isDemo: boolean;
  sortOrder: number;
  _count?: { serviceInsurances: number };
}

interface Amenity {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
}

interface Language {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
}

// ─── Tab Config ───────────────────────────────────────────────────────────────

type TabKey = "specialties" | "services" | "insurances" | "amenities" | "languages";

const TAB_CONFIG: Record<TabKey, { label: string; icon: React.ElementType; endpoint: string }> = {
  specialties: { label: "Specialties", icon: Stethoscope, endpoint: "/api/staff/admin/taxonomy/specialties" },
  services: { label: "Services", icon: ClipboardList, endpoint: "/api/staff/admin/taxonomy/services" },
  insurances: { label: "Insurances", icon: ShieldCheck, endpoint: "/api/staff/admin/taxonomy/insurances" },
  amenities: { label: "Amenities", icon: Building, endpoint: "/api/staff/admin/taxonomy/amenities" },
  languages: { label: "Languages", icon: Globe, endpoint: "/api/staff/admin/taxonomy/languages" },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TaxonomyPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;

  const [activeTab, setActiveTab] = useState<TabKey>("specialties");

  // Data states
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);

  const [loading, setLoading] = useState<Record<TabKey, boolean>>({
    specialties: true,
    services: true,
    insurances: true,
    amenities: true,
    languages: true,
  });

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIcon, setFormIcon] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [formSpecialtyId, setFormSpecialtyId] = useState("");
  const [formDurationMinutes, setFormDurationMinutes] = useState("30");
  const [formPriceCents, setFormPriceCents] = useState("0");
  const [formPaymentType, setFormPaymentType] = useState("STANDARD_DEPOSIT");
  const [formIsBookable, setFormIsBookable] = useState(true);
  const [formIsDemo, setFormIsDemo] = useState(false);
  const [formCode, setFormCode] = useState("");

  // ─── Fetch Helpers ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async (tab: TabKey) => {
    setLoading((prev) => ({ ...prev, [tab]: true }));
    try {
      const res = await fetch(TAB_CONFIG[tab].endpoint);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      switch (tab) {
        case "specialties":
          setSpecialties(data);
          break;
        case "services":
          setServices(data);
          break;
        case "insurances":
          setInsurances(data);
          break;
        case "amenities":
          setAmenities(data);
          break;
        case "languages":
          setLanguages(data);
          break;
      }
    } catch {
      toast.error(`Failed to load ${TAB_CONFIG[tab].label.toLowerCase()}`);
    } finally {
      setLoading((prev) => ({ ...prev, [tab]: false }));
    }
  }, []);

  // Load all data on mount
  useEffect(() => {
    (Object.keys(TAB_CONFIG) as TabKey[]).forEach((tab) => fetchData(tab));
  }, [fetchData]);

  // ─── Toggle Active ──────────────────────────────────────────────────────────

  const handleToggle = async (tab: TabKey, id: string) => {
    setTogglingId(id);
    try {
      const res = await fetch(`${TAB_CONFIG[tab].endpoint}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Toggle failed" }));
        if (res.status === 405) {
          toast.info("Archive not supported for this entity type.");
        } else {
          throw new Error(err.error || "Toggle failed");
        }
        return;
      }
      const updated = await res.json();
      // Update local state
      const setState = {
        specialties: setSpecialties,
        services: setServices,
        insurances: setInsurances,
      }[tab];
      if (setState) {
        setState((prev: unknown[]) =>
          (prev as Array<Record<string, unknown>>).map((item) =>
            item.id === id ? { ...item, isActive: updated.isActive } : item
          )
        );
      }
      toast.success(updated.isActive ? "Activated successfully" : "Archived successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setTogglingId(null);
    }
  };

  // ─── Dialog Open/Close ─────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingItem(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (tab: TabKey, item: Record<string, unknown>) => {
    setEditingItem(item);
    // Pre-fill form
    setFormName((item.name as string) || "");
    setFormSlug((item.slug as string) || "");
    setFormDescription((item.description as string) || "");
    setFormIcon((item.icon as string) || "");
    setFormSortOrder(String(item.sortOrder ?? 0));
    setFormSpecialtyId((item.specialtyId as string) || "");
    setFormDurationMinutes(String(item.durationMinutes ?? 30));
    setFormPriceCents(String(item.selfPayPriceCents ?? 0));
    setFormPaymentType((item.selfPayPaymentType as string) || "STANDARD_DEPOSIT");
    setFormIsBookable(item.isBookable !== false);
    setFormIsDemo(Boolean(item.isDemo));
    setFormCode((item.code as string) || "");
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormIcon("");
    setFormSortOrder("0");
    setFormSpecialtyId("");
    setFormDurationMinutes("30");
    setFormPriceCents("0");
    setFormPaymentType("STANDARD_DEPOSIT");
    setFormIsBookable(true);
    setFormIsDemo(false);
    setFormCode("");
  };

  // ─── Save (Create or Update) ───────────────────────────────────────────────

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    const endpoint = TAB_CONFIG[activeTab].endpoint;
    const isEdit = !!editingItem;

    let body: Record<string, unknown> = { name: formName.trim(), sortOrder: Number(formSortOrder) || 0 };

    switch (activeTab) {
      case "specialties":
        body.description = formDescription || null;
        body.icon = formIcon || null;
        break;
      case "services":
        if (!formSpecialtyId) {
          toast.error("Specialty is required");
          setSaving(false);
          return;
        }
        body.description = formDescription || null;
        body.specialtyId = formSpecialtyId;
        body.durationMinutes = Number(formDurationMinutes) || 30;
        body.selfPayPriceCents = Number(formPriceCents) || 0;
        body.selfPayPaymentType = formPaymentType;
        body.isBookable = formIsBookable;
        break;
      case "insurances":
        body.isDemo = formIsDemo;
        break;
      case "amenities":
        body.icon = formIcon || null;
        break;
      case "languages":
        if (!formCode.trim()) {
          toast.error("Language code is required");
          setSaving(false);
          return;
        }
        body.code = formCode.trim().toLowerCase();
        break;
    }

    try {
      const url = isEdit ? `${endpoint}/${editingItem.id}` : endpoint;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(err.error || "Save failed");
      }

      toast.success(isEdit ? "Updated successfully" : "Created successfully");
      setDialogOpen(false);
      fetchData(activeTab);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ─── Render Helpers ────────────────────────────────────────────────────────

  const formatPrice = (cents: number) => {
    if (cents === 0) return "$0.00";
    return `$${(cents / 100).toFixed(2)}`;
  };

  // ─── Guard ─────────────────────────────────────────────────────────────────

  if (!user || user.role !== "SYSTEM_MANAGER") {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-purple-100 dark:bg-purple-950">
            <Database className="size-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Global Taxonomy</h2>
            <p className="text-sm text-muted-foreground">
              Manage specialties, services, insurances, amenities, and languages
            </p>
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="flex-wrap">
          {(Object.keys(TAB_CONFIG) as TabKey[]).map((key) => {
            const cfg = TAB_CONFIG[key];
            const Icon = cfg.icon;
            return (
              <TabsTrigger key={key} value={key} className="gap-1.5">
                <Icon className="size-4" />
                {cfg.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ─── Specialties Tab ─────────────────────────────────────────────── */}
        <TabsContent value="specialties">
          <TaxonomyCard
            title="Specialties"
            description="Medical specialties that group related services"
            loading={loading.specialties}
            onAdd={openCreateDialog}
            onRefresh={() => fetchData("specialties")}
          >
            <SpecialtyTable
              data={specialties}
              onEdit={(item) => openEditDialog("specialties", item)}
              onToggle={(id) => handleToggle("specialties", id)}
              togglingId={togglingId}
            />
          </TaxonomyCard>
        </TabsContent>

        {/* ─── Services Tab ────────────────────────────────────────────────── */}
        <TabsContent value="services">
          <TaxonomyCard
            title="Services"
            description="Individual services linked to specialties with pricing"
            loading={loading.services}
            onAdd={openCreateDialog}
            onRefresh={() => fetchData("services")}
          >
            <ServiceTable
              data={services}
              onEdit={(item) => openEditDialog("services", item)}
              onToggle={(id) => handleToggle("services", id)}
              togglingId={togglingId}
            />
          </TaxonomyCard>
        </TabsContent>

        {/* ─── Insurances Tab ──────────────────────────────────────────────── */}
        <TabsContent value="insurances">
          <TaxonomyCard
            title="Insurances"
            description="Insurance providers accepted by clinics"
            loading={loading.insurances}
            onAdd={openCreateDialog}
            onRefresh={() => fetchData("insurances")}
          >
            <InsuranceTable
              data={insurances}
              onEdit={(item) => openEditDialog("insurances", item)}
              onToggle={(id) => handleToggle("insurances", id)}
              togglingId={togglingId}
            />
          </TaxonomyCard>
        </TabsContent>

        {/* ─── Amenities Tab ───────────────────────────────────────────────── */}
        <TabsContent value="amenities">
          <TaxonomyCard
            title="Amenities"
            description="Facility features and conveniences"
            loading={loading.amenities}
            onAdd={openCreateDialog}
            onRefresh={() => fetchData("amenities")}
          >
            <AmenityTable
              data={amenities}
              onEdit={(item) => openEditDialog("amenities", item)}
            />
          </TaxonomyCard>
        </TabsContent>

        {/* ─── Languages Tab ───────────────────────────────────────────────── */}
        <TabsContent value="languages">
          <TaxonomyCard
            title="Languages"
            description="Spoken languages for provider profiles"
            loading={loading.languages}
            onAdd={openCreateDialog}
            onRefresh={() => fetchData("languages")}
          >
            <LanguageTable
              data={languages}
              onEdit={(item) => openEditDialog("languages", item)}
            />
          </TaxonomyCard>
        </TabsContent>
      </Tabs>

      {/* ─── Create/Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem
                ? `Edit ${TAB_CONFIG[activeTab].label.replace(/s$/, "")}`
                : `Add ${TAB_CONFIG[activeTab].label.replace(/s$/, "")}`}
            </DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the fields below." : "Fill in the details to create a new entry."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name (all) */}
            <div className="grid gap-2">
              <Label htmlFor="form-name">Name *</Label>
              <Input
                id="form-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter name..."
              />
            </div>

            {/* Slug (all except languages) */}
            {activeTab !== "languages" && (
              <div className="grid gap-2">
                <Label htmlFor="form-slug">Slug</Label>
                <Input
                  id="form-slug"
                  value={formSlug}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Auto-generated from name</p>
              </div>
            )}

            {/* Description (specialties, services) */}
            {(activeTab === "specialties" || activeTab === "services") && (
              <div className="grid gap-2">
                <Label htmlFor="form-description">Description</Label>
                <Input
                  id="form-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description..."
                />
              </div>
            )}

            {/* Icon (specialties, amenities) */}
            {(activeTab === "specialties" || activeTab === "amenities") && (
              <div className="grid gap-2">
                <Label htmlFor="form-icon">Icon</Label>
                <Input
                  id="form-icon"
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  placeholder="Emoji or icon name..."
                />
              </div>
            )}

            {/* Specialty select (services only) */}
            {activeTab === "services" && (
              <div className="grid gap-2">
                <Label>Specialty *</Label>
                <Select value={formSpecialtyId} onValueChange={setFormSpecialtyId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select specialty..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {specialties.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Duration (services only) */}
            {activeTab === "services" && (
              <div className="grid gap-2">
                <Label htmlFor="form-duration">Duration (minutes)</Label>
                <Input
                  id="form-duration"
                  type="number"
                  min={5}
                  step={5}
                  value={formDurationMinutes}
                  onChange={(e) => setFormDurationMinutes(e.target.value)}
                />
              </div>
            )}

            {/* Price (services only) */}
            {activeTab === "services" && (
              <div className="grid gap-2">
                <Label htmlFor="form-price">Self-Pay Price ($)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="form-price"
                    type="number"
                    min={0}
                    step={0.01}
                    className="pl-7"
                    value={formPriceCents ? (Number(formPriceCents) / 100).toFixed(2) : "0.00"}
                    onChange={(e) => setFormPriceCents(String(Math.round(Number(e.target.value) * 100)))}
                  />
                </div>
              </div>
            )}

            {/* Payment Type (services only) */}
            {activeTab === "services" && (
              <div className="grid gap-2">
                <Label>Payment Type</Label>
                <Select value={formPaymentType} onValueChange={setFormPaymentType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD_DEPOSIT">Standard Deposit</SelectItem>
                    <SelectItem value="FULL_UPFRONT">Full Upfront</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Is Bookable (services only) */}
            {activeTab === "services" && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Bookable Online</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow patients to book this service
                  </p>
                </div>
                <Switch checked={formIsBookable} onCheckedChange={setFormIsBookable} />
              </div>
            )}

            {/* Is Demo (insurances only) */}
            {activeTab === "insurances" && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Demo Insurance</Label>
                  <p className="text-xs text-muted-foreground">
                    Mark as demo/test insurance
                  </p>
                </div>
                <Switch checked={formIsDemo} onCheckedChange={setFormIsDemo} />
              </div>
            )}

            {/* Code (languages only) */}
            {activeTab === "languages" && (
              <div className="grid gap-2">
                <Label htmlFor="form-code">Language Code *</Label>
                <Input
                  id="form-code"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="ISO 639-1 code, e.g. en, es, zh..."
                />
              </div>
            )}

            {/* Sort Order (all) */}
            <div className="grid gap-2">
              <Label htmlFor="form-sort">Sort Order</Label>
              <Input
                id="form-sort"
                type="number"
                min={0}
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Lower values appear first</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              {editingItem ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Taxonomy Card Wrapper ────────────────────────────────────────────────────

function TaxonomyCard({
  title,
  description,
  loading,
  onAdd,
  onRefresh,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  onAdd: () => void;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onRefresh} title="Refresh">
            <RefreshCw className="size-4" />
          </Button>
          <Button size="sm" onClick={onAdd}>
            <Plus className="size-4 mr-1.5" />
            Add New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant={active ? "default" : "secondary"}
      className={
        active
          ? "bg-brand-subtle text-brand-hover  border-brand-border "
          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700"
      }
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

// ─── Specialty Table ──────────────────────────────────────────────────────────

function SpecialtyTable({
  data,
  onEdit,
  onToggle,
  togglingId,
}: {
  data: Specialty[];
  onEdit: (item: Record<string, unknown>) => void;
  onToggle: (id: string) => void;
  togglingId: string | null;
}) {
  if (data.length === 0) {
    return <EmptyState message="No specialties found. Add one to get started." />;
  }

  return (
    <div className="max-h-96 overflow-y-auto custom-scrollbar">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Name</TableHead>
            <TableHead className="w-[25%]">Slug</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
            <TableHead className="w-[10%]">Sort</TableHead>
            <TableHead className="w-[10%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className={!item.isActive ? "opacity-60" : ""}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {item.icon && <span className="text-base">{item.icon}</span>}
                  <div>
                    <span className="font-medium">{item.name}</span>
                    {item._count && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({item._count.services} services)
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">{item.slug}</TableCell>
              <TableCell>
                <button
                  onClick={() => onToggle(item.id)}
                  disabled={togglingId === item.id}
                  className="cursor-pointer"
                  title="Click to toggle status"
                >
                  {togglingId === item.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <StatusBadge active={item.isActive} />
                  )}
                </button>
              </TableCell>
              <TableCell className="text-muted-foreground">{item.sortOrder}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(item as unknown as Record<string, unknown>)} title="Edit">
                  <Pencil className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Service Table ────────────────────────────────────────────────────────────

function ServiceTable({
  data,
  onEdit,
  onToggle,
  togglingId,
}: {
  data: ServiceItem[];
  onEdit: (item: Record<string, unknown>) => void;
  onToggle: (id: string) => void;
  togglingId: string | null;
}) {
  if (data.length === 0) {
    return <EmptyState message="No services found. Add one to get started." />;
  }

  return (
    <div className="max-h-96 overflow-y-auto custom-scrollbar">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[20%]">Name</TableHead>
            <TableHead className="w-[14%]">Specialty</TableHead>
            <TableHead className="w-[10%]">Duration</TableHead>
            <TableHead className="w-[10%]">Price</TableHead>
            <TableHead className="w-[10%]">Bookable</TableHead>
            <TableHead className="w-[10%]">Status</TableHead>
            <TableHead className="w-[8%]">Sort</TableHead>
            <TableHead className="w-[8%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className={!item.isActive ? "opacity-60" : ""}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-muted-foreground">{item.specialty?.name || "—"}</TableCell>
              <TableCell>{item.durationMinutes} min</TableCell>
              <TableCell className="font-mono text-sm">{formatPrice(item.selfPayPriceCents)}</TableCell>
              <TableCell>
                <Badge
                  variant={item.isBookable ? "default" : "secondary"}
                  className={
                    item.isBookable
                      ? "bg-brand-subtle text-brand-hover  border-brand-border "
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                  }
                >
                  {item.isBookable ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell>
                <button
                  onClick={() => onToggle(item.id)}
                  disabled={togglingId === item.id}
                  className="cursor-pointer"
                  title="Click to toggle status"
                >
                  {togglingId === item.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <StatusBadge active={item.isActive} />
                  )}
                </button>
              </TableCell>
              <TableCell className="text-muted-foreground">{item.sortOrder}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(item as unknown as Record<string, unknown>)} title="Edit">
                  <Pencil className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Insurance Table ──────────────────────────────────────────────────────────

function InsuranceTable({
  data,
  onEdit,
  onToggle,
  togglingId,
}: {
  data: Insurance[];
  onEdit: (item: Record<string, unknown>) => void;
  onToggle: (id: string) => void;
  togglingId: string | null;
}) {
  if (data.length === 0) {
    return <EmptyState message="No insurances found. Add one to get started." />;
  }

  return (
    <div className="max-h-96 overflow-y-auto custom-scrollbar">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Name</TableHead>
            <TableHead className="w-[20%]">Slug</TableHead>
            <TableHead className="w-[10%]">Demo</TableHead>
            <TableHead className="w-[15%]">Status</TableHead>
            <TableHead className="w-[10%]">Sort</TableHead>
            <TableHead className="w-[10%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className={!item.isActive ? "opacity-60" : ""}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {item.name}
                  {item.isDemo && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                      Demo
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">{item.slug}</TableCell>
              <TableCell>{item.isDemo ? "Yes" : "No"}</TableCell>
              <TableCell>
                <button
                  onClick={() => onToggle(item.id)}
                  disabled={togglingId === item.id}
                  className="cursor-pointer"
                  title="Click to toggle status"
                >
                  {togglingId === item.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <StatusBadge active={item.isActive} />
                  )}
                </button>
              </TableCell>
              <TableCell className="text-muted-foreground">{item.sortOrder}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(item as unknown as Record<string, unknown>)} title="Edit">
                  <Pencil className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Amenity Table ────────────────────────────────────────────────────────────

function AmenityTable({
  data,
  onEdit,
}: {
  data: Amenity[];
  onEdit: (item: Record<string, unknown>) => void;
}) {
  if (data.length === 0) {
    return <EmptyState message="No amenities found. Add one to get started." />;
  }

  return (
    <div className="max-h-96 overflow-y-auto custom-scrollbar">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">Name</TableHead>
            <TableHead className="w-[25%]">Slug</TableHead>
            <TableHead className="w-[20%]">Icon</TableHead>
            <TableHead className="w-[15%]">Sort</TableHead>
            <TableHead className="w-[10%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">{item.slug}</TableCell>
              <TableCell>{item.icon || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{item.sortOrder}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(item as unknown as Record<string, unknown>)} title="Edit">
                  <Pencil className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Language Table ───────────────────────────────────────────────────────────

function LanguageTable({
  data,
  onEdit,
}: {
  data: Language[];
  onEdit: (item: Record<string, unknown>) => void;
}) {
  if (data.length === 0) {
    return <EmptyState message="No languages found. Add one to get started." />;
  }

  return (
    <div className="max-h-96 overflow-y-auto custom-scrollbar">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Name</TableHead>
            <TableHead className="w-[20%]">Code</TableHead>
            <TableHead className="w-[25%]">Sort</TableHead>
            <TableHead className="w-[20%] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono">{item.code}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{item.sortOrder}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" onClick={() => onEdit(item as unknown as Record<string, unknown>)} title="Edit">
                  <Pencil className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Database className="size-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
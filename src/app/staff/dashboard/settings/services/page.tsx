"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import {
  Search,
  DollarSign,
  Clock,
  UserPlus,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  Stethoscope,
  CreditCard,
  ShieldCheck,
  Plus,
  Pencil,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { DoctASessionUser } from "@/lib/auth";
import { useActiveClinicId } from "@/components/active-clinic-context";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// ---- Types ----
interface ProviderBrief {
  id: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
}

interface LinkedInsurance {
  id: string;
  insuranceId: string;
  insuranceName: string;
  copayCents: number;
  isActive: boolean;
}

interface ServiceBrief {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  globalPriceCents: number;
  clinicPriceCents: number;
  selfPayPaymentType: string;
  isActive: boolean;
  assignedProviders: ProviderBrief[];
  linkedInsurances: LinkedInsurance[];
}

interface SpecialtyGroup {
  id: string;
  name: string;
  slug: string;
  services: ServiceBrief[];
}

interface ServicesData {
  specialties: SpecialtyGroup[];
  clinicInsurances: Array<{ id: string; name: string; slug: string; isActive: boolean }>;
  selfPayFlatRateCents: number;
}

// ---- Helpers ----
function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function dollarsToCents(str: string): number {
  const num = parseFloat(str);
  if (isNaN(num) || num < 0) return -1;
  return Math.round(num * 100);
}

// ---- Component ----
export default function ServicesSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;

  const [data, setData] = useState<ServicesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Phase A: Specialty filter
  const [activeSpecialty, setActiveSpecialty] = useState<string>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Provider assignment (preserved)
  const [assigningService, setAssigningService] = useState<ServiceBrief | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderBrief[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);

  // Flat rate (preserved)
  const [flatRateDollars, setFlatRateDollars] = useState("");
  const [flatRateSaving, setFlatRateSaving] = useState(false);

  // Payment type (preserved)
  const [paymentTypeLoading, setPaymentTypeLoading] = useState<string | null>(null);

  // Phase C: Custom pricing
  const [editingPriceServiceId, setEditingPriceServiceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceSaving, setPriceSaving] = useState<string | null>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const priceSavingRef = useRef(false);

  // Phase B: Insurance mapping
  const [insuranceAddingServiceId, setInsuranceAddingServiceId] = useState<string | null>(null);
  const [newInsuranceId, setNewInsuranceId] = useState("");
  const [newCopayDollars, setNewCopayDollars] = useState("0.00");
  const [insuranceAddLoading, setInsuranceAddLoading] = useState<string | null>(null);
  const [insuranceRemoveLoading, setInsuranceRemoveLoading] = useState<string | null>(null);
  const [editingCopayKey, setEditingCopayKey] = useState<string | null>(null);
  const [copayDraft, setCopayDraft] = useState("");
  const [copaySaving, setCopaySaving] = useState<string | null>(null);
  const copaySavingRef = useRef(false);

  // Error state
  const [loadError, setLoadError] = useState<string | null>(null);

  const clinicId = useActiveClinicId(user?.clinicId);

  // ---- Data Fetching ----
  const fetchData = useCallback(async () => {
    if (!clinicId) return;
    try {
      const res = await fetch(`/api/staff/services?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed to fetch services");
      const json = await res.json();
      setData(json);
      setFlatRateDollars((json.selfPayFlatRateCents / 100).toFixed(2));
      // Initialize expanded groups: first specialty when "all"
      if (json.specialties?.length > 0) {
        setExpandedGroups(new Set([json.specialties[0].id]));
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Failed to load services data";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  const fetchProviders = useCallback(async () => {
    if (!clinicId) return;
    try {
      const res = await fetch(`/api/staff/providers?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed to fetch providers");
      const json = await res.json();
      setProviders(json.providers || []);
    } catch (err) {
      console.error(err);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchData();
    fetchProviders();
  }, [fetchData, fetchProviders]);

  // Focus price input when entering edit mode
  useEffect(() => {
    if (editingPriceServiceId && priceInputRef.current) {
      priceInputRef.current.focus();
      priceInputRef.current.select();
    }
  }, [editingPriceServiceId]);

  // ---- Filtered Specialties ----
  const filteredSpecialties = data?.specialties
    .map((spec) => ({
      ...spec,
      services: spec.services.filter(
        (svc) =>
          svc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          spec.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((spec) => spec.services.length > 0) ?? [];

  // Count services for search indicator
  const totalServiceCount = data?.specialties.reduce((sum, s) => sum + s.services.length, 0) ?? 0;
  const filteredServiceCount = filteredSpecialties.reduce((sum, s) => sum + s.services.length, 0);

  // When "All" filter, show all filtered specialties
  // When specific specialty, show only that one
  const displayedSpecialties =
    activeSpecialty === "all"
      ? filteredSpecialties
      : filteredSpecialties.filter((s) => s.id === activeSpecialty);

  // Phase A: Toggle specialty filter
  const handleSpecialtyFilter = (specId: string) => {
    setActiveSpecialty(specId);
    if (specId === "all") {
      // Reset to first specialty expanded
      const first = filteredSpecialties[0];
      setExpandedGroups(first ? new Set([first.id]) : new Set());
    } else {
      setExpandedGroups(new Set([specId]));
    }
  };

  // Toggle collapsible group
  const toggleGroup = (specId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(specId)) {
        next.delete(specId);
      } else {
        next.add(specId);
      }
      return next;
    });
  };

  // Compute assignment stats per specialty (for tab indicators)
  const getSpecialtyStats = (spec: SpecialtyGroup) => {
    const total = spec.services.length;
    const withProviders = spec.services.filter((s) => s.assignedProviders.length > 0).length;
    return { total, withProviders };
  };

  // ---- Handlers: Preserved ----

  // Save self-pay flat rate
  const handleSaveFlatRate = async () => {
    const cents = dollarsToCents(flatRateDollars);
    if (cents < 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setFlatRateSaving(true);
    try {
      const res = await fetch("/api/staff/services/clinic", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfPayFlatRateCents: cents }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      toast.success("Self-pay flat rate updated");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save flat rate");
    } finally {
      setFlatRateSaving(false);
    }
  };

  // Assign service to provider
  const handleAssign = async () => {
    if (!assigningService || !selectedProviderId) return;
    setAssignLoading(true);
    try {
      const res = await fetch("/api/staff/services/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: selectedProviderId,
          serviceId: assigningService.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign");
      }
      toast.success(`Assigned "${assigningService.name}" to provider`);
      setAssignDialogOpen(false);
      setSelectedProviderId("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign service");
    } finally {
      setAssignLoading(false);
    }
  };

  // Remove service from provider
  const handleRemove = async (providerId: string, serviceId: string, serviceName: string) => {
    setRemoveLoading(`${providerId}-${serviceId}`);
    try {
      const res = await fetch("/api/staff/services/assign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, serviceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove");
      }
      toast.success(`Removed "${serviceName}" from provider`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove service");
    } finally {
      setRemoveLoading(null);
    }
  };

  // Change payment type
  const handlePaymentTypeChange = async (serviceId: string, newType: string) => {
    setPaymentTypeLoading(serviceId);
    try {
      const res = await fetch(`/api/staff/services/${serviceId}/payment-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfPayPaymentType: newType }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update payment type");
      }
      toast.success("Payment type updated");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update payment type");
    } finally {
      setPaymentTypeLoading(null);
    }
  };

  // ---- Phase C: Custom Pricing Handlers ----

  const startPriceEdit = (service: ServiceBrief) => {
    const currentCents = service.clinicPriceCents > 0 ? service.clinicPriceCents : service.globalPriceCents;
    setPriceDraft((currentCents / 100).toFixed(2));
    setEditingPriceServiceId(service.id);
  };

  const cancelPriceEdit = () => {
    setEditingPriceServiceId(null);
    setPriceDraft("");
  };

  const savePrice = async (serviceId: string) => {
    const cents = dollarsToCents(priceDraft);
    if (cents < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    if (priceSavingRef.current) return;
    priceSavingRef.current = true;
    setPriceSaving(serviceId);
    try {
      const res = await fetch("/api/staff/clinic-service", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, clinicPriceCents: cents }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save price");
      }
      toast.success("Service price updated");
      setEditingPriceServiceId(null);
      setPriceDraft("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save price");
    } finally {
      priceSavingRef.current = false;
      setPriceSaving(null);
    }
  };

  // ---- Phase B: Insurance Mapping Handlers ----

  const handleAddInsurance = async (serviceId: string) => {
    if (!newInsuranceId) return;
    const copayCents = dollarsToCents(newCopayDollars);
    if (copayCents < 0) {
      toast.error("Please enter a valid copay amount");
      return;
    }
    setInsuranceAddLoading(serviceId);
    try {
      const res = await fetch("/api/staff/service-insurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, insuranceId: newInsuranceId, copayCents }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add insurance");
      }
      toast.success("Insurance coverage added");
      setNewInsuranceId("");
      setNewCopayDollars("0.00");
      setInsuranceAddingServiceId(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add insurance");
    } finally {
      setInsuranceAddLoading(null);
    }
  };

  const handleRemoveInsurance = async (serviceId: string, insuranceId: string, insuranceName: string) => {
    setInsuranceRemoveLoading(`${serviceId}-${insuranceId}`);
    try {
      const res = await fetch("/api/staff/service-insurances", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, insuranceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove insurance");
      }
      toast.success(`Removed ${insuranceName} coverage`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove insurance");
    } finally {
      setInsuranceRemoveLoading(null);
    }
  };

  const startCopayEdit = (key: string, currentCents: number) => {
    setEditingCopayKey(key);
    setCopayDraft((currentCents / 100).toFixed(2));
  };

  const saveCopay = async (serviceId: string, insuranceId: string) => {
    const copayCents = dollarsToCents(copayDraft);
    if (copayCents < 0) {
      toast.error("Please enter a valid copay amount");
      return;
    }
    if (copaySavingRef.current) return;
    copaySavingRef.current = true;
    setCopaySaving(`${serviceId}-${insuranceId}`);
    try {
      const res = await fetch("/api/staff/service-insurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, insuranceId, copayCents }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update copay");
      }
      toast.success("Copay updated");
      setEditingCopayKey(null);
      setCopayDraft("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update copay");
    } finally {
      copaySavingRef.current = false;
      setCopaySaving(null);
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
            <h3 className="font-semibold text-lg">Failed to load services</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-md">{loadError}</p>
          </div>
          <Button variant="outline" onClick={() => { setLoadError(null); fetchData(); }} className="gap-2">
            <RefreshCw className="size-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ---- Render: Loading ----
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb items={[{ label: "Settings" }, { label: "Services & Insurance" }]} />
      {/* Card 1: Self-Pay Flat Rate (preserved) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="size-5 text-brand" />
            Self-Pay Flat Rate
          </CardTitle>
          <CardDescription>
            Set a per-visit flat rate for self-pay patients at your clinic.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 max-w-sm">
            <div className="flex-1">
              <Label htmlFor="selfPayFlatRate">Flat Rate</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="selfPayFlatRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={flatRateDollars}
                  onChange={(e) => setFlatRateDollars(e.target.value)}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>
            <Button
              onClick={handleSaveFlatRate}
              disabled={flatRateSaving}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              {flatRateSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </div>
          {data && data.clinicInsurances.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Accepted insurances:</span>
              {data.clinicInsurances.map((ins) => (
                <Badge key={ins.id} variant="secondary" className="text-xs">
                  {ins.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Service Catalog — Redesigned */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Stethoscope className="size-5 text-brand" />
                  Service Catalog
                </CardTitle>
                <CardDescription className="mt-1">
                  Browse, configure pricing, and assign services to your providers
                </CardDescription>
              </div>
              {/* Search */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search services or specialties..."
                    aria-label="Search services or specialties"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                      aria-label="Clear search"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {filteredServiceCount} of {totalServiceCount} services
                  </span>
                )}
              </div>
            </div>

            {/* Phase A: Specialty Quick-Nav Tabs */}
            {data && (
              <ScrollArea className="w-full -mb-1">
                <div className="flex items-center gap-2 pb-2">
                  <button
                    onClick={() => handleSpecialtyFilter("all")}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      activeSpecialty === "all"
                        ? "bg-brand text-white shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    All
                    <span className={`text-[10px] ${activeSpecialty === "all" ? "text-white/70" : "text-muted-foreground/70"}`}>
                      ({data.specialties.reduce((sum, s) => sum + s.services.length, 0)})
                    </span>
                  </button>
                  {data.specialties.map((spec) => {
                    const stats = getSpecialtyStats(spec);
                    const isActive = activeSpecialty === spec.id;
                    const allAssigned = stats.withProviders === stats.total;
                    return (
                      <button
                        key={spec.id}
                        onClick={() => handleSpecialtyFilter(spec.id)}
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-brand text-white shadow-sm"
                            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        }`}
                      >
                        {spec.name}
                        <span className={`text-[10px] ${isActive ? "text-white/70" : "text-muted-foreground/70"}`}>
                          ({stats.total})
                        </span>
                        <span
                          className={`inline-block size-1.5 rounded-full ${
                            allAssigned
                              ? isActive
                                ? "bg-green-300"
                                : "bg-green-500"
                              : isActive
                                ? "bg-white/40"
                                : "bg-muted-foreground/30"
                          }`}
                          title={`${stats.withProviders}/${stats.total} services with providers`}
                        />
                      </button>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!displayedSpecialties || displayedSpecialties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="size-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {searchQuery ? "No results found" : "No services available"}
              </p>
              <p className="text-xs mt-1">
                {searchQuery
                  ? `No services match "${searchQuery}". Try a different search term.`
                  : "Add services from the catalog to get started."}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="size-3.5 mr-1.5" />
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedSpecialties.map((specialty) => {
                const isOpen = expandedGroups.has(specialty.id);
                return (
                  <Collapsible
                    key={specialty.id}
                    open={isOpen}
                    onOpenChange={(open) => {
                      // Only handle manual toggle from the trigger button
                      // Don't fight with the controlled `open` prop changes
                      if (open && !isOpen) {
                        setExpandedGroups((prev) => new Set(prev).add(specialty.id));
                      } else if (!open && isOpen) {
                        setExpandedGroups((prev) => {
                          const next = new Set(prev);
                          next.delete(specialty.id);
                          return next;
                        });
                      }
                    }}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 w-full py-2 group">
                        {isOpen ? (
                          <ChevronDown className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                        <span className="text-sm font-semibold text-foreground">
                          {specialty.name}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {specialty.services.length}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-1">
                          — {specialty.services.length} service{specialty.services.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-3 pt-1 pb-2 pl-6">
                        {specialty.services.map((service) => (
                          <ServiceRow
                            key={service.id}
                            service={service}
                            clinicInsurances={data?.clinicInsurances ?? []}
                            // Provider assignment handlers
                            removeLoading={removeLoading}
                            onRemoveProvider={handleRemove}
                            onAssignClick={() => {
                              setAssigningService(service);
                              setSelectedProviderId("");
                              setAssignDialogOpen(true);
                            }}
                            // Payment type handler
                            paymentTypeLoading={paymentTypeLoading}
                            onPaymentTypeChange={handlePaymentTypeChange}
                            // Phase C: Pricing
                            editingPriceServiceId={editingPriceServiceId}
                            priceDraft={priceDraft}
                            priceSaving={priceSaving}
                            priceInputRef={priceInputRef}
                            onPriceDraftChange={setPriceDraft}
                            onStartPriceEdit={startPriceEdit}
                            onCancelPriceEdit={cancelPriceEdit}
                            onSavePrice={savePrice}
                            // Phase B: Insurance
                            insuranceAddingServiceId={insuranceAddingServiceId}
                            newInsuranceId={newInsuranceId}
                            newCopayDollars={newCopayDollars}
                            insuranceAddLoading={insuranceAddLoading}
                            insuranceRemoveLoading={insuranceRemoveLoading}
                            editingCopayKey={editingCopayKey}
                            copayDraft={copayDraft}
                            copaySaving={copaySaving}
                            onSetInsuranceAddingServiceId={setInsuranceAddingServiceId}
                            onNewInsuranceIdChange={setNewInsuranceId}
                            onNewCopayDollarsChange={setNewCopayDollars}
                            onAddInsurance={handleAddInsurance}
                            onRemoveInsurance={handleRemoveInsurance}
                            onStartCopayEdit={startCopayEdit}
                            onCopayDraftChange={setCopayDraft}
                            onSaveCopay={saveCopay}
                            onCancelCopayEdit={() => setEditingCopayKey(null)}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Provider Dialog (preserved) */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Service to Provider</DialogTitle>
            <DialogDescription>
              Select a provider to offer{" "}
              <span className="font-medium text-foreground">
                {assigningService?.name}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="providerSelect">Provider</Label>
            <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
              <SelectTrigger id="providerSelect" className="mt-1.5">
                <SelectValue placeholder="Choose a provider..." />
              </SelectTrigger>
              <SelectContent>
                {providers.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    No providers available. Add providers first.
                  </div>
                ) : (
                  providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                      {p.credentials ? ` (${p.credentials})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
              disabled={assignLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={assignLoading || !selectedProviderId}
              className="bg-brand hover:bg-brand-hover text-white"
            >
              {assignLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Assign"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- ServiceRow sub-component ----
interface ServiceRowProps {
  service: ServiceBrief;
  clinicInsurances: Array<{ id: string; name: string; slug: string; isActive: boolean }>;
  // Provider assignment
  removeLoading: string | null;
  onRemoveProvider: (providerId: string, serviceId: string, serviceName: string) => void;
  onAssignClick: () => void;
  // Payment type
  paymentTypeLoading: string | null;
  onPaymentTypeChange: (serviceId: string, newType: string) => void;
  // Phase C: Pricing
  editingPriceServiceId: string | null;
  priceDraft: string;
  priceSaving: string | null;
  priceInputRef: React.RefObject<HTMLInputElement | null>;
  onPriceDraftChange: (val: string) => void;
  onStartPriceEdit: (service: ServiceBrief) => void;
  onCancelPriceEdit: () => void;
  onSavePrice: (serviceId: string) => void;
  // Phase B: Insurance
  insuranceAddingServiceId: string | null;
  newInsuranceId: string;
  newCopayDollars: string;
  insuranceAddLoading: string | null;
  insuranceRemoveLoading: string | null;
  editingCopayKey: string | null;
  copayDraft: string;
  copaySaving: string | null;
  onSetInsuranceAddingServiceId: (id: string | null) => void;
  onNewInsuranceIdChange: (val: string) => void;
  onNewCopayDollarsChange: (val: string) => void;
  onAddInsurance: (serviceId: string) => void;
  onRemoveInsurance: (serviceId: string, insuranceId: string, name: string) => void;
  onStartCopayEdit: (key: string, currentCents: number) => void;
  onCopayDraftChange: (val: string) => void;
  onSaveCopay: (serviceId: string, insuranceId: string) => void;
  onCancelCopayEdit: () => void;
}

function ServiceRow({
  service,
  clinicInsurances,
  removeLoading,
  onRemoveProvider,
  onAssignClick,
  paymentTypeLoading,
  onPaymentTypeChange,
  editingPriceServiceId,
  priceDraft,
  priceSaving,
  priceInputRef,
  onPriceDraftChange,
  onStartPriceEdit,
  onCancelPriceEdit,
  onSavePrice,
  insuranceAddingServiceId,
  newInsuranceId,
  newCopayDollars,
  insuranceAddLoading,
  insuranceRemoveLoading,
  editingCopayKey,
  copayDraft,
  copaySaving,
  onSetInsuranceAddingServiceId,
  onNewInsuranceIdChange,
  onNewCopayDollarsChange,
  onAddInsurance,
  onRemoveInsurance,
  onStartCopayEdit,
  onCopayDraftChange,
  onSaveCopay,
  onCancelCopayEdit,
}: ServiceRowProps) {
  const isEditingPrice = editingPriceServiceId === service.id;
  const hasCustomPrice = service.clinicPriceCents > 0;
  const effectivePriceCents = service.clinicPriceCents > 0 ? service.clinicPriceCents : service.globalPriceCents;
  const isAddingInsurance = insuranceAddingServiceId === service.id;

  // Insurances not yet linked to this service
  const availableInsurances = clinicInsurances.filter(
    (ci) => !service.linkedInsurances.some((li) => li.insuranceId === ci.id)
  );

  return (
    <div className="border border-border rounded-lg p-4 hover:border-brand-border transition-colors">
      {/* Row 1: Service name, duration, price, actions */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm text-foreground">
              {service.name}
            </h4>
            <Badge variant="outline" className="text-xs gap-1">
              <Clock className="size-3" />
              {service.durationMinutes} min
            </Badge>

            {/* Phase C: Pricing */}
            {isEditingPrice ? (
              <div className="inline-flex items-center gap-1.5">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <Input
                    ref={priceInputRef}
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceDraft}
                    onChange={(e) => onPriceDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSavePrice(service.id);
                      if (e.key === "Escape") onCancelPriceEdit();
                    }}
                    onBlur={() => onSavePrice(service.id)}
                    className="h-7 w-24 pl-5 text-xs"
                  />
                </div>
                <button
                  onClick={() => onSavePrice(service.id)}
                  disabled={priceSaving === service.id}
                  className="p-1 rounded hover:bg-brand-subtle text-brand transition-colors"
                  title="Save price"
                >
                  {priceSaving === service.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                </button>
                <button
                  onClick={onCancelPriceEdit}
                  className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                  title="Cancel"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : hasCustomPrice ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-xs gap-1 cursor-pointer border-brand/30 text-brand bg-brand-subtle/50 hover:bg-brand-subtle transition-colors"
                    onClick={() => onStartPriceEdit(service)}
                  >
                    <DollarSign className="size-3" />
                    {centsToDollars(service.clinicPriceCents)}
                    <Pencil className="size-2.5 opacity-60" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Your Price — click to edit (global: {centsToDollars(service.globalPriceCents)})
                </TooltipContent>
              </Tooltip>
            ) : service.globalPriceCents > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-xs gap-1 cursor-pointer hover:border-brand/30 hover:text-foreground transition-colors"
                    onClick={() => onStartPriceEdit(service)}
                  >
                    Default: {centsToDollars(service.globalPriceCents)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Click to set a custom price for your clinic</TooltipContent>
              </Tooltip>
            ) : null}
          </div>

          {service.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {service.description}
            </p>
          )}

          {/* Assigned Providers */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mr-1">
              Providers
            </span>
            {service.assignedProviders.length === 0 ? (
              <span className="text-xs text-muted-foreground italic">
                None assigned
              </span>
            ) : (
              service.assignedProviders.map((provider) => (
                <Badge
                  key={provider.id}
                  variant="secondary"
                  className="text-xs gap-1.5 pr-1"
                >
                  {provider.firstName} {provider.lastName}
                  {provider.credentials && (
                    <span className="text-muted-foreground">
                      {provider.credentials}
                    </span>
                  )}
                  <button
                    onClick={() =>
                      onRemoveProvider(provider.id, service.id, service.name)
                    }
                    disabled={
                      removeLoading === `${provider.id}-${service.id}`
                    }
                    className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Remove assignment"
                  >
                    {removeLoading === `${provider.id}-${service.id}` ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <X className="size-3" />
                    )}
                  </button>
                </Badge>
              ))
            )}
          </div>

          {/* Phase B: Insurance Coverage */}
          <div className="mt-3 border-t border-border/60 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Accepted Insurances
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {service.linkedInsurances.length}
              </Badge>
            </div>

            {service.linkedInsurances.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {service.linkedInsurances.map((li) => {
                  const copayKey = `${service.id}-${li.insuranceId}`;
                  const isEditingCopay = editingCopayKey === copayKey;
                  return (
                    <div
                      key={li.id}
                      className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5"
                    >
                      <span className="text-xs text-foreground flex-1 min-w-0 truncate">
                        {li.insuranceName}
                      </span>
                      {isEditingCopay ? (
                        <div className="inline-flex items-center gap-1">
                          <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={copayDraft}
                              onChange={(e) => onCopayDraftChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") onSaveCopay(service.id, li.insuranceId);
                                if (e.key === "Escape") onCancelCopayEdit();
                              }}
                              onBlur={() => onSaveCopay(service.id, li.insuranceId)}
                              className="h-6 w-20 pl-4 text-[11px]"
                            />
                          </div>
                          <button
                            onClick={() => onSaveCopay(service.id, li.insuranceId)}
                            disabled={copaySaving === copayKey}
                            className="p-0.5 rounded hover:bg-brand-subtle text-brand"
                          >
                            {copaySaving === copayKey ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Check className="size-3" />
                            )}
                          </button>
                          <button
                            onClick={onCancelCopayEdit}
                            className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => onStartCopayEdit(copayKey, li.copayCents)}
                              className="text-xs font-medium text-brand hover:underline cursor-pointer whitespace-nowrap"
                            >
                              ${li.copayCents > 0 ? (li.copayCents / 100).toFixed(2) : "0.00"}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Copay — click to edit</TooltipContent>
                        </Tooltip>
                      )}
                      <button
                        onClick={() => onRemoveInsurance(service.id, li.insuranceId, li.insuranceName)}
                        disabled={insuranceRemoveLoading === `${service.id}-${li.insuranceId}`}
                        className="p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                        title="Remove insurance"
                      >
                        {insuranceRemoveLoading === `${service.id}-${li.insuranceId}` ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <X className="size-3" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add insurance row */}
            {isAddingInsurance ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={newInsuranceId} onValueChange={onNewInsuranceIdChange}>
                  <SelectTrigger className="h-7 w-[180px] text-xs">
                    <SelectValue placeholder="Select insurance..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInsurances.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                        All insurances already linked
                      </div>
                    ) : (
                      availableInsurances.map((ins) => (
                        <SelectItem key={ins.id} value={ins.id} className="text-xs">
                          {ins.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newCopayDollars}
                    onChange={(e) => onNewCopayDollarsChange(e.target.value)}
                    className="h-7 w-20 pl-4 text-xs"
                    placeholder="Copay"
                  />
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1 bg-brand hover:bg-brand-hover text-white"
                  disabled={!newInsuranceId || insuranceAddLoading === service.id}
                  onClick={() => onAddInsurance(service.id)}
                >
                  {insuranceAddLoading === service.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <>
                      <Plus className="size-3" />
                      Add
                    </>
                  )}
                </Button>
                <button
                  onClick={() => {
                    onSetInsuranceAddingServiceId(null);
                    onNewInsuranceIdChange("");
                    onNewCopayDollarsChange("0.00");
                  }}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onSetInsuranceAddingServiceId(service.id)}
                className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-hover transition-colors"
              >
                <Plus className="size-3" />
                Add insurance
              </button>
            )}
          </div>
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-2 shrink-0 lg:mt-0 mt-1">
          {/* Payment Type Dropdown */}
          <div className="flex items-center gap-1.5">
            <CreditCard className="size-3.5 text-muted-foreground" />
            <Select
              value={service.selfPayPaymentType}
              onValueChange={(value) => onPaymentTypeChange(service.id, value)}
              disabled={paymentTypeLoading === service.id}
            >
              <SelectTrigger className="w-[150px] h-8 text-xs">
                {paymentTypeLoading === service.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_UPFRONT">Full Upfront</SelectItem>
                <SelectItem value="STANDARD_DEPOSIT">Standard Deposit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assign to Provider Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={onAssignClick}
          >
            <UserPlus className="size-3.5" />
            Assign
          </Button>
        </div>
      </div>
    </div>
  );
}
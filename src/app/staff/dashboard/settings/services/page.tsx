"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Search,
  DollarSign,
  Clock,
  UserPlus,
  X,
  ChevronDown,
  Loader2,
  Stethoscope,
  CreditCard,
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

// ---- Types ----
interface ProviderBrief {
  id: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
}

interface ServiceBrief {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  selfPayPriceCents: number;
  selfPayPaymentType: string;
  isActive: boolean;
  assignedProviders: ProviderBrief[];
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

function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function dollarsToCents(dollars: string): number {
  const num = parseFloat(dollars);
  if (isNaN(num) || num < 0) return -1;
  return Math.round(num * 100);
}

export default function ServicesSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;

  const [data, setData] = useState<ServicesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [assigningService, setAssigningService] = useState<ServiceBrief | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderBrief[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [flatRateDollars, setFlatRateDollars] = useState("");
  const [flatRateSaving, setFlatRateSaving] = useState(false);
  const [paymentTypeLoading, setPaymentTypeLoading] = useState<string | null>(null);

  const clinicId = useActiveClinicId(user?.clinicId);

  const fetchData = useCallback(async () => {
    if (!clinicId) return;
    try {
      const res = await fetch(`/api/staff/services?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed to fetch services");
      const json = await res.json();
      setData(json);
      setFlatRateDollars((json.selfPayFlatRateCents / 100).toFixed(2));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load services data");
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

  // Filter services by search
  const filteredSpecialties = data?.specialties
    .map((spec) => ({
      ...spec,
      services: spec.services.filter(
        (svc) =>
          svc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          spec.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((spec) => spec.services.length > 0);

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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card 1: Self-Pay Flat Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="size-5 text-emerald-600" />
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
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

      {/* Card 2: Service Catalog */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="size-5 text-emerald-600" />
                Service Catalog
              </CardTitle>
              <CardDescription className="mt-1">
                Browse and assign services to your providers
              </CardDescription>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search services or specialties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!filteredSpecialties || filteredSpecialties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Stethoscope className="size-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {searchQuery ? "No services match your search." : "No services available."}
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-1">
              {filteredSpecialties.map((specialty) => (
                <div key={specialty.id}>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {specialty.name}
                  </h3>
                  <div className="space-y-3">
                    {specialty.services.map((service) => (
                      <div
                        key={service.id}
                        className="border border-border rounded-lg p-4 hover:border-emerald-200 transition-colors"
                      >
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
                              {service.selfPayPriceCents > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {centsToDollars(service.selfPayPriceCents)}
                                </Badge>
                              )}
                            </div>
                            {service.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {service.description}
                              </p>
                            )}
                            {/* Assigned providers */}
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              {service.assignedProviders.length === 0 ? (
                                <span className="text-xs text-muted-foreground italic">
                                  No providers assigned
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
                                        handleRemove(
                                          provider.id,
                                          service.id,
                                          service.name
                                        )
                                      }
                                      disabled={
                                        removeLoading ===
                                        `${provider.id}-${service.id}`
                                      }
                                      className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                      title="Remove assignment"
                                    >
                                      {removeLoading ===
                                      `${provider.id}-${service.id}` ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : (
                                        <X className="size-3" />
                                      )}
                                    </button>
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Payment Type Dropdown */}
                            <div className="flex items-center gap-2">
                              <CreditCard className="size-4 text-muted-foreground" />
                              <Select
                                value={service.selfPayPaymentType}
                                onValueChange={(value) =>
                                  handlePaymentTypeChange(service.id, value)
                                }
                                disabled={paymentTypeLoading === service.id}
                              >
                                <SelectTrigger className="w-[170px] h-8 text-xs">
                                  {paymentTypeLoading === service.id ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <SelectValue />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="FULL_UPFRONT">
                                    Full Upfront
                                  </SelectItem>
                                  <SelectItem value="STANDARD_DEPOSIT">
                                    Standard Deposit
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Assign to Provider Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5"
                              onClick={() => {
                                setAssigningService(service);
                                setSelectedProviderId("");
                                setAssignDialogOpen(true);
                              }}
                            >
                              <UserPlus className="size-3.5" />
                              Assign
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Provider Dialog */}
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
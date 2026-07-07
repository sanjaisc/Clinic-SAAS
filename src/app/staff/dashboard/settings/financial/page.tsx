"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  DollarSign,
  Clock,
  RefreshCw,
  CreditCard,
  Loader2,
  AlertTriangle,
  Info,
  ShieldCheck,
  ArrowRightLeft,
  HeartHandshake,
  Stethoscope,
} from "lucide-react";
import type { DoctASessionUser } from "@/lib/auth";
import { RESCHEDULE_POLICY } from "@/lib/enums";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---- Types ----
interface ClinicService {
  id: string;
  name: string;
  selfPayPaymentType: string;
  selfPayPriceCents: number;
  durationMinutes: number;
  providers: Array<{ id: string; firstName: string; lastName: string; credentials: string | null }>;
}

interface FinancialData {
  inPersonDepositCents: number;
  videoDepositCents: number;
  selfPayFlatRateCents: number;
  cancellationLeadTimeMin: number;
  videoCancellationLeadTimeMin: number;
  reschedulePolicy: string;
  system: {
    minDepositCents: number;
    maxDepositCents: number;
  };
  services: ClinicService[];
}

const RESCHEDULE_OPTIONS = [
  {
    value: RESCHEDULE_POLICY.FORFEIT_ON_LATE,
    label: "Forfeit on Late Reschedule",
    description:
      "If the patient reschedules after the cancellation lead time, the deposit is forfeited. A new deposit is required for the new appointment.",
    icon: ShieldCheck,
  },
  {
    value: RESCHEDULE_POLICY.TRANSFER_ON_LATE,
    label: "Transfer on Late Reschedule",
    description:
      "If the patient reschedules after the cancellation lead time, the deposit is automatically transferred to the new appointment. No additional deposit required.",
    icon: ArrowRightLeft,
  },
  {
    value: RESCHEDULE_POLICY.ALLOW_1_GRACE_TRANSFER,
    label: "Allow 1 Grace Transfer",
    description:
      "Patients are allowed one late reschedule per appointment where the deposit is transferred. Subsequent late reschedules forfeit the deposit.",
    icon: HeartHandshake,
  },
];

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(dollars: string): number {
  const num = parseFloat(dollars);
  if (isNaN(num) || num < 0) return -1;
  return Math.round(num * 100);
}

function minutesToHours(minutes: number): string {
  return (minutes / 60).toFixed(1).replace(/\.0$/, "");
}

function hoursToMinutes(hoursStr: string): number {
  const num = parseFloat(hoursStr);
  if (isNaN(num) || num < 0) return -1;
  return Math.round(num * 60);
}

export default function FinancialSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;

  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [inPersonDeposit, setInPersonDeposit] = useState("");
  const [videoDeposit, setVideoDeposit] = useState("");
  const [inPersonLeadTime, setInPersonLeadTime] = useState("");
  const [videoLeadTime, setVideoLeadTime] = useState("");
  const [reschedulePolicy, setReschedulePolicy] = useState("");
  const [paymentTypes, setPaymentTypes] = useState<Record<string, string>>({});

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clinicId = user?.clinicId;

  const fetchData = useCallback(async () => {
    if (!clinicId) return;
    try {
      const res = await fetch(`/api/staff/financial?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed to fetch financial settings");
      const json = await res.json();
      setData(json);

      // Initialize form state
      setInPersonDeposit(centsToDollars(json.inPersonDepositCents));
      setVideoDeposit(centsToDollars(json.videoDepositCents));
      setInPersonLeadTime(minutesToHours(json.cancellationLeadTimeMin));
      setVideoLeadTime(minutesToHours(json.videoCancellationLeadTimeMin));
      setReschedulePolicy(json.reschedulePolicy);

      // Build payment type map
      const ptMap: Record<string, string> = {};
      for (const svc of json.services) {
        ptMap[svc.id] = svc.selfPayPaymentType;
      }
      setPaymentTypes(ptMap);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load financial settings");
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const inPersonCents = dollarsToCents(inPersonDeposit);
    const videoCents = dollarsToCents(videoDeposit);
    const inPersonMin = hoursToMinutes(inPersonLeadTime);
    const videoMin = hoursToMinutes(videoLeadTime);

    if (data) {
      const { minDepositCents, maxDepositCents } = data.system;

      if (inPersonCents < 0) {
        newErrors.inPersonDeposit = "Enter a valid amount";
      } else if (inPersonCents < minDepositCents || inPersonCents > maxDepositCents) {
        newErrors.inPersonDeposit = `Must be between $${centsToDollars(minDepositCents)} and $${centsToDollars(maxDepositCents)}`;
      }

      if (videoCents < 0) {
        newErrors.videoDeposit = "Enter a valid amount";
      } else if (videoCents < minDepositCents || videoCents > maxDepositCents) {
        newErrors.videoDeposit = `Must be between $${centsToDollars(minDepositCents)} and $${centsToDollars(maxDepositCents)}`;
      }
    }

    if (inPersonMin < 0) {
      newErrors.inPersonLeadTime = "Enter a valid number";
    }

    if (videoMin < 0) {
      newErrors.videoLeadTime = "Enter a valid number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveAll = async () => {
    if (!validate()) {
      toast.error("Please fix the validation errors before saving");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        inPersonDepositCents: dollarsToCents(inPersonDeposit),
        videoDepositCents: dollarsToCents(videoDeposit),
        cancellationLeadTimeMin: hoursToMinutes(inPersonLeadTime),
        videoCancellationLeadTimeMin: hoursToMinutes(videoLeadTime),
        reschedulePolicy,
      };

      const res = await fetch("/api/staff/financial", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      // Also update any changed payment types
      if (data) {
        const paymentTypePromises = Object.entries(paymentTypes).map(
          async ([serviceId, newType]) => {
            const currentType = data.services.find((s) => s.id === serviceId)?.selfPayPaymentType;
            if (currentType && currentType !== newType) {
              const ptRes = await fetch(`/api/staff/services/${serviceId}/payment-type`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ selfPayPaymentType: newType }),
              });
              if (!ptRes.ok) {
                const err = await ptRes.json();
                throw new Error(err.error || `Failed to update payment type for service ${serviceId}`);
              }
            }
            return Promise.resolve();
          }
        );

        await Promise.all(paymentTypePromises);
      }

      toast.success("Financial settings saved successfully");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentTypeChange = (serviceId: string, value: string) => {
    setPaymentTypes((prev) => ({ ...prev, [serviceId]: value }));
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const { system } = data;

  return (
    <div className="space-y-6">
      {/* Card 1: Deposit Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="size-5 text-emerald-600" />
            Deposit Configuration
          </CardTitle>
          <CardDescription>
            Set the deposit amounts required when patients book appointments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            System limits: ${centsToDollars(system.minDepositCents)} – ${centsToDollars(system.maxDepositCents)}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* In-Person Deposit */}
            <div>
              <Label htmlFor="inPersonDeposit">In-Person Deposit</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="inPersonDeposit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={inPersonDeposit}
                  onChange={(e) => {
                    setInPersonDeposit(e.target.value);
                    if (errors.inPersonDeposit) setErrors((prev) => ({ ...prev, inPersonDeposit: "" }));
                  }}
                  className={`pl-7 ${errors.inPersonDeposit ? "border-destructive" : ""}`}
                />
              </div>
              {errors.inPersonDeposit && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  {errors.inPersonDeposit}
                </p>
              )}
            </div>

            {/* Telehealth Deposit */}
            <div>
              <Label htmlFor="videoDeposit">Telehealth Deposit</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="videoDeposit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={videoDeposit}
                  onChange={(e) => {
                    setVideoDeposit(e.target.value);
                    if (errors.videoDeposit) setErrors((prev) => ({ ...prev, videoDeposit: "" }));
                  }}
                  className={`pl-7 ${errors.videoDeposit ? "border-destructive" : ""}`}
                />
              </div>
              {errors.videoDeposit && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  {errors.videoDeposit}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Cancellation Policies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-5 text-emerald-600" />
            Cancellation Policies
          </CardTitle>
          <CardDescription>
            Define how far in advance patients must cancel to avoid penalties.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            Patients who cancel after the lead time may forfeit their deposit based on your reschedule policy below.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* In-Person Cancellation Lead Time */}
            <div>
              <Label htmlFor="inPersonLeadTime">In-Person Cancellation Lead Time</Label>
              <div className="relative mt-1.5">
                <Input
                  id="inPersonLeadTime"
                  type="number"
                  min="0"
                  step="0.5"
                  value={inPersonLeadTime}
                  onChange={(e) => {
                    setInPersonLeadTime(e.target.value);
                    if (errors.inPersonLeadTime) setErrors((prev) => ({ ...prev, inPersonLeadTime: "" }));
                  }}
                  className={`pr-12 ${errors.inPersonLeadTime ? "border-destructive" : ""}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  hours
                </span>
              </div>
              {errors.inPersonLeadTime && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  {errors.inPersonLeadTime}
                </p>
              )}
            </div>

            {/* Telehealth Cancellation Lead Time */}
            <div>
              <Label htmlFor="videoLeadTime">Telehealth Cancellation Lead Time</Label>
              <div className="relative mt-1.5">
                <Input
                  id="videoLeadTime"
                  type="number"
                  min="0"
                  step="0.5"
                  value={videoLeadTime}
                  onChange={(e) => {
                    setVideoLeadTime(e.target.value);
                    if (errors.videoLeadTime) setErrors((prev) => ({ ...prev, videoLeadTime: "" }));
                  }}
                  className={`pr-12 ${errors.videoLeadTime ? "border-destructive" : ""}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  hours
                </span>
              </div>
              {errors.videoLeadTime && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  {errors.videoLeadTime}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Reschedule Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="size-5 text-emerald-600" />
            Reschedule Policy
          </CardTitle>
          <CardDescription>
            Choose what happens when a patient reschedules after the cancellation lead time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={reschedulePolicy} onValueChange={setReschedulePolicy}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Select a policy..." />
            </SelectTrigger>
            <SelectContent>
              {RESCHEDULE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      {opt.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Show description for selected policy */}
          <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border max-w-xl">
            {RESCHEDULE_OPTIONS.filter((opt) => opt.value === reschedulePolicy).map(
              (opt) => {
                const Icon = opt.icon;
                return (
                  <div key={opt.value} className="flex items-start gap-2.5">
                    <Icon className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Self-Pay Payment Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-5 text-emerald-600" />
            Self-Pay Payment Type
          </CardTitle>
          <CardDescription>
            Choose the payment collection method for each service when patients pay out of pocket.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Stethoscope className="size-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                No services assigned to providers yet. Go to Services &amp; Insurance to assign services first.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {data.services.map((svc) => (
                <div
                  key={svc.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border hover:border-emerald-200 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {svc.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {svc.durationMinutes} min
                      </span>
                      {svc.selfPayPriceCents > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {centsToDollars(svc.selfPayPriceCents)}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        via {svc.providers.map((p) => `${p.firstName} ${p.lastName}`).join(", ")}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Select
                      value={paymentTypes[svc.id] || svc.selfPayPaymentType}
                      onValueChange={(value) => handlePaymentTypeChange(svc.id, value)}
                    >
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL_UPFRONT">Full Upfront</SelectItem>
                        <SelectItem value="STANDARD_DEPOSIT">Standard Deposit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save All Button */}
      <div className="flex justify-end pt-2 pb-4">
        <Button
          onClick={handleSaveAll}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
          size="lg"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save All Changes"
          )}
        </Button>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  DollarSign,
  Lock,
  CreditCard,
  Star,
  CalendarDays,
  Clock,
  Coins,
  Loader2,
  AlertTriangle,
  Info,
  Save,
  RotateCcw,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// ---- Types ----
interface SystemConfig {
  id: string;
  minDepositCents: number;
  maxDepositCents: number;
  lockTtlSeconds: number;
  slotGenerationWindowDays: number;
  waitlistProcessingDelayMin: number;
  zeroDepositRequireCard: boolean;
  reviewEmailTriggerHours: number;
  platformFeeCents: number;
  updatedAt: string;
}

// ---- Helpers ----
function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(dollars: string): number {
  const num = parseFloat(dollars);
  if (isNaN(num) || num < 0) return -1;
  return Math.round(num * 100);
}

function secondsToHumanReadable(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
    return `${hours} hour${hours !== 1 ? "s" : ""} ${remainingMinutes} min`;
  }
  return `${minutes} min ${remainingSeconds}s`;
}

export default function PolicyPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCard, setSavingCard] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state — initialized from config
  const [minDeposit, setMinDeposit] = useState("");
  const [maxDeposit, setMaxDeposit] = useState("");
  const [lockTtl, setLockTtl] = useState("");
  const [zeroDepositRequireCard, setZeroDepositRequireCard] = useState(false);
  const [reviewEmailHours, setReviewEmailHours] = useState("");
  const [slotWindowDays, setSlotWindowDays] = useState("");
  const [waitlistDelayMin, setWaitlistDelayMin] = useState("");
  const [platformFee, setPlatformFee] = useState("");

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/admin/config");
      if (!res.ok) throw new Error("Failed to fetch config");
      const data: SystemConfig = await res.json();
      setConfig(data);

      // Initialize form fields
      setMinDeposit(centsToDollars(data.minDepositCents));
      setMaxDeposit(centsToDollars(data.maxDepositCents));
      setLockTtl(String(data.lockTtlSeconds));
      setZeroDepositRequireCard(data.zeroDepositRequireCard);
      setReviewEmailHours(String(data.reviewEmailTriggerHours));
      setSlotWindowDays(String(data.slotGenerationWindowDays));
      setWaitlistDelayMin(String(data.waitlistProcessingDelayMin));
      setPlatformFee(centsToDollars(data.platformFeeCents));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load system configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ---- Validation ----
  const validateCard = (cardId: string): boolean => {
    const newErrors: Record<string, string> = {};

    if (cardId === "deposit") {
      const minCents = dollarsToCents(minDeposit);
      const maxCents = dollarsToCents(maxDeposit);
      if (minCents < 0) newErrors.minDeposit = "Enter a valid amount";
      if (maxCents < 0) newErrors.maxDeposit = "Enter a valid amount";
      if (minCents >= 0 && maxCents >= 0 && minCents > maxCents) {
        newErrors.maxDeposit = "Max deposit must be greater than or equal to min deposit";
      }
    }

    if (cardId === "lockTtl") {
      const val = parseInt(lockTtl, 10);
      if (isNaN(val) || val < 1) newErrors.lockTtl = "Must be at least 1 second";
    }

    if (cardId === "reviewEmail") {
      const val = parseInt(reviewEmailHours, 10);
      if (isNaN(val) || val < 1) newErrors.reviewEmail = "Must be at least 1 hour";
    }

    if (cardId === "slotWindow") {
      const val = parseInt(slotWindowDays, 10);
      if (isNaN(val) || val < 1) newErrors.slotWindow = "Must be at least 1 day";
    }

    if (cardId === "waitlist") {
      const val = parseInt(waitlistDelayMin, 10);
      if (isNaN(val) || val < 0) newErrors.waitlist = "Must be a non-negative number";
    }

    if (cardId === "platformFee") {
      const val = dollarsToCents(platformFee);
      if (val < 0) newErrors.platformFee = "Enter a valid amount";
    }

    setErrors((prev) => {
      const cleaned = { ...prev };
      for (const key of Object.keys(newErrors)) {
        cleaned[key] = newErrors[key];
      }
      // Clear old errors for this card
      const cardKeys: Record<string, string[]> = {
        deposit: ["minDeposit", "maxDeposit"],
        lockTtl: ["lockTtl"],
        reviewEmail: ["reviewEmail"],
        slotWindow: ["slotWindow"],
        waitlist: ["waitlist"],
        platformFee: ["platformFee"],
      };
      for (const k of cardKeys[cardId] || []) {
        if (!(k in newErrors)) delete cleaned[k];
      }
      return cleaned;
    });

    return Object.keys(newErrors).length === 0;
  };

  // ---- Save handlers ----
  const saveCard = async (cardId: string, payload: Record<string, unknown>) => {
    setSavingCard(cardId);
    try {
      const res = await fetch("/api/staff/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      const updated: SystemConfig = await res.json();
      setConfig(updated);
      toast.success("Configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingCard(null);
    }
  };

  const handleSaveDeposit = () => {
    if (!validateCard("deposit")) return;
    saveCard("deposit", {
      minDepositCents: dollarsToCents(minDeposit),
      maxDepositCents: dollarsToCents(maxDeposit),
    });
  };

  const handleSaveLockTtl = () => {
    if (!validateCard("lockTtl")) return;
    saveCard("lockTtl", { lockTtlSeconds: parseInt(lockTtl, 10) });
  };

  const handleSaveZeroDeposit = () => {
    saveCard("zeroDeposit", { zeroDepositRequireCard });
  };

  const handleSaveReviewEmail = () => {
    if (!validateCard("reviewEmail")) return;
    saveCard("reviewEmail", { reviewEmailTriggerHours: parseInt(reviewEmailHours, 10) });
  };

  const handleSaveSlotWindow = () => {
    if (!validateCard("slotWindow")) return;
    saveCard("slotWindow", { slotGenerationWindowDays: parseInt(slotWindowDays, 10) });
  };

  const handleSaveWaitlist = () => {
    if (!validateCard("waitlist")) return;
    saveCard("waitlist", { waitlistProcessingDelayMin: parseInt(waitlistDelayMin, 10) });
  };

  const handleSavePlatformFee = () => {
    if (!validateCard("platformFee")) return;
    saveCard("platformFee", { platformFeeCents: dollarsToCents(platformFee) });
  };

  const handleSaveAll = async () => {
    const cards = ["deposit", "lockTtl", "reviewEmail", "slotWindow", "waitlist", "platformFee"] as const;
    const allValid = cards.every((c) => validateCard(c));
    if (!allValid) {
      toast.error("Please fix the validation errors before saving");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        minDepositCents: dollarsToCents(minDeposit),
        maxDepositCents: dollarsToCents(maxDeposit),
        lockTtlSeconds: parseInt(lockTtl, 10),
        zeroDepositRequireCard,
        reviewEmailTriggerHours: parseInt(reviewEmailHours, 10),
        slotGenerationWindowDays: parseInt(slotWindowDays, 10),
        waitlistProcessingDelayMin: parseInt(waitlistDelayMin, 10),
        platformFeeCents: dollarsToCents(platformFee),
      };

      const res = await fetch("/api/staff/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      const updated: SystemConfig = await res.json();
      setConfig(updated);
      toast.success("All policy settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // ---- Reset single card to saved values ----
  const resetCard = (cardId: string) => {
    if (!config) return;
    switch (cardId) {
      case "deposit":
        setMinDeposit(centsToDollars(config.minDepositCents));
        setMaxDeposit(centsToDollars(config.maxDepositCents));
        break;
      case "lockTtl":
        setLockTtl(String(config.lockTtlSeconds));
        break;
      case "reviewEmail":
        setReviewEmailHours(String(config.reviewEmailTriggerHours));
        break;
      case "slotWindow":
        setSlotWindowDays(String(config.slotGenerationWindowDays));
        break;
      case "waitlist":
        setWaitlistDelayMin(String(config.waitlistProcessingDelayMin));
        break;
      case "platformFee":
        setPlatformFee(centsToDollars(config.platformFeeCents));
        break;
    }
    setErrors((prev) => {
      const cleaned = { ...prev };
      const cardKeys: Record<string, string[]> = {
        deposit: ["minDeposit", "maxDeposit"],
        lockTtl: ["lockTtl"],
        reviewEmail: ["reviewEmail"],
        slotWindow: ["slotWindow"],
        waitlist: ["waitlist"],
        platformFee: ["platformFee"],
      };
      for (const k of cardKeys[cardId] || []) {
        delete cleaned[k];
      }
      return cleaned;
    });
  };

  const isSavingCard = (cardId: string) => savingCard === cardId;
  const isSavingAny = (cardIds: string[]) => cardIds.includes(savingCard || "");

  // ---- Loading state ----
  if (loading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-52 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card 1: Deposit Boundaries (C1) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="size-5 text-purple-600" />
            Deposit Boundaries
          </CardTitle>
          <CardDescription>
            Define the minimum and maximum deposit amounts clinics can set. Values are in cents internally and displayed as dollars.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Min Deposit */}
            <div>
              <Label htmlFor="minDeposit">Min Deposit</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="minDeposit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minDeposit}
                  onChange={(e) => {
                    setMinDeposit(e.target.value);
                    if (errors.minDeposit) setErrors((p) => ({ ...p, minDeposit: "" }));
                  }}
                  className={`pl-7 ${errors.minDeposit ? "border-destructive" : ""}`}
                />
              </div>
              {errors.minDeposit && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  {errors.minDeposit}
                </p>
              )}
            </div>

            {/* Max Deposit */}
            <div>
              <Label htmlFor="maxDeposit">Max Deposit</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="maxDeposit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maxDeposit}
                  onChange={(e) => {
                    setMaxDeposit(e.target.value);
                    if (errors.maxDeposit) setErrors((p) => ({ ...p, maxDeposit: "" }));
                  }}
                  className={`pl-7 ${errors.maxDeposit ? "border-destructive" : ""}`}
                />
              </div>
              {errors.maxDeposit && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  {errors.maxDeposit}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => resetCard("deposit")} disabled={isSavingCard("deposit")}>
              <RotateCcw className="size-3.5 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSaveDeposit}
              disabled={isSavingCard("deposit")}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSavingCard("deposit") ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Lock TTL Configuration (C2) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-5 text-purple-600" />
            Lock TTL Configuration
          </CardTitle>
          <CardDescription>
            How long a slot lock is held before expiring. During this time, the slot is unavailable to other patients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label htmlFor="lockTtl">Lock TTL</Label>
            <div className="relative mt-1.5">
              <Input
                id="lockTtl"
                type="number"
                min="1"
                step="1"
                value={lockTtl}
                onChange={(e) => {
                  setLockTtl(e.target.value);
                  if (errors.lockTtl) setErrors((p) => ({ ...p, lockTtl: "" }));
                }}
                className={`pr-16 ${errors.lockTtl ? "border-destructive" : ""}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                seconds
              </span>
            </div>
            {errors.lockTtl && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {errors.lockTtl}
              </p>
            )}
          </div>
          {/* Human-readable preview */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" />
            <span>
              Preview:{" "}
              <span className="font-medium text-foreground">
                {secondsToHumanReadable(parseInt(lockTtl, 10) || 0)}
              </span>
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => resetCard("lockTtl")} disabled={isSavingCard("lockTtl")}>
              <RotateCcw className="size-3.5 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSaveLockTtl}
              disabled={isSavingCard("lockTtl")}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSavingCard("lockTtl") ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: $0 Deposit Behavior (C3) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-5 text-purple-600" />
            $0 Deposit Behavior
          </CardTitle>
          <CardDescription>
            Control whether patients booking $0 deposit appointments must still provide a card on file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 max-w-lg">
            <div className="space-y-0.5">
              <Label htmlFor="zeroDepositRequireCard" className="text-sm font-medium">
                Require card on file for $0 deposits
              </Label>
              <p className="text-xs text-muted-foreground">
                {zeroDepositRequireCard
                  ? "$0 deposits still require a card for no-show penalties"
                  : "$0 deposits skip the checkout screen entirely"}
              </p>
            </div>
            <Switch
              id="zeroDepositRequireCard"
              checked={zeroDepositRequireCard}
              onCheckedChange={setZeroDepositRequireCard}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setZeroDepositRequireCard(config.zeroDepositRequireCard)} disabled={isSavingCard("zeroDeposit")}>
              <RotateCcw className="size-3.5 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSaveZeroDeposit}
              disabled={isSavingCard("zeroDeposit")}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSavingCard("zeroDeposit") ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Review System Control (C4) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="size-5 text-purple-600" />
            Review System Control
          </CardTitle>
          <CardDescription>
            Hours after appointment completion to send the &quot;Rate Your Visit&quot; email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label htmlFor="reviewEmailHours">Review Email Trigger</Label>
            <div className="relative mt-1.5">
              <Input
                id="reviewEmailHours"
                type="number"
                min="1"
                step="1"
                value={reviewEmailHours}
                onChange={(e) => {
                  setReviewEmailHours(e.target.value);
                  if (errors.reviewEmail) setErrors((p) => ({ ...p, reviewEmail: "" }));
                }}
                className={`pr-16 ${errors.reviewEmail ? "border-destructive" : ""}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                hours
              </span>
            </div>
            {errors.reviewEmail && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {errors.reviewEmail}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            The review email is sent this many hours after the appointment status changes to COMPLETED.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => resetCard("reviewEmail")} disabled={isSavingCard("reviewEmail")}>
              <RotateCcw className="size-3.5 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSaveReviewEmail}
              disabled={isSavingCard("reviewEmail")}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSavingCard("reviewEmail") ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 5: Slot Generation Window */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-5 text-purple-600" />
            Slot Generation Window
          </CardTitle>
          <CardDescription>
            How many days into the future slot generation creates available time slots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label htmlFor="slotWindowDays">Slot Generation Window</Label>
            <div className="relative mt-1.5">
              <Input
                id="slotWindowDays"
                type="number"
                min="1"
                step="1"
                value={slotWindowDays}
                onChange={(e) => {
                  setSlotWindowDays(e.target.value);
                  if (errors.slotWindow) setErrors((p) => ({ ...p, slotWindow: "" }));
                }}
                className={`pr-12 ${errors.slotWindow ? "border-destructive" : ""}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                days
              </span>
            </div>
            {errors.slotWindow && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {errors.slotWindow}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => resetCard("slotWindow")} disabled={isSavingCard("slotWindow")}>
              <RotateCcw className="size-3.5 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSlotWindow}
              disabled={isSavingCard("slotWindow")}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSavingCard("slotWindow") ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 6: Waitlist Processing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-5 text-purple-600" />
            Waitlist Processing
          </CardTitle>
          <CardDescription>
            Delay before processing the waitlist after a cancellation occurs. Gives the cancelling patient time to reschedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label htmlFor="waitlistDelayMin">Waitlist Processing Delay</Label>
            <div className="relative mt-1.5">
              <Input
                id="waitlistDelayMin"
                type="number"
                min="0"
                step="1"
                value={waitlistDelayMin}
                onChange={(e) => {
                  setWaitlistDelayMin(e.target.value);
                  if (errors.waitlist) setErrors((p) => ({ ...p, waitlist: "" }));
                }}
                className={`pr-14 ${errors.waitlist ? "border-destructive" : ""}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                minutes
              </span>
            </div>
            {errors.waitlist && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {errors.waitlist}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => resetCard("waitlist")} disabled={isSavingCard("waitlist")}>
              <RotateCcw className="size-3.5 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSaveWaitlist}
              disabled={isSavingCard("waitlist")}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSavingCard("waitlist") ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 7: Platform Fee */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="size-5 text-purple-600" />
            Platform Fee
          </CardTitle>
          <CardDescription>
            The platform fee charged per transaction. Stored in cents internally and displayed as dollars.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Label htmlFor="platformFee">Platform Fee</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="platformFee"
                type="number"
                min="0"
                step="0.01"
                value={platformFee}
                onChange={(e) => {
                  setPlatformFee(e.target.value);
                  if (errors.platformFee) setErrors((p) => ({ ...p, platformFee: "" }));
                }}
                className={`pl-7 ${errors.platformFee ? "border-destructive" : ""}`}
              />
            </div>
            {errors.platformFee && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {errors.platformFee}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => resetCard("platformFee")} disabled={isSavingCard("platformFee")}>
              <RotateCcw className="size-3.5 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSavePlatformFee}
              disabled={isSavingCard("platformFee")}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSavingCard("platformFee") ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save All */}
      <Separator />
      <div className="flex items-center justify-between pb-4">
        <p className="text-sm text-muted-foreground">
          Last updated: {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : "N/A"}
        </p>
        <Button
          onClick={handleSaveAll}
          disabled={saving || isSavingAny(["deposit", "lockTtl", "zeroDeposit", "reviewEmail", "slotWindow", "waitlist", "platformFee"])}
          className="bg-purple-600 hover:bg-purple-700 text-white px-8"
          size="lg"
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving All...
            </>
          ) : (
            <>
              <Save className="size-4 mr-2" />
              Save All Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
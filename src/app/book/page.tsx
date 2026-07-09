"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Calendar,
  Clock,
  User,
  Baby,
  Shield,
  Copy,
  ExternalLink,
  Search,
  MapPin,
  Building2,
  Eye,
  EyeOff,
  CreditCard,
  Mail,
  FileText,
  Timer,
  DollarSign,
  RefreshCw,
  Stethoscope,
  Video,
  MonitorCheck,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { PATIENT_TYPE, SLOT_MODALITY } from "@/lib/enums";
import { PublicNavbar } from "@/components/public-navbar";

// =============================================================================
// Types
// =============================================================================

interface Insurance {
  id: string;
  name: string;
  slug: string;
  isDemo: boolean;
}

interface Service {
  id: string;
  name: string;
}

interface SlotData {
  slot: {
    id: string;
    startTime: string;
    endTime: string;
    modality: string;
    status: string;
  };
  provider: {
    id: string;
    firstName: string;
    lastName: string;
    credentials: string | null;
    slug: string;
    clinicId: string;
  };
  clinic: {
    id: string;
    name: string;
    slug: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    phoneNumber: string;
    selfPayFlatRateCents: number | null;
    inPersonDepositCents: number | null;
    videoDepositCents: number | null;
  };
  specialty: { id: string; name: string } | null;
  serviceId: string | null;
  services: Service[];
}

// =============================================================================
// Helpers
// =============================================================================

function formatSlotTime(startTime: string): string {
  return format(new Date(startTime), "EEEE, MMMM d, yyyy · h:mm a");
}

function formatSlotDate(startTime: string): string {
  return format(new Date(startTime), "MMMM d, yyyy");
}

function formatSlotTimeOnly(startTime: string): string {
  return format(new Date(startTime), "h:mm a");
}

function ModalityBadge({ modality }: { modality: string }) {
  const isVideo = modality === SLOT_MODALITY.VIDEO;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isVideo
          ? "bg-blue-100 text-blue-700"
          : "bg-brand-subtle text-brand-hover"
      }`}
    >
      {isVideo ? <Video className="size-3" /> : <Building2 className="size-3" />}
      {isVideo ? "Video" : "In-Clinic"}
    </span>
  );
}

function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return name;
  return parts
    .map((part) => {
      if (part.length <= 2) return part[0] + "**";
      return part[0] + "*".repeat(part.length - 2) + part[part.length - 1];
    })
    .join(" ");
}

function formatCents(cents: number | null): string {
  if (cents == null || cents === 0) return "No payment required";
  return `$${(cents / 100).toFixed(2)}`;
}

function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

// =============================================================================
// Slot Summary Card (visible on ALL steps)
// =============================================================================

function SlotSummaryCard({ slotData }: { slotData: SlotData }) {
  const providerName = slotData.provider.credentials
    ? `Dr. ${slotData.provider.firstName} ${slotData.provider.lastName}, ${slotData.provider.credentials}`
    : `Dr. ${slotData.provider.firstName} ${slotData.provider.lastName}`;

  const address = [
    slotData.clinic.streetAddress,
    slotData.clinic.city,
    slotData.clinic.state,
    slotData.clinic.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card className="border-l-4 border-l-brand shadow-sm bg-white">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            {/* Provider */}
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0">
                <Stethoscope className="size-4 text-brand-hover" />
              </div>
              <p className="text-sm font-semibold text-foreground truncate">{providerName}</p>
            </div>
            {/* Clinic */}
            <div className="flex items-center gap-2 pl-10">
              <Building2 className="size-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground truncate">{slotData.clinic.name}</p>
            </div>
            {/* Address */}
            <div className="flex items-center gap-2 pl-10">
              <MapPin className="size-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground truncate">{address}</p>
            </div>
          </div>
          <div className="space-y-1.5 sm:text-right shrink-0 sm:pl-4">
            {/* Date */}
            <div className="flex items-center gap-2 sm:justify-end">
              <Calendar className="size-3.5 text-brand shrink-0" />
              <p className="text-xs font-medium text-foreground">{formatSlotDate(slotData.slot.startTime)}</p>
            </div>
            {/* Time */}
            <div className="flex items-center gap-2 sm:justify-end">
              <Clock className="size-3.5 text-brand shrink-0" />
              <p className="text-xs font-medium text-foreground">{formatSlotTimeOnly(slotData.slot.startTime)}</p>
            </div>
            {/* Modality */}
            <div className="flex sm:justify-end mt-0.5">
              <ModalityBadge modality={slotData.slot.modality} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Progress Indicator
// =============================================================================

const STEP_LABELS = [
  { title: "Visit Details", desc: "Reason & insurance" },
  { title: "Your Info", desc: "Contact details" },
  { title: "Review", desc: "Confirm booking" },
  { title: "Done", desc: "All set!" },
];

function ProgressIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      {/* Background track */}
      <div className="absolute left-0 right-0 top-[calc(50%-1px)] mx-auto max-w-2xl hidden sm:block">
        <div className="h-0.5 bg-gray-200 w-full rounded-full" />
        <div
          className="h-0.5 bg-brand rounded-full transition-all duration-500 ease-out"
          key={`progress-${currentStep}`}
          style={{
            width: `${((Math.min(currentStep, 3)) / 3) * 100}%`,
            marginLeft: `${(1 / (STEP_LABELS.length * 2)) * 100}%`,
            marginRight: `${(1 / (STEP_LABELS.length * 2)) * 100}%`,
            animation: 'progress-fill 0.5s ease-out',
          }}
        />
      </div>

      <div className="flex items-center justify-between relative">
        {STEP_LABELS.map((stepInfo, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const isFuture = stepNum > currentStep;

          return (
            <div key={stepNum} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5 relative z-10">
                <div className="relative">
                  {isActive && (
                    <div className="absolute inset-0 size-10 rounded-full bg-brand-subtle/60 animate-ping" style={{ animationDuration: "2s" }} />
                  )}
                  <div
                    className={`relative flex items-center justify-center size-9 rounded-full text-sm font-semibold transition-all duration-300 ${
                      isCompleted
                        ? "bg-brand text-white shadow-md"
                        : isActive
                        ? "bg-brand text-white ring-4 ring-brand/10 shadow-lg"
                        : "bg-gray-100 text-gray-400 border border-gray-200"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="size-4" />
                    ) : (
                      stepNum
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <span
                    className={`block text-[11px] sm:text-xs leading-tight max-w-[72px] flex items-center gap-1 ${
                      isActive
                        ? "text-brand-hover font-semibold"
                        : isCompleted
                        ? "text-brand font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {stepInfo.title}
                    {isActive && (
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-muted" />
                      </span>
                    )}
                  </span>
                  <span
                    className={`block text-[10px] leading-tight max-w-[72px] mt-0.5 ${
                      isActive
                        ? "text-brand"
                        : "text-muted-foreground/60"
                    }`}
                  >
                    {stepInfo.desc}
                  </span>
                </div>
              </div>

              {/* Connector line for mobile (fallback, hidden on sm+) */}
              {idx < STEP_LABELS.length - 1 && (
                <div className="flex-1 mx-2 mt-[-20px] sm:hidden">
                  <div
                    className={`h-0.5 rounded-full transition-colors duration-300 ${
                      stepNum < currentStep
                        ? "bg-brand"
                        : "bg-gray-200"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Confetti Keyframes (CSS)
// =============================================================================

function ConfettiStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes checkmark-draw {
        0% { stroke-dashoffset: 48; }
        100% { stroke-dashoffset: 0; }
      }
      @keyframes checkmark-circle-scale {
        0% { transform: scale(0); opacity: 0; }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
        100% { transform: translateY(-120px) rotate(360deg) scale(0); opacity: 0; }
      }
      .confetti-dot {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        animation: confetti-fall 1.5s ease-out forwards;
      }
      .checkmark-svg .checkmark-path {
        stroke-dasharray: 48;
        stroke-dashoffset: 48;
        animation: checkmark-draw 0.5s ease-out 0.3s forwards;
      }
      .checkmark-circle-anim {
        animation: checkmark-circle-scale 0.4s ease-out forwards;
      }
    ` }} />
  );
}

// =============================================================================
// Booking Wizard Page
// =============================================================================

export default function BookingPage() {
  const searchParams = useSearchParams();
  const providerId = searchParams.get("providerId") ?? "";
  const slotId = searchParams.get("slotId") ?? "";
  const urlSpecialtyId = searchParams.get("specialtyId") ?? "";

  // ---- Core State ----
  const [step, setStep] = useState(1);
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Taxonomies State ----
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [selectedInsuranceId, setSelectedInsuranceId] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  // ---- Step 1 State ----
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [patientType, setPatientType] = useState<"ADULT" | "PEDIATRIC">(
    (searchParams.get("patientType") as "ADULT" | "PEDIATRIC") || "ADULT"
  );
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelation, setGuardianRelation] = useState("");
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [showGuardian, setShowGuardian] = useState(false);

  // ---- Step 2 State ----
  const [patientName, setPatientName] = useState("");
  const [patientDob, setPatientDob] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");

  // ---- Step 3 State ----
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const lockKeyRef = useRef<string>(crypto.randomUUID());

  // ---- Step 4 State ----
  const [appointmentResult, setAppointmentResult] = useState<{
    id: string;
    startTime: string;
    patientName: string;
    clinicName: string;
    providerName: string;
    providerCredentials?: string;
  } | null>(null);
  const [rawToken, setRawToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  // ---- Derived values ----
  const specialtyId = useMemo(() => {
    if (urlSpecialtyId) return urlSpecialtyId;
    return slotData?.specialty?.id ?? "";
  }, [urlSpecialtyId, slotData]);

  const serviceId = useMemo(() => {
    if (selectedServiceId) return selectedServiceId;
    return slotData?.serviceId ?? "";
  }, [selectedServiceId, slotData]);

  const selectedInsurance = useMemo(() => {
    return insurances.find((i) => i.id === selectedInsuranceId) ?? null;
  }, [insurances, selectedInsuranceId]);

  const isDemoInsurance = selectedInsurance?.isDemo ?? false;
  const isUninsured = selectedInsurance?.slug === "uninsured" || !selectedInsuranceId;

  const depositCents = useMemo(() => {
    if (!slotData) return 0;
    if (isDemoInsurance) return 0;
    if (isUninsured) {
      return slotData.slot.modality === SLOT_MODALITY.VIDEO
        ? (slotData.clinic.videoDepositCents ?? 0)
        : (slotData.clinic.inPersonDepositCents ?? 0);
    }
    return 0;
  }, [slotData, isDemoInsurance, isUninsured]);

  const selfPayCents = useMemo(() => {
    if (!slotData) return 0;
    if (isUninsured) return slotData.clinic.selfPayFlatRateCents ?? 0;
    return 0;
  }, [slotData, isUninsured]);

  const costLabel = useMemo(() => {
    if (isDemoInsurance) return "$25 Copay";
    if (isUninsured) return formatCents(selfPayCents).replace("No payment required", "Self-Pay rates apply");
    return "Covered by insurance";
  }, [isDemoInsurance, isUninsured, selfPayCents]);

  const depositLabel = useMemo(() => {
    if (isDemoInsurance) return "$0 deposit (Demo)";
    if (depositCents > 0) return `${formatCents(depositCents)} deposit required`;
    return "No deposit required";
  }, [isDemoInsurance, depositCents]);

  const paymentMethod = useMemo(() => {
    if (isDemoInsurance) return "MANUAL_WAIVER" as const;
    return "CASH_AT_DESK" as const;
  }, [isDemoInsurance]);

  const depositDisplay = useMemo(() => formatCents(depositCents), [depositCents]);

  const serviceName = useMemo(() => {
    if (!slotData?.services?.length) return "";
    const svc = slotData.services.find((s) => s.id === serviceId);
    return svc?.name ?? slotData.services[0]?.name ?? "";
  }, [slotData, serviceId]);

  // ---- Fetch slot data & taxonomies on mount ----
  useEffect(() => {
    if (!slotId) {
      setError("No slot ID provided. Please select a time slot from the search page.");
      setLoading(false);
      return;
    }

    async function fetchSlot() {
      try {
        const res = await fetch(`/api/slots/${slotId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to load slot (${res.status})`);
        }
        const data: SlotData = await res.json();
        setSlotData(data);
        // Set default service
        if (data.serviceId) {
          setSelectedServiceId(data.serviceId);
        } else if (data.services?.[0]?.id) {
          setSelectedServiceId(data.services[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load appointment details.");
      } finally {
        setLoading(false);
      }
    }

    async function fetchTaxonomies() {
      try {
        const res = await fetch("/api/taxonomies");
        if (res.ok) {
          const data = await res.json();
          setInsurances(data.insurances ?? []);
          // Auto-select demo insurance if available
          const demo = (data.insurances ?? []).find((i: Insurance) => i.isDemo);
          if (demo) {
            setSelectedInsuranceId(demo.id);
          }
        }
      } catch {
        // Non-critical, continue without insurances
      }
    }

    fetchSlot();
    fetchTaxonomies();
  }, [slotId]);

  // ---- Animate guardian fields ----
  useEffect(() => {
    if (patientType === "PEDIATRIC") {
      const timer = setTimeout(() => setShowGuardian(true), 50);
      return () => clearTimeout(timer);
    } else {
      setShowGuardian(false);
    }
  }, [patientType]);

  // ---- Validation helpers ----
  const validateStep1 = useCallback((): boolean => {
    if (!reasonForVisit.trim()) return false;
    if (patientType === "PEDIATRIC") {
      if (!guardianName.trim() || !guardianRelation || !guardianConfirmed) return false;
    }
    return true;
  }, [reasonForVisit, patientType, guardianName, guardianRelation, guardianConfirmed]);

  const validateStep2 = useCallback((): boolean => {
    if (!patientName.trim()) return false;
    if (!patientDob) return false;
    if (!patientPhone.trim()) return false;
    if (!patientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) return false;
    return true;
  }, [patientName, patientDob, patientPhone, patientEmail]);

  // ---- Step navigation ----
  const goNext = () => {
    setStepError(null);
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const goBack = () => {
    setStepError(null);
    if (step > 1 && step < 4) setStep(step - 1);
  };

  // ---- Release lock helper ----
  const releaseLock = useCallback(async () => {
    try {
      await fetch(`/api/slots/${slotId}/lock?lockKey=${encodeURIComponent(lockKeyRef.current)}`, {
        method: "DELETE",
      });
    } catch {
      // Silently fail — lock will expire via TTL
    }
  }, [slotId]);

  // ---- Submit appointment ----
  const handleConfirm = useCallback(async () => {
    if (!agreed) {
      setStepError("Please agree to the cancellation policy to proceed.");
      return;
    }
    if (!slotData || !specialtyId || !serviceId) {
      setStepError("Missing required booking data. Please go back and try again.");
      return;
    }

    setIsSubmitting(true);
    setStepError(null);
    const lockKey = lockKeyRef.current;

    try {
      // 1. Lock the slot
      const lockRes = await fetch(`/api/slots/${slotId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockKey }),
      });

      if (!lockRes.ok) {
        const lockBody = await lockRes.json().catch(() => ({}));
        if (lockRes.status === 409 && lockBody.code === "SLOT_TAKEN") {
          setStepError("This time slot was just booked by someone else.");
          return;
        }
        throw new Error(lockBody.error ?? `Failed to lock slot (${lockRes.status})`);
      }

      // 2. Create appointment
      const appointmentBody = {
        slotId,
        lockKey,
        patientName: patientName.trim(),
        patientDob,
        patientPhone: patientPhone.trim(),
        patientEmail: patientEmail.trim(),
        patientType,
        reasonForVisit: reasonForVisit.trim(),
        specialtyId,
        serviceId,
        guardianName: patientType === "PEDIATRIC" ? guardianName.trim() : undefined,
        guardianRelation: patientType === "PEDIATRIC" ? guardianRelation : undefined,
        paymentMethod,
        depositCents,
        selfPayCents,
        isDemoInsurance,
      };

      const apptRes = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appointmentBody),
      });

      if (!apptRes.ok) {
        const apptBody = await apptRes.json().catch(() => ({}));
        // Release lock on failure
        await releaseLock();

        if (apptRes.status === 409 && apptBody.code === "SLOT_TAKEN") {
          setStepError("This time slot was just booked by someone else.");
          return;
        }
        throw new Error(apptBody.error ?? `Failed to create appointment (${apptRes.status})`);
      }

      const apptData = await apptRes.json();
      setRawToken(apptData.token);
      setAppointmentResult(apptData.appointment);
      setStep(4);
    } catch (err) {
      await releaseLock();
      setStepError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    agreed,
    slotData,
    specialtyId,
    serviceId,
    slotId,
    patientName,
    patientDob,
    patientPhone,
    patientEmail,
    patientType,
    reasonForVisit,
    guardianName,
    guardianRelation,
    paymentMethod,
    depositCents,
    selfPayCents,
    isDemoInsurance,
    releaseLock,
  ]);

  // ---- Copy token ----
  const handleCopyToken = useCallback(async () => {
    const tokenUrl = `${window.location.origin}/manage/${rawToken}`;
    try {
      await navigator.clipboard.writeText(tokenUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = tokenUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [rawToken]);

  // ---- Retry on error ----
  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    if (!slotId) return;

    async function fetchSlot() {
      try {
        const res = await fetch(`/api/slots/${slotId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Failed to load slot (${res.status})`);
        }
        const data: SlotData = await res.json();
        setSlotData(data);
        if (data.serviceId) setSelectedServiceId(data.serviceId);
        else if (data.services?.[0]?.id) setSelectedServiceId(data.services[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load appointment details.");
      } finally {
        setLoading(false);
      }
    }
    fetchSlot();
  }, [slotId]);

  // ---- Provider display name ----
  const providerDisplayName = useMemo(() => {
    if (!slotData) return "";
    const name = `${slotData.provider.firstName} ${slotData.provider.lastName}`;
    return slotData.provider.credentials
      ? `Dr. ${name}, ${slotData.provider.credentials}`
      : `Dr. ${name}`;
  }, [slotData]);

  const clinicAddress = useMemo(() => {
    if (!slotData) return "";
    return [
      slotData.clinic.streetAddress,
      slotData.clinic.city,
      slotData.clinic.state,
      slotData.clinic.zipCode,
    ]
      .filter(Boolean)
      .join(", ");
  }, [slotData]);

  // ===========================================================================
  // Loading State
  // ===========================================================================
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <PublicNavbar showHome />
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-brand" />
            <p className="text-sm text-muted-foreground text-shimmer-loading">Loading appointment details...</p>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // Error State
  // ===========================================================================
  if (error || !slotData) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <PublicNavbar showHome />
        <div className="flex-1 flex items-center justify-center py-20 px-4">
          <Card className="max-w-md w-full border-red-200 bg-red-50/30 shadow-sm">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="size-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="size-6 text-red-600" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Unable to load appointment</p>
                <p className="text-sm text-muted-foreground">{error || "Slot data not found."}</p>
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <RefreshCw className="size-4" />
                  Try Again
                </Button>
                <Button asChild className="bg-brand hover:bg-brand-hover text-white cursor-pointer">
                  <Link href="/">
                    <Search className="size-4" />
                    Back to Search
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // Step 4 — Confirmation (separate layout)
  // ===========================================================================
  if (step === 4 && appointmentResult) {
    const confettiColors = [
      "bg-brand", "bg-brand-muted", "bg-amber-400", "bg-amber-300",
      "bg-brand-subtle", "bg-green-400", "bg-lime-400", "bg-lavender-muted",
    ];

    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <ConfettiStyles />
        <PublicNavbar showHome />

        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Confetti + Success Icon */}
          <div className="relative flex flex-col items-center text-center space-y-5 pt-4">
            {/* Decorative sparkles (CSS-only) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
              <div className="absolute top-20 left-[15%] size-2 rounded-full bg-brand-subtle/40 animate-pulse-subtle" />
              <div className="absolute top-32 right-[20%] size-1.5 rounded-full bg-amber-300/40 animate-pulse-subtle" style={{ animationDelay: '0.5s' }} />
              <div className="absolute top-44 left-[25%] size-1 rounded-full bg-lavender/50 animate-pulse-subtle" style={{ animationDelay: '1s' }} />
              <div className="absolute top-28 right-[30%] size-1.5 rounded-full bg-brand/30 animate-pulse-subtle" style={{ animationDelay: '1.5s' }} />
            </div>

            {/* Confetti dots */}
            <div className="relative size-24 flex items-center justify-center">
              {confettiColors.map((color, i) => {
                const angle = (i / confettiColors.length) * 360;
                const rad = (angle * Math.PI) / 180;
                const x = Math.cos(rad) * 60;
                const y = Math.sin(rad) * 60;
                return (
                  <div
                    key={i}
                    className={`confetti-dot ${color}`}
                    style={{
                      left: `calc(50% + ${x}px - 4px)`,
                      top: `calc(50% + ${y}px - 4px)`,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  />
                );
              })}

              {/* Animated checkmark */}
              <div className="checkmark-circle-anim relative z-10">
                <svg
                  className="checkmark-svg size-20"
                  viewBox="0 0 52 52"
                >
                  <circle
                    cx="26"
                    cy="26"
                    r="25"
                    fill="#059669"
                    stroke="none"
                  />
                  <path
                    className="checkmark-path"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 27l7 7 16-16"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Appointment Confirmed!
              </h1>
              <p className="text-muted-foreground max-w-md text-sm">
                Your appointment has been booked successfully. We&apos;ve sent a confirmation to your email.
              </p>
            </div>
          </div>

          {/* Appointment Details Card */}
          <Card className="shadow-sm border-brand-border">
            <CardContent className="p-5 space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar className="size-4 text-brand-hover" />
                </div>
                <div>
                  <p className="text-sm font-medium">{formatSlotTime(appointmentResult.startTime)}</p>
                  <div className="mt-1">
                    <ModalityBadge modality={slotData.slot.modality} />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                  <User className="size-4 text-brand-hover" />
                </div>
                <div>
                  <p className="text-sm font-medium">{appointmentResult.providerName}</p>
                  {appointmentResult.providerCredentials && (
                    <p className="text-xs text-muted-foreground">{appointmentResult.providerCredentials}</p>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="size-4 text-brand-hover" />
                </div>
                <div>
                  <p className="text-sm font-medium">{appointmentResult.clinicName}</p>
                  <p className="text-xs text-muted-foreground">{clinicAddress}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="size-4 text-brand-hover" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Patient: <span className="font-medium text-foreground">{maskName(appointmentResult.patientName)}</span>
                </p>
              </div>

              {/* Cost summary in confirmation */}
              {selectedInsurance && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                      <CreditCard className="size-4 text-brand-hover" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isDemoInsurance ? "Demo Insurance" : selectedInsurance.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{costLabel}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Token Management */}
          <Card className="border-brand-border bg-brand-muted/40 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Shield className="size-4 text-brand" />
                Manage Your Appointment
              </h3>
              <p className="text-sm text-muted-foreground">
                Save this secure link! You&apos;ll need it to view details, complete intake forms, or make changes.
              </p>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => setShowToken(!showToken)}
                  className="w-full cursor-pointer justify-center"
                >
                  {showToken ? (
                    <>
                      <EyeOff className="size-4" />
                      Hide Token Link
                    </>
                  ) : (
                    <>
                      <Eye className="size-4" />
                      Show Token Link
                    </>
                  )}
                </Button>

                {showToken && rawToken && (
                  <div className="rounded-lg border bg-white p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-xs text-muted-foreground break-all font-mono">
                      {window.location.origin}/manage/{rawToken}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyToken}
                      className="w-full cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="size-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* What's Next */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground px-1">What&apos;s Next?</h3>
            <div className="grid gap-3">
              <Card className="shadow-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0">
                    <Mail className="size-4 text-brand-hover" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Confirmation Email</p>
                    <p className="text-xs text-muted-foreground mt-0.5">You&apos;ll receive a confirmation email shortly with all the details.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0">
                    <FileText className="size-4 text-brand-hover" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Complete Intake Forms</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Complete your intake forms before the visit to save time.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0">
                    <Timer className="size-4 text-brand-hover" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Arrive Early</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Arrive 15 minutes early for check-in and any paperwork.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Book Another */}
          <div className="flex justify-center pt-2 pb-4">
            <Button asChild className="bg-brand hover:bg-brand-hover text-white cursor-pointer">
              <Link href="/">
                <Search className="size-4" />
                Book Another Appointment
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ===========================================================================
  // Steps 1-3 — Wizard with Progress Bar
  // ===========================================================================
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
      <PublicNavbar showHome />

      {/* ===== Slot Summary Card (visible on all steps) ===== */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-4">
        <SlotSummaryCard slotData={slotData} />
      </div>

      {/* ===== Progress Indicator ===== */}
      <div className="bg-white/80 border-b">
        <ProgressIndicator currentStep={step} />
      </div>

      {/* ===== Step Content ===== */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {/* ---- Step 1: Visit Details ---- */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200" key="step-1" style={{ animation: 'slide-in-right 0.2s ease-out' }}>
            <div>
              <h1 className="text-2xl font-bold text-foreground">What brings you in?</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Tell us about your visit so the provider can prepare.
              </p>
            </div>

            <Card className="shadow-sm input-focus-glow card-glow-brand border-transition">
              <CardContent className="p-5 space-y-5">
                {/* Reason for Visit */}
                <div className="space-y-2">
                  <Label htmlFor="reasonForVisit" className="text-sm font-medium">
                    Reason for Visit <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="reasonForVisit"
                    placeholder="e.g., Annual physical, persistent headache, follow-up for lab results..."
                    value={reasonForVisit}
                    onChange={(e) => setReasonForVisit(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <Separator />

                {/* Patient Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Patient Type <span className="text-destructive">*</span>
                  </Label>
                  <ToggleGroup
                    type="single"
                    value={patientType}
                    onValueChange={(val) => {
                      if (val) setPatientType(val as "ADULT" | "PEDIATRIC");
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <ToggleGroupItem
                      value="ADULT"
                      className="flex-1 gap-1.5 cursor-pointer time-slot-ripple"
                    >
                      <User className="size-3.5" />
                      <span className="text-xs sm:text-sm">Adult</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="PEDIATRIC"
                      className="flex-1 gap-1.5 cursor-pointer time-slot-ripple"
                    >
                      <Baby className="size-3.5" />
                      <span className="text-xs sm:text-sm">Pediatric</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Guardian Fields (Pediatric) — Smooth expand */}
                <div
                  className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
                  style={{
                    maxHeight: showGuardian ? "400px" : "0px",
                    opacity: showGuardian ? 1 : 0,
                  }}
                >
                  <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4 -mt-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                      <Shield className="size-4" />
                      Guardian Information Required
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guardianName" className="text-sm">
                        Guardian Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="guardianName"
                        placeholder="Jane Smith"
                        value={guardianName}
                        onChange={(e) => setGuardianName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="guardianRelation" className="text-sm">
                        Relationship to Patient <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={guardianRelation}
                        onValueChange={setGuardianRelation}
                      >
                        <SelectTrigger id="guardianRelation" className="cursor-pointer">
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mother" className="cursor-pointer">Mother</SelectItem>
                          <SelectItem value="Father" className="cursor-pointer">Father</SelectItem>
                          <SelectItem value="Legal Guardian" className="cursor-pointer">Legal Guardian</SelectItem>
                          <SelectItem value="Other" className="cursor-pointer">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-start gap-2.5 pt-1">
                      <Checkbox
                        id="guardianConfirmed"
                        checked={guardianConfirmed}
                        onCheckedChange={(checked) => setGuardianConfirmed(checked === true)}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor="guardianConfirmed"
                        className="text-sm leading-snug cursor-pointer"
                      >
                        I confirm I have legal authority to consent for this minor&apos;s treatment
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Insurance Selection */}
                <div className="space-y-2">
                  <Label htmlFor="insurance" className="text-sm font-medium">
                    Insurance
                  </Label>
                  <Select
                    value={selectedInsuranceId}
                    onValueChange={setSelectedInsuranceId}
                  >
                    <SelectTrigger id="insurance" className="cursor-pointer">
                      <SelectValue placeholder="Select insurance" />
                    </SelectTrigger>
                    <SelectContent>
                      {insurances.map((ins) => (
                        <SelectItem key={ins.id} value={ins.id} className="cursor-pointer">
                          {ins.name}
                          {ins.isDemo && (
                            <Badge variant="outline" className="ml-2 text-brand border-brand-border text-[10px] px-1.5 py-0">
                              Demo
                            </Badge>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Insurance Badge */}
                  {selectedInsurance && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      {selectedInsurance.isDemo ? (
                        <Badge className="bg-brand-subtle text-brand-hover border-brand-border hover:bg-brand-subtle cursor-default">
                          <CheckCircle2 className="size-3 mr-1" />
                          $0 Copay — Demo Plan
                        </Badge>
                      ) : selectedInsurance.slug === "uninsured" ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 cursor-default">
                          <DollarSign className="size-3 mr-1" />
                          Self-pay rates apply
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="cursor-default">
                          <Shield className="size-3 mr-1" />
                          {selectedInsurance.name}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* Service Selection */}
                {slotData.services && slotData.services.length > 1 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="service" className="text-sm font-medium">
                        Service
                      </Label>
                      <Select
                        value={serviceId}
                        onValueChange={setSelectedServiceId}
                      >
                        <SelectTrigger id="service" className="cursor-pointer">
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {slotData.services.map((svc) => (
                            <SelectItem key={svc.id} value={svc.id} className="cursor-pointer">
                              {svc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Payment Summary Preview */}
            <Card className="shadow-sm border-brand-border bg-brand-muted/30">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold text-brand uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CreditCard className="size-3.5" />
                  Payment Summary
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {slotData.slot.modality === SLOT_MODALITY.VIDEO ? (
                        <Video className="size-3.5" />
                      ) : (
                        <MonitorCheck className="size-3.5" />
                      )}
                      Visit Type
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {slotData.slot.modality === SLOT_MODALITY.VIDEO ? "Video" : "In-Clinic"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="size-3.5" />
                      Insurance
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {isUninsured ? "Self-Pay" : selectedInsurance?.name ?? "None selected"}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estimated Cost</span>
                    <span className={`text-sm font-semibold ${isDemoInsurance ? "text-brand-hover" : isUninsured ? "text-amber-700" : "text-foreground"}`}>
                      {isDemoInsurance ? "Free" : isUninsured ? formatCents(selfPayCents) : costLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Deposit</span>
                    <span className={`text-sm font-semibold ${isDemoInsurance ? "text-brand-hover" : depositCents > 0 ? "text-amber-700" : "text-foreground"}`}>
                      {isDemoInsurance ? "$0 deposit (Demo)" : depositCents > 0 ? `${formatCents(depositCents)} deposit required` : "No deposit required"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ---- Step 2: Your Information ---- */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200" key="step-2" style={{ animation: 'slide-in-right 0.2s ease-out' }}>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Your Information</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                No account needed — we&apos;ll only use this for your appointment.
              </p>
            </div>

            <Card className="shadow-sm input-focus-glow card-glow-brand border-transition">
              <CardContent className="p-5 space-y-4">
                {/* Patient Name */}
                <div className="space-y-2">
                  <Label htmlFor="patientName" className="text-sm font-medium">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="patientName"
                    placeholder="John Doe"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                {/* Date of Birth */}
                <div className="space-y-2">
                  <Label htmlFor="patientDob" className="text-sm font-medium">
                    Date of Birth <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="patientDob"
                    type="date"
                    max={getTodayDateString()}
                    value={patientDob}
                    onChange={(e) => setPatientDob(e.target.value)}
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="patientPhone" className="text-sm font-medium">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="patientPhone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="patientEmail" className="text-sm font-medium">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="patientEmail"
                    type="email"
                    placeholder="you@example.com"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ---- Step 3: Review & Confirm ---- */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200" key="step-3" style={{ animation: 'slide-in-right 0.2s ease-out' }}>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Review & Confirm</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Please review the details below before confirming your appointment.
              </p>
            </div>

            {/* Appointment Summary Card */}
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-3.5">
                {/* Provider */}
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                    <User className="size-4 text-brand-hover" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{providerDisplayName}</p>
                    {slotData.specialty && (
                      <p className="text-xs text-muted-foreground">{slotData.specialty.name}</p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Clinic */}
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                    <Building2 className="size-4 text-brand-hover" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{slotData.clinic.name}</p>
                    <p className="text-xs text-muted-foreground">{clinicAddress}</p>
                  </div>
                </div>

                <Separator />

                {/* Date / Time / Modality */}
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                    <Calendar className="size-4 text-brand-hover" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm">{formatSlotTime(slotData.slot.startTime)}</p>
                    <ModalityBadge modality={slotData.slot.modality} />
                  </div>
                </div>

                <Separator />

                {/* Patient Type */}
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0">
                    {patientType === "PEDIATRIC" ? (
                      <Baby className="size-4 text-brand-hover" />
                    ) : (
                      <User className="size-4 text-brand-hover" />
                    )}
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Patient Type:</span>{" "}
                    <span className="font-medium">
                      {patientType === "PEDIATRIC" ? "Pediatric" : "Adult"}
                    </span>
                  </p>
                </div>

                {/* Guardian info (pediatric) */}
                {patientType === "PEDIATRIC" && (
                  <div className="flex items-center gap-3 pl-11">
                    <Shield className="size-4 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Guardian: <span className="font-medium text-foreground">{guardianName}</span> ({guardianRelation})
                    </p>
                  </div>
                )}

                <Separator />

                {/* Reason */}
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="size-4 text-brand-hover" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Reason:</span>{" "}
                    {reasonForVisit.length > 120
                      ? reasonForVisit.slice(0, 120) + "..."
                      : reasonForVisit}
                  </p>
                </div>

                <Separator />

                {/* Patient Name (masked) */}
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-brand-subtle flex items-center justify-center shrink-0">
                    <Shield className="size-4 text-brand-hover" />
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Patient:</span>{" "}
                    <span className="font-medium">{maskName(patientName)}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Cost Breakdown Card */}
            <Card className="shadow-sm border-brand-border bg-brand-muted/30">
              <CardContent className="p-5 space-y-3">
                <h3 className="text-xs font-semibold text-brand uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="size-3.5" />
                  Cost Breakdown
                </h3>

                <div className="space-y-2.5">
                  {/* Service / Visit Type */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {slotData.slot.modality === SLOT_MODALITY.VIDEO ? (
                        <Video className="size-3.5" />
                      ) : (
                        <MonitorCheck className="size-3.5" />
                      )}
                      {serviceName ? `${serviceName} — ` : ""}{slotData.slot.modality === SLOT_MODALITY.VIDEO ? "Video Visit" : "In-Clinic Visit"}
                    </div>
                    <ModalityBadge modality={slotData.slot.modality} />
                  </div>

                  {/* Insurance / Payment */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="size-3.5" />
                      {isUninsured ? "Self-Pay" : "Insurance"}
                    </div>
                    <span className="text-sm font-medium">
                      {isUninsured ? "Self-Pay rates" : selectedInsurance?.name ?? "None"}
                    </span>
                  </div>

                  {/* Copay / Self-pay rate */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="size-3.5" />
                      {isUninsured ? "Self-Pay Rate" : "Copay"}
                    </div>
                    <span className={`text-sm font-semibold ${isDemoInsurance ? "text-brand-hover" : isUninsured ? "text-amber-700" : "text-foreground"}`}>
                      {isDemoInsurance ? "$25 Copay" : isUninsured ? formatCents(selfPayCents) : "Covered"}
                    </span>
                  </div>

                  <Separator />

                  {/* Deposit */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CreditCard className="size-3.5" />
                      Deposit
                    </div>
                    <span className={`text-sm font-semibold ${isDemoInsurance ? "text-brand-hover" : depositCents > 0 ? "text-amber-700" : "text-foreground"}`}>
                      {isDemoInsurance ? "$0 deposit (Demo)" : depositCents > 0 ? `${formatCents(depositCents)} deposit required` : "No deposit required"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Agreement */}
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="agreement"
                    checked={agreed}
                    onCheckedChange={(checked) => {
                      setAgreed(checked === true);
                      if (stepError) setStepError(null);
                    }}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="agreement"
                    className="text-sm leading-snug cursor-pointer"
                  >
                    I agree to the cancellation policy. Appointments must be
                    cancelled at least 24 hours in advance.
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  By proceeding, you agree to our terms. {depositCents > 0 ? `A ${depositDisplay} deposit may be required.` : "No payment is required for this booking."}
                </p>
              </CardContent>
            </Card>

            {/* Step Error */}
            {stepError && (
              <Card className="border-red-200 bg-red-50/50 shadow-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="size-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <AlertCircle className="size-4 text-red-600" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-red-700 font-medium">{stepError}</p>
                    {stepError.includes("booked by someone else") && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Link href="/">
                          <Search className="size-3.5" />
                          Search for Another Time
                        </Link>
                      </Button>
                    )}
                    {!stepError.includes("booked by someone else") && !stepError.includes("agree to the") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <RefreshCw className="size-3.5" />
                        Try Again
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Confirm Button */}
            <Button
              variant="brand"
              size="cta"
              onClick={handleConfirm}
              disabled={isSubmitting || !agreed}
              className="w-full shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Confirm Appointment
                </>
              )}
            </Button>
          </div>
        )}
      </main>

      {/* ===== Navigation Footer (Steps 1-3 only) ===== */}
      {step >= 1 && step <= 3 && (
        <div className="border-t bg-white/90 backdrop-blur-sm sticky bottom-0 mt-auto">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={step === 1}
              className="cursor-pointer btn-icon-slide-back"
            >
              <ArrowLeft className="size-4 icon-slide-left" />
              Back
            </Button>

            {step < 3 ? (
              <Button
                onClick={goNext}
                disabled={
                  (step === 1 && !validateStep1()) ||
                  (step === 2 && !validateStep2())
                }
                className="bg-brand hover:bg-brand-hover text-white cursor-pointer shadow-sm btn-icon-slide-next"
              >
                Continue
                <ArrowRight className="size-4 icon-slide-right" />
              </Button>
            ) : (
              <div className="w-[88px]" /> // Spacer to balance the back button
            )}
          </div>
        </div>
      )}
    </div>
  );
}
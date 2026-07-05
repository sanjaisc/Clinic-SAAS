"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import {
  CalendarPlus,
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
  Building2,
  Stethoscope,
  FileText,
  CreditCard,
  Phone,
  Mail,
  ChevronRight,
  UserPlus,
  ClipboardList,
  Eye,
  EyeOff,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { PATIENT_TYPE, SLOT_MODALITY } from "@/lib/enums";

// =============================================================================
// Types
// =============================================================================

interface Provider {
  id: string;
  firstName: string;
  lastName: string;
  credentials: string | null;
  slotDurationMinutes: number;
  providerServices: Array<{
    service: { id: string; name: string; specialtyId: string };
  }>;
}

interface Service {
  id: string;
  name: string;
  specialtyId: string;
  durationMinutes: number;
  selfPayPriceCents: number;
}

interface Insurance {
  id: string;
  name: string;
  isDemo: boolean;
}

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  modality: string;
}

interface BookingFormData {
  providerId: string;
  selectedDate: Date | undefined;
  slotId: string;
  patientName: string;
  patientDob: string;
  patientPhone: string;
  patientEmail: string;
  patientType: "ADULT" | "PEDIATRIC";
  guardianName: string;
  guardianRelation: string;
  reasonForVisit: string;
  serviceId: string;
  insuranceId: string;
  internalNotes: string;
}

interface BookingResult {
  appointment: {
    id: string;
    startTime: string;
    endTime: string;
    modality: string;
    status: string;
    patientName: string;
    patientType: string;
    reasonForVisit: string;
    paymentMethod: string;
    paymentStatus: string;
    depositCents: number;
    selfPayCents: number;
    clinicName: string;
    providerName: string;
    providerCredentials?: string;
    serviceName: string;
    specialtyName: string;
  };
  token: string;
}

// =============================================================================
// Step definitions
// =============================================================================

const STEPS = [
  { label: "Provider & Slot", icon: CalendarPlus, description: "Choose time" },
  { label: "Patient Info", icon: User, description: "Patient details" },
  { label: "Visit Details", icon: ClipboardList, description: "Service & reason" },
  { label: "Review", icon: CheckCircle2, description: "Confirm booking" },
  { label: "Confirmed", icon: Check, description: "Booking complete" },
] as const;

// =============================================================================
// Main Component
// =============================================================================

export default function ManualBookPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form data
  const [form, setForm] = useState<BookingFormData>({
    providerId: "",
    selectedDate: undefined,
    slotId: "",
    patientName: "",
    patientDob: "",
    patientPhone: "",
    patientEmail: "",
    patientType: "ADULT",
    guardianName: "",
    guardianRelation: "",
    reasonForVisit: "",
    serviceId: "",
    insuranceId: "",
    internalNotes: "",
  });

  // API data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  // ---- Fetch initial data ----
  useEffect(() => {
    async function fetchData() {
      try {
        setInitialLoading(true);
        const res = await fetch("/api/staff/book");
        if (!res.ok) throw new Error("Failed to load booking data");
        const data = await res.json();
        setProviders(data.providers);
        setServices(data.services);
        setInsurances(data.insurances);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setInitialLoading(false);
      }
    }
    fetchData();
  }, []);

  // ---- Fetch slots when provider + date are selected ----
  const fetchSlots = useCallback(async (providerId: string, date: Date) => {
    try {
      setSlotsLoading(true);
      setError(null);
      const dateStr = format(date, "yyyy-MM-dd");
      const res = await fetch(
        `/api/staff/book?providerId=${providerId}&date=${dateStr}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load slots");
      }
      const data = await res.json();
      setSlots(data.slots);
      setForm((prev) => ({ ...prev, slotId: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load slots");
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // ---- Handlers ----
  const handleProviderSelect = (providerId: string) => {
    setForm((prev) => ({ ...prev, providerId, slotId: "" }));
    setSlots([]);
    if (form.selectedDate) {
      fetchSlots(providerId, form.selectedDate);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setForm((prev) => ({ ...prev, selectedDate: date, slotId: "" }));
    setSlots([]);
    if (date && form.providerId) {
      fetchSlots(form.providerId, date);
    }
  };

  const handleSlotSelect = (slotId: string) => {
    setForm((prev) => ({ ...prev, slotId }));
  };

  const updateField = <K extends keyof BookingFormData>(
    key: K,
    value: BookingFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const formatCents = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // ---- Validation per step ----
  const validateStep = (stepNum: number): boolean => {
    setError(null);
    switch (stepNum) {
      case 1:
        if (!form.providerId) {
          setError("Please select a provider");
          return false;
        }
        if (!form.selectedDate) {
          setError("Please select a date");
          return false;
        }
        if (!form.slotId) {
          setError("Please select a time slot");
          return false;
        }
        return true;
      case 2:
        if (!form.patientName.trim()) {
          setError("Patient name is required");
          return false;
        }
        if (!form.patientDob) {
          setError("Date of birth is required");
          return false;
        }
        if (isNaN(new Date(form.patientDob).getTime())) {
          setError("Please enter a valid date of birth");
          return false;
        }
        if (!form.patientPhone.trim()) {
          setError("Phone number is required");
          return false;
        }
        if (!form.patientEmail.trim()) {
          setError("Email is required");
          return false;
        }
        if (
          form.patientType === "PEDIATRIC" &&
          (!form.guardianName.trim() || !form.guardianRelation.trim())
        ) {
          setError("Guardian name and relationship are required for pediatric patients");
          return false;
        }
        return true;
      case 3:
        if (!form.serviceId) {
          setError("Please select a service");
          return false;
        }
        if (!form.reasonForVisit.trim()) {
          setError("Reason for visit is required");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => prev - 1);
  };

  // ---- Submit booking ----
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        slotId: form.slotId,
        patientName: form.patientName,
        patientDob: form.patientDob,
        patientPhone: form.patientPhone,
        patientEmail: form.patientEmail,
        patientType: form.patientType,
        reasonForVisit: form.reasonForVisit,
        serviceId: form.serviceId,
      };

      if (form.patientType === "PEDIATRIC") {
        body.guardianName = form.guardianName;
        body.guardianRelation = form.guardianRelation;
      }
      if (form.insuranceId) {
        body.insuranceId = form.insuranceId;
      }
      if (form.internalNotes.trim()) {
        body.internalNotes = form.internalNotes;
      }

      const res = await fetch("/api/staff/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Booking failed");
      }

      setBookingResult(data);
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Copy token ----
  const handleCopyToken = async () => {
    if (!bookingResult) return;
    try {
      const manageUrl = `${window.location.origin}/manage/${bookingResult.token}`;
      await navigator.clipboard.writeText(manageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = `${window.location.origin}/manage/${bookingResult.token}`;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ---- Derived data ----
  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === form.providerId),
    [providers, form.providerId]
  );

  const selectedSlot = useMemo(
    () => slots.find((s) => s.id === form.slotId),
    [slots, form.slotId]
  );

  const selectedService = useMemo(
    () => services.find((s) => s.id === form.serviceId),
    [services, form.serviceId]
  );

  const selectedInsurance = useMemo(
    () => insurances.find((i) => i.id === form.insuranceId),
    [insurances, form.insuranceId]
  );

  // ---- Guardian fields animation ----
  const showGuardianFields = form.patientType === "PEDIATRIC";

  // Group slots by modality for display
  const inPersonSlots = slots.filter((s) => s.modality === SLOT_MODALITY.IN_PERSON);
  const videoSlots = slots.filter((s) => s.modality === SLOT_MODALITY.VIDEO);

  // =============================================================================
  // Render: Loading
  // =============================================================================

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 text-emerald-600 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading booking data...</p>
        </div>
      </div>
    );
  }

  // =============================================================================
  // Render: Step Indicator
  // =============================================================================

  function StepIndicator() {
    return (
      <div className="w-full mb-6">
        {/* Track line background */}
        <div className="relative flex items-center justify-between">
          {/* Background track */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted rounded-full" />
          {/* Progress fill */}
          <div
            className="absolute top-4 left-0 h-0.5 bg-emerald-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((Math.min(step, 4) - 1) / 3) * 100}%` }}
          />

          {STEPS.map((s, idx) => {
            const stepNum = idx + 1;
            const isActive = step === stepNum;
            const isComplete = step > stepNum;
            const Icon = s.icon;

            return (
              <div
                key={stepNum}
                className="relative flex flex-col items-center z-10"
              >
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all duration-300",
                    isActive
                      ? "size-9 bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
                      : isComplete
                        ? "size-8 bg-emerald-500 text-white"
                        : "size-8 bg-muted text-muted-foreground"
                  )}
                >
                  {isComplete ? (
                    <Check className="size-4" />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs mt-2 font-medium hidden sm:block",
                    isActive
                      ? "text-emerald-700"
                      : isComplete
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =============================================================================
  // Render: Step 1 — Provider & Slot Selection
  // =============================================================================

  function StepProviderSlot() {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Select Provider</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a provider to see their available time slots
          </p>
        </div>

        {/* Provider grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {providers.map((provider) => {
            const isSelected = form.providerId === provider.id;
            return (
              <button
                key={provider.id}
                onClick={() => handleProviderSelect(provider.id)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer",
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-border hover:border-emerald-200 hover:bg-emerald-50/50"
                )}
              >
                <div
                  className={cn(
                    "size-10 rounded-full flex items-center justify-center shrink-0",
                    isSelected
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-100 text-emerald-700"
                  )}
                >
                  <Stethoscope className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    Dr. {provider.firstName} {provider.lastName}
                    {provider.credentials && (
                      <span className="text-muted-foreground font-normal">
                        , {provider.credentials}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {provider.providerServices.length} service
                    {provider.providerServices.length !== 1 ? "s" : ""} ·{" "}
                    {provider.slotDurationMinutes} min slots
                  </p>
                </div>
                {isSelected && (
                  <Check className="size-5 text-emerald-600 ml-auto shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Date picker */}
        {form.providerId && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
            <Separator />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Select Date
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a date to view available time slots
              </p>
            </div>

            <div className="flex justify-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-auto sm:min-w-[280px] justify-start text-left font-normal cursor-pointer",
                      !form.selectedDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 size-4" />
                    {form.selectedDate
                      ? format(form.selectedDate, "EEEE, MMMM d, yyyy")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <CalendarComponent
                    mode="single"
                    selected={form.selectedDate}
                    onSelect={handleDateSelect}
                    disabled={{ before: new Date() }}
                    defaultMonth={new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Time slots */}
        {form.providerId && form.selectedDate && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
            <Separator />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Available Time Slots
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {format(form.selectedDate, "EEEE, MMMM d, yyyy")}
              </p>
            </div>

            {slotsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 text-emerald-600 animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="flex flex-col items-center py-8 text-center">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Calendar className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    No available slots
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try selecting a different date
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* In-Person slots */}
                {inPersonSlots.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="size-3.5 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700">
                        In-Person
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {inPersonSlots.map((slot) => {
                        const isSelected = form.slotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            onClick={() => handleSlotSelect(slot.id)}
                            className={cn(
                              "flex flex-col items-center gap-0.5 p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer",
                              isSelected
                                ? "border-emerald-500 bg-emerald-50 shadow-sm"
                                : "border-border hover:border-emerald-200 hover:bg-emerald-50/50"
                            )}
                          >
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                isSelected
                                  ? "text-emerald-700"
                                  : "text-foreground"
                              )}
                            >
                              {format(new Date(slot.startTime), "h:mm a")}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(slot.endTime), "h:mm a")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Video slots */}
                {videoSlots.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="size-3.5 text-blue-500" />
                      <span className="text-xs font-medium text-blue-600">
                        Video Visit
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {videoSlots.map((slot) => {
                        const isSelected = form.slotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            onClick={() => handleSlotSelect(slot.id)}
                            className={cn(
                              "flex flex-col items-center gap-0.5 p-3 rounded-xl border-2 transition-all duration-150 cursor-pointer",
                              isSelected
                                ? "border-blue-500 bg-blue-50 shadow-sm"
                                : "border-border hover:border-blue-200 hover:bg-blue-50/50"
                            )}
                          >
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                isSelected
                                  ? "text-blue-700"
                                  : "text-foreground"
                              )}
                            >
                              {format(new Date(slot.startTime), "h:mm a")}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(slot.endTime), "h:mm a")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =============================================================================
  // Render: Step 2 — Patient Details
  // =============================================================================

  function StepPatientDetails() {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Patient Information</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the patient&apos;s details for the phone booking
          </p>
        </div>

        {/* Selected slot summary */}
        {selectedSlot && selectedProvider && (
          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Calendar className="size-4 text-emerald-700" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  Dr. {selectedProvider.firstName} {selectedProvider.lastName}
                  {selectedProvider.credentials &&
                    `, ${selectedProvider.credentials}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(selectedSlot.startTime), "EEE, MMM d · h:mm a")}{" "}
                  – {format(new Date(selectedSlot.endTime), "h:mm a")}
                  {selectedSlot.modality === "IN_PERSON" ? " · In-Person" : " · Video"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Patient type toggle */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Patient Type</Label>
          <ToggleGroup
            type="single"
            value={form.patientType}
            onValueChange={(val) => {
              if (val) updateField("patientType", val as "ADULT" | "PEDIATRIC");
            }}
            className="justify-start"
          >
            <ToggleGroupItem
              value="ADULT"
              className="flex items-center gap-2 px-4 py-2.5 data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-700 cursor-pointer"
            >
              <User className="size-4" />
              Adult
            </ToggleGroupItem>
            <ToggleGroupItem
              value="PEDIATRIC"
              className="flex items-center gap-2 px-4 py-2.5 data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-700 cursor-pointer"
            >
              <Baby className="size-4" />
              Pediatric
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Patient fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="patientName" className="text-sm font-medium">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="patientName"
              placeholder="John Doe"
              value={form.patientName}
              onChange={(e) => updateField("patientName", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="patientDob" className="text-sm font-medium">
              Date of Birth <span className="text-red-500">*</span>
            </Label>
            <Input
              id="patientDob"
              type="date"
              value={form.patientDob}
              onChange={(e) => updateField("patientDob", e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="patientPhone" className="text-sm font-medium">
              Phone <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="patientPhone"
                type="tel"
                placeholder="(555) 123-4567"
                value={form.patientPhone}
                onChange={(e) => updateField("patientPhone", e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="patientEmail" className="text-sm font-medium">
              Email <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="patientEmail"
                type="email"
                placeholder="patient@email.com"
                value={form.patientEmail}
                onChange={(e) => updateField("patientEmail", e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Guardian fields (smooth expand/collapse) */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: showGuardianFields ? "200px" : "0px",
            opacity: showGuardianFields ? 1 : 0,
          }}
        >
          <Separator className="mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="guardianName" className="text-sm font-medium">
                Guardian Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="guardianName"
                placeholder="Jane Doe"
                value={form.guardianName}
                onChange={(e) => updateField("guardianName", e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardianRelation" className="text-sm font-medium">
                Relationship <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.guardianRelation}
                onValueChange={(val) => updateField("guardianRelation", val)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mother">Mother</SelectItem>
                  <SelectItem value="Father">Father</SelectItem>
                  <SelectItem value="Legal Guardian">Legal Guardian</SelectItem>
                  <SelectItem value="Grandmother">Grandmother</SelectItem>
                  <SelectItem value="Grandfather">Grandfather</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =============================================================================
  // Render: Step 3 — Visit Details
  // =============================================================================

  function StepVisitDetails() {
    // Filter services to those offered by the selected provider
    const providerServices = selectedProvider
      ? selectedProvider.providerServices.map((ps) => ps.service.id)
      : [];

    const availableServices = services.filter((s) =>
      providerServices.includes(s.id)
    );

    // Auto-select service if only one available
    useEffect(() => {
      if (availableServices.length === 1 && form.serviceId !== availableServices[0].id) {
        updateField("serviceId", availableServices[0].id);
      }
    }, [availableServices.length]);

    return (
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Visit Details</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select the service, insurance, and reason for visit
          </p>
        </div>

        {/* Service selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Service <span className="text-red-500">*</span>
          </Label>
          {availableServices.length > 1 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableServices.map((service) => {
                const isSelected = form.serviceId === service.id;
                return (
                  <button
                    key={service.id}
                    onClick={() => updateField("serviceId", service.id)}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer",
                      isSelected
                        ? "border-emerald-500 bg-emerald-50 shadow-sm"
                        : "border-border hover:border-emerald-200 hover:bg-emerald-50/50"
                    )}
                  >
                    <div
                      className={cn(
                        "size-8 rounded-full flex items-center justify-center shrink-0",
                        isSelected
                          ? "bg-emerald-600 text-white"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <ClipboardList className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {service.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {service.durationMinutes} min
                        {service.selfPayPriceCents > 0 &&
                          ` · ${formatCents(service.selfPayPriceCents)}`}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="size-4 text-emerald-600 ml-auto shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : availableServices.length === 1 ? (
            <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <ClipboardList className="size-3.5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {availableServices[0].name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {availableServices[0].durationMinutes} min
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No services available for this provider.
            </p>
          )}

          {/* Auto-select if only one */}
          {availableServices.length === 1 && !form.serviceId && (
            <input type="hidden" value={form.serviceId} readOnly />
          )}
        </div>

        {/* Insurance selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Insurance (optional)</Label>
          <Select
            value={form.insuranceId}
            onValueChange={(val) => updateField("insuranceId", val)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select insurance or leave blank for self-pay" />
            </SelectTrigger>
            <SelectContent>
              {insurances.map((insurance) => (
                <SelectItem key={insurance.id} value={insurance.id}>
                  {insurance.name}
                  {insurance.isDemo && " (Demo)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!form.insuranceId && (
            <p className="text-xs text-muted-foreground">
              No insurance selected — self-pay rates will apply
            </p>
          )}
          {selectedInsurance?.isDemo && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              Demo Plan — $0 Copay
            </Badge>
          )}
        </div>

        {/* Reason for visit */}
        <div className="space-y-2">
          <Label htmlFor="reasonForVisit" className="text-sm font-medium">
            Reason for Visit <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="reasonForVisit"
            placeholder="Briefly describe the reason for the visit..."
            value={form.reasonForVisit}
            onChange={(e) => updateField("reasonForVisit", e.target.value)}
            className="rounded-xl min-h-[100px] resize-none"
          />
        </div>

        {/* Internal notes (staff only) */}
        <div className="space-y-2">
          <Label htmlFor="internalNotes" className="text-sm font-medium">
            Internal Notes{" "}
            <span className="text-muted-foreground font-normal">
              (staff only, not visible to patient)
            </span>
          </Label>
          <Textarea
            id="internalNotes"
            placeholder="Any internal notes about this booking..."
            value={form.internalNotes}
            onChange={(e) => updateField("internalNotes", e.target.value)}
            className="rounded-xl min-h-[80px] resize-none bg-muted/30"
          />
        </div>
      </div>
    );
  }

  // =============================================================================
  // Render: Step 4 — Review
  // =============================================================================

  function StepReview() {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Review Booking Details
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Please verify all information before confirming the booking
          </p>
        </div>

        {/* Provider & Slot */}
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Calendar className="size-4" />
              Appointment
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReviewRow
                icon={<Stethoscope className="size-3.5" />}
                label="Provider"
                value={
                  selectedProvider
                    ? `Dr. ${selectedProvider.firstName} ${selectedProvider.lastName}${selectedProvider.credentials ? `, ${selectedProvider.credentials}` : ""}`
                    : "—"
                }
              />
              <ReviewRow
                icon={<Calendar className="size-3.5" />}
                label="Date & Time"
                value={
                  selectedSlot
                    ? `${format(new Date(selectedSlot.startTime), "EEEE, MMMM d, yyyy")}\n${format(new Date(selectedSlot.startTime), "h:mm a")} – ${format(new Date(selectedSlot.endTime), "h:mm a")}`
                    : "—"
                }
              />
              <ReviewRow
                icon={
                  selectedSlot?.modality === "VIDEO" ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <Building2 className="size-3.5" />
                  )
                }
                label="Modality"
                value={
                  selectedSlot?.modality === "VIDEO" ? "Video Visit" : "In-Person"
                }
              />
              <ReviewRow
                icon={<ClipboardList className="size-3.5" />}
                label="Service"
                value={selectedService?.name || "—"}
              />
            </div>
          </CardContent>
        </Card>

        {/* Patient Info */}
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <User className="size-4" />
              Patient Information
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReviewRow
                icon={<User className="size-3.5" />}
                label="Name"
                value={form.patientName}
              />
              <ReviewRow
                icon={<Calendar className="size-3.5" />}
                label="Date of Birth"
                value={form.patientDob ? format(new Date(form.patientDob), "MMMM d, yyyy") : "—"}
              />
              <ReviewRow
                icon={<Phone className="size-3.5" />}
                label="Phone"
                value={form.patientPhone}
              />
              <ReviewRow
                icon={<Mail className="size-3.5" />}
                label="Email"
                value={form.patientEmail}
              />
              <ReviewRow
                icon={
                  form.patientType === "PEDIATRIC" ? (
                    <Baby className="size-3.5" />
                  ) : (
                    <User className="size-3.5" />
                  )
                }
                label="Patient Type"
                value={
                  form.patientType === "PEDIATRIC" ? "Pediatric" : "Adult"
                }
              />
              {form.patientType === "PEDIATRIC" && (
                <ReviewRow
                  icon={<UserPlus className="size-3.5" />}
                  label="Guardian"
                  value={`${form.guardianName} (${form.guardianRelation})`}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Visit Details */}
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <FileText className="size-4" />
              Visit Details
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReviewRow
                icon={<Shield className="size-3.5" />}
                label="Insurance"
                value={selectedInsurance?.name || "Self-Pay (Uninsured)"}
              />
              <ReviewRow
                icon={<CreditCard className="size-3.5" />}
                label="Payment"
                value="Cash at Desk"
              />
              <ReviewRow
                icon={<FileText className="size-3.5" />}
                label="Reason for Visit"
                value={form.reasonForVisit}
                full
              />
            </div>
            {form.internalNotes.trim() && (
              <>
                <Separator />
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Internal Notes (staff only)
                  </p>
                  <p className="text-sm text-foreground">{form.internalNotes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // =============================================================================
  // Render: Step 5 — Confirmation
  // =============================================================================

  function StepConfirmation() {
    if (!bookingResult) return null;

    const { appointment, token } = bookingResult;
    const manageUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/manage/${token}`;

    return (
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-500 space-y-6">
        {/* Success header */}
        <div className="text-center space-y-3">
          <div className="inline-flex size-16 rounded-full bg-emerald-100 items-center justify-center">
            <CheckCircle2 className="size-8 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Booking Confirmed!
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              The appointment has been successfully created
            </p>
          </div>
        </div>

        {/* Appointment details card */}
        <Card className="shadow-sm rounded-xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Calendar className="size-4" />
              Appointment Details
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReviewRow
                icon={<Stethoscope className="size-3.5" />}
                label="Provider"
                value={`${appointment.providerName}${appointment.providerCredentials ? `, ${appointment.providerCredentials}` : ""}`}
              />
              <ReviewRow
                icon={<Calendar className="size-3.5" />}
                label="Date & Time"
                value={`${format(new Date(appointment.startTime), "EEEE, MMMM d, yyyy")}\n${format(new Date(appointment.startTime), "h:mm a")} – ${format(new Date(appointment.endTime), "h:mm a")}`}
              />
              <ReviewRow
                icon={<User className="size-3.5" />}
                label="Patient"
                value={appointment.patientName}
              />
              <ReviewRow
                icon={<ClipboardList className="size-3.5" />}
                label="Service"
                value={`${appointment.specialtyName} — ${appointment.serviceName}`}
              />
              <ReviewRow
                icon={<CreditCard className="size-3.5" />}
                label="Payment"
                value="Cash at Desk (Pending)"
              />
            </div>
          </CardContent>
        </Card>

        {/* Management link */}
        <Card className="shadow-sm rounded-xl border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Shield className="size-4" />
              Patient Management Link
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with the patient so they can manage their appointment
              online.
            </p>

            {/* Token display */}
            <div className="bg-white rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Management URL
                </span>
                <button
                  onClick={handleCopyToken}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="size-3" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy Link
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted/50 rounded px-2 py-1.5 break-all font-mono">
                  {tokenRevealed ? manageUrl : `${manageUrl.substring(0, 30)}${"*".repeat(20)}`}
                </code>
                <button
                  onClick={() => setTokenRevealed(!tokenRevealed)}
                  className="shrink-0 size-8 rounded-lg border flex items-center justify-center hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  {tokenRevealed ? (
                    <EyeOff className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Eye className="size-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => {
              setBookingResult(null);
              setStep(1);
              setForm({
                providerId: "",
                selectedDate: undefined,
                slotId: "",
                patientName: "",
                patientDob: "",
                patientPhone: "",
                patientEmail: "",
                patientType: "ADULT",
                guardianName: "",
                guardianRelation: "",
                reasonForVisit: "",
                serviceId: "",
                insuranceId: "",
                internalNotes: "",
              });
              setSlots([]);
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 cursor-pointer"
          >
            <CalendarPlus className="size-4 mr-2" />
            Book Another Appointment
          </Button>
        </div>
      </div>
    );
  }

  // =============================================================================
  // Main Render
  // =============================================================================

  return (
    <div className="max-w-3xl mx-auto space-y-2">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center">
          <CalendarPlus className="size-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Manual Booking</h1>
          <p className="text-sm text-muted-foreground">
            Book an appointment on behalf of a patient
          </p>
        </div>
      </div>

      {/* Step indicator (not on confirmation step) */}
      {step < 5 && <StepIndicator />}

      {/* Error banner */}
      {error && (
        <div className="animate-in fade-in duration-200">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50/50">
            <AlertCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
            {step < 5 && (
              <button
                onClick={() => setError(null)}
                className="shrink-0 cursor-pointer p-0.5 rounded hover:bg-red-100 transition-colors"
              >
                <ArrowLeft className="size-4 text-red-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step content */}
      {step === 1 && <StepProviderSlot />}
      {step === 2 && <StepPatientDetails />}
      {step === 3 && <StepVisitDetails />}
      {step === 4 && <StepReview />}
      {step === 5 && <StepConfirmation />}

      {/* Navigation buttons */}
      {step < 5 && (
        <div className="flex items-center justify-between pt-4 border-t mt-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1}
            className="cursor-pointer rounded-xl"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>

          {step < 4 ? (
            <Button
              onClick={handleNext}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-sm cursor-pointer rounded-xl"
            >
              Continue
              <ArrowRight className="size-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200 cursor-pointer rounded-xl"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <Check className="size-4 mr-2" />
                  Confirm Booking
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Helper: Review Row
// =============================================================================

function ReviewRow({
  icon,
  label,
  value,
  full = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="flex items-start gap-2">
        <div className="size-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5 text-emerald-700">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-foreground whitespace-pre-line break-words">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
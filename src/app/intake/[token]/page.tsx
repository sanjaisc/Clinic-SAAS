"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Calendar,
  Clock,
  MapPin,
  User,
  Building2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Heart,
  Shield,
  Stethoscope,
  Pill,
  AlertTriangle,
  History,
  Users,
  Phone,
  StickyNote,
} from "lucide-react";
import Link from "next/link";

// ---- Types ----

interface IntakeData {
  appointment: {
    id: string;
    patientName: string;
    provider: {
      firstName: string;
      lastName: string;
      credentials: string | null;
    };
    clinic: {
      name: string;
      streetAddress: string;
      city: string;
      state: string;
      zipCode: string;
    };
    service: {
      name: string;
    };
    specialty: {
      name: string;
    };
    insurance: {
      name: string;
    } | null;
    startTime: string;
    endTime: string;
    modality: string;
    intakeCompleted: boolean;
  };
  existingIntakeData: Record<string, string> | null;
}

type PageState = "loading" | "valid" | "expired" | "not_found" | "already_submitted" | "error";

// ---- Animation variants ----

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.5, ease: "easeOut" as const },
} as const;

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const checkmarkVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 200, damping: 15, delay: 0.2 },
  },
} as const;

const checkCirclePathVariants = {
  initial: { pathLength: 0, opacity: 0 },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.6, ease: "easeInOut" as const, delay: 0.5 },
      opacity: { duration: 0.1, delay: 0.5 },
    },
  },
} as const;

// ---- Form section wrapper with emerald left border ----

function IntakeSection({
  title,
  icon,
  children,
  required,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <motion.div {...fadeInUp}>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="border-l-4 border-l-brand">
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-muted/30">
            <div className="w-7 h-7 rounded-md bg-brand-subtle flex items-center justify-center shrink-0">
              {icon}
            </div>
            <h3 className="font-semibold text-foreground text-sm">
              {title}
              {required && <span className="text-red-500 ml-1">*</span>}
            </h3>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ---- Loading Skeleton ----

function LoadingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="text-center mb-2">
        <Skeleton className="h-8 w-64 mx-auto mb-2" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-36 w-full rounded-lg" />
      ))}
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}

// ---- Main Page Component ----

export default function IntakeFormPage() {
  const params = useParams();
  const token = params.token as string;
  const [pageState, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<IntakeData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fetchedRef = useRef(false);

  // ---- Form fields ----
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // ---- Fetch appointment data ----
  useEffect(() => {
    if (!token || fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/intake?token=${encodeURIComponent(token)}`);
        if (cancelled) return;

        if (res.status === 404) {
          setPageState("not_found");
          return;
        }

        if (res.status === 410) {
          setPageState("expired");
          return;
        }

        if (!res.ok) {
          const body = await res.json();
          if (body.error?.includes("already been submitted")) {
            setPageState("already_submitted");
          } else {
            setPageState("error");
            setErrorMessage(body.error || "Something went wrong");
          }
          return;
        }

        const body = await res.json();
        if (cancelled) return;

        setData(body);
        setPageState("valid");

        // Populate form with existing data if available
        if (body.existingIntakeData) {
          const d = body.existingIntakeData;
          if (d.chiefComplaint) setChiefComplaint(d.chiefComplaint);
          if (d.medications) setMedications(d.medications);
          if (d.allergies) setAllergies(d.allergies);
          if (d.medicalHistory) setMedicalHistory(d.medicalHistory);
          if (d.familyHistory) setFamilyHistory(d.familyHistory);
          if (d.emergencyName) setEmergencyName(d.emergencyName);
          if (d.emergencyPhone) setEmergencyPhone(d.emergencyPhone);
          if (d.emergencyRelation) setEmergencyRelation(d.emergencyRelation);
          if (d.additionalNotes) setAdditionalNotes(d.additionalNotes);
        }
      } catch {
        if (cancelled) return;
        setPageState("error");
        setErrorMessage("Unable to connect. Please check your internet and try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ---- Submit handler ----
  const handleSubmit = useCallback(async () => {
    if (!token || !data) return;

    // Validate required field
    if (!chiefComplaint.trim()) {
      setErrorMessage("Please describe your chief complaint (reason for visit).");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const formData: Record<string, string> = {
        chiefComplaint: chiefComplaint.trim(),
      };
      if (medications.trim()) formData.medications = medications.trim();
      if (allergies.trim()) formData.allergies = allergies.trim();
      if (medicalHistory.trim()) formData.medicalHistory = medicalHistory.trim();
      if (familyHistory.trim()) formData.familyHistory = familyHistory.trim();
      if (emergencyName.trim()) formData.emergencyName = emergencyName.trim();
      if (emergencyPhone.trim()) formData.emergencyPhone = emergencyPhone.trim();
      if (emergencyRelation.trim()) formData.emergencyRelation = emergencyRelation.trim();
      if (additionalNotes.trim()) formData.additionalNotes = additionalNotes.trim();

      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, formData }),
      });

      if (!res.ok) {
        const body = await res.json();
        if (body.error?.includes("already been submitted")) {
          setPageState("already_submitted");
        } else {
          setErrorMessage(body.error || "Failed to submit intake form. Please try again.");
        }
        return;
      }

      setSuccess(true);
    } catch {
      setErrorMessage("Unable to connect. Please check your internet and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [token, data, chiefComplaint, medications, allergies, medicalHistory, familyHistory, emergencyName, emergencyPhone, emergencyRelation, additionalNotes]);

  // ---- Render: Loading State ----

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <Header />
        <main className="flex-1 py-8 px-4">
          <LoadingSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  // ---- Render: Error / Expired / Not Found States ----

  if (
    pageState === "not_found" ||
    pageState === "expired" ||
    pageState === "already_submitted" ||
    pageState === "error"
  ) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div className="max-w-md w-full" {...fadeInUp}>
            <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-10 pb-8 px-8">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="size-8 text-amber-500" />
                </div>

                {pageState === "not_found" && (
                  <>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Link Not Found
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      We couldn&apos;t find an intake form associated with this link.
                      It may have been removed or the link may be incorrect.
                    </p>
                  </>
                )}

                {pageState === "expired" && (
                  <>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Link Expired
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      This intake form link has expired. Please contact the clinic
                      if you need to update your information.
                    </p>
                  </>
                )}

                {pageState === "already_submitted" && (
                  <>
                    <div className="w-16 h-16 rounded-full bg-brand-muted flex items-center justify-center mx-auto mb-5">
                      <CheckCircle2 className="size-8 text-brand" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Already Submitted
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Your intake form has already been submitted. Your provider will
                      review this information before your appointment.
                    </p>
                  </>
                )}

                {pageState === "error" && (
                  <>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Something Went Wrong
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      {errorMessage || "An unexpected error occurred. Please try again."}
                    </p>
                  </>
                )}

                <Separator className="my-6" />
                <Button asChild className="w-full" variant="outline">
                  <Link href="/">Back to Home</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  // ---- Render: Success State ----

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div className="max-w-md w-full text-center" {...fadeInUp}>
            <Card className="border-0 shadow-lg">
              <CardContent className="pt-10 pb-8 px-8">
                <motion.div
                  className="w-20 h-20 rounded-full bg-brand-subtle flex items-center justify-center mx-auto mb-5"
                  variants={checkmarkVariants}
                  initial="initial"
                  animate="animate"
                >
                  <motion.svg
                    className="size-10 text-brand"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M5 13l4 4L19 7"
                      variants={checkCirclePathVariants}
                      initial="initial"
                      animate="animate"
                    />
                  </motion.svg>
                </motion.div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Intake Form Submitted!
                </h2>
                <p className="text-muted-foreground mb-8">
                  Your provider will review this information before your appointment.
                </p>
                <Button asChild className="w-full" variant="outline" size="lg">
                  <Link href="/">Back to Home</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  // ---- Render: Valid — The Intake Form ----

  if (pageState === "valid" && data) {
    const startTime = new Date(data.appointment.startTime);
    const providerName = `${data.appointment.provider.firstName} ${data.appointment.provider.lastName}${data.appointment.provider.credentials ? `, ${data.appointment.provider.credentials}` : ""}`;

    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <Header />

        <main className="flex-1 py-6 px-4">
          <div className="max-w-2xl mx-auto space-y-5">
            {/* Page Header */}
            <motion.div className="text-center" {...fadeInUp}>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-subtle mb-3">
                <FileText className="size-6 text-brand" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                Pre-Visit Intake Form
              </h1>
              <p className="text-muted-foreground mt-1">
                Please complete this form to help your provider prepare for your visit
              </p>
            </motion.div>

            {/* Appointment Summary Card */}
            <motion.div {...fadeInUp}>
              <Card className="border-0 shadow-lg overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-brand via-lavender to-brand" />
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
                    <Calendar className="size-4 text-brand" />
                    Appointment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-2.5 bg-muted/40 rounded-lg p-3">
                      <Calendar className="size-4 text-brand mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Date &amp; Time</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                          {format(startTime, "EEEE, MMMM d, yyyy")} at {format(startTime, "h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 bg-muted/40 rounded-lg p-3">
                      <User className="size-4 text-brand mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Provider</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">{providerName}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 bg-muted/40 rounded-lg p-3">
                      <Building2 className="size-4 text-brand mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Clinic</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">{data.appointment.clinic.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {data.appointment.clinic.streetAddress}, {data.appointment.clinic.city},{" "}
                          {data.appointment.clinic.state} {data.appointment.clinic.zipCode}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 bg-muted/40 rounded-lg p-3">
                      <Stethoscope className="size-4 text-brand mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Service</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                          {data.appointment.service.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{data.appointment.specialty.name}</p>
                      </div>
                    </div>
                  </div>

                  {/* Insurance badge */}
                  {data.appointment.insurance && (
                    <div className="flex items-center gap-2 pt-1">
                      <Badge className="bg-brand-subtle text-brand border-brand-border hover:bg-brand-subtle px-3 py-1 text-sm">
                        <Shield className="size-3.5 mr-1.5" />
                        {data.appointment.insurance.name}
                      </Badge>
                      {data.appointment.modality === "VIDEO" && (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 px-3 py-1 text-sm">
                          Video Visit
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Error message */}
            {errorMessage && (
              <motion.div {...fadeInUp}>
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <AlertCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
              </motion.div>
            )}

            {/* Form Sections */}
            <motion.div className="space-y-4" variants={staggerContainer} initial="initial" animate="animate">
              {/* Chief Complaint */}
              <IntakeSection
                title="Chief Complaint"
                icon={<Stethoscope className="size-3.5 text-brand-hover" />}
                required
              >
                <div className="space-y-2">
                  <Label htmlFor="chiefComplaint" className="text-sm font-medium">
                    What brings you in today?
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Textarea
                    id="chiefComplaint"
                    placeholder="Describe your symptoms, concerns, or reason for this visit..."
                    value={chiefComplaint}
                    onChange={(e) => {
                      setChiefComplaint(e.target.value);
                      setErrorMessage(null);
                    }}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </IntakeSection>

              {/* Current Medications */}
              <IntakeSection
                title="Current Medications"
                icon={<Pill className="size-3.5 text-brand-hover" />}
              >
                <div className="space-y-2">
                  <Label htmlFor="medications" className="text-sm font-medium">
                    Current Medications
                  </Label>
                  <Textarea
                    id="medications"
                    placeholder='e.g., Lisinopril 10mg - once daily, Metformin 500mg - twice daily with meals'
                    value={medications}
                    onChange={(e) => setMedications(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    List all medications, dosages, and frequency
                  </p>
                </div>
              </IntakeSection>

              {/* Allergies */}
              <IntakeSection
                title="Allergies"
                icon={<AlertTriangle className="size-3.5 text-brand-hover" />}
              >
                <div className="space-y-2">
                  <Label htmlFor="allergies" className="text-sm font-medium">
                    Known Allergies
                  </Label>
                  <Textarea
                    id="allergies"
                    placeholder="e.g., Penicillin - causes rash, Shellfish - severe reaction, Latex"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    List any known allergies (medications, food, environmental)
                  </p>
                </div>
              </IntakeSection>

              {/* Medical History */}
              <IntakeSection
                title="Medical History"
                icon={<History className="size-3.5 text-brand-hover" />}
              >
                <div className="space-y-2">
                  <Label htmlFor="medicalHistory" className="text-sm font-medium">
                    Medical History
                  </Label>
                  <Textarea
                    id="medicalHistory"
                    placeholder="e.g., Type 2 Diabetes (diagnosed 2018), Hypertension, Appendectomy (2015)"
                    value={medicalHistory}
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    List any chronic conditions, past surgeries, or hospitalizations
                  </p>
                </div>
              </IntakeSection>

              {/* Family History */}
              <IntakeSection
                title="Family History"
                icon={<Users className="size-3.5 text-brand-hover" />}
              >
                <div className="space-y-2">
                  <Label htmlFor="familyHistory" className="text-sm font-medium">
                    Family Medical History
                    <span className="text-muted-foreground font-normal ml-2">(optional)</span>
                  </Label>
                  <Textarea
                    id="familyHistory"
                    placeholder="e.g., Father - heart disease, Mother - breast cancer, Brother - diabetes"
                    value={familyHistory}
                    onChange={(e) => setFamilyHistory(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </IntakeSection>

              {/* Emergency Contact */}
              <IntakeSection
                title="Emergency Contact"
                icon={<Phone className="size-3.5 text-brand-hover" />}
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyName" className="text-sm font-medium">
                      Name
                    </Label>
                    <Input
                      id="emergencyName"
                      placeholder="Full name"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone" className="text-sm font-medium">
                      Phone
                    </Label>
                    <Input
                      id="emergencyPhone"
                      placeholder="(555) 123-4567"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyRelation" className="text-sm font-medium">
                      Relationship
                    </Label>
                    <Input
                      id="emergencyRelation"
                      placeholder="e.g., Spouse, Parent"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                    />
                  </div>
                </div>
              </IntakeSection>

              {/* Additional Notes */}
              <IntakeSection
                title="Additional Notes"
                icon={<StickyNote className="size-3.5 text-brand-hover" />}
              >
                <div className="space-y-2">
                  <Label htmlFor="additionalNotes" className="text-sm font-medium">
                    Anything else your provider should know?
                    <span className="text-muted-foreground font-normal ml-2">(optional)</span>
                  </Label>
                  <Textarea
                    id="additionalNotes"
                    placeholder="Any additional information, questions, or concerns you'd like to share..."
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </IntakeSection>
            </motion.div>

            {/* Submit Button */}
            <motion.div {...fadeInUp}>
              <Button
                variant="brand"
                size="cta"
                className="w-full sm:w-auto sm:px-10"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <FileText className="size-5" />
                    Submit Intake Form
                  </>
                )}
              </Button>
            </motion.div>

            {/* Privacy note */}
            <motion.p {...fadeInUp} className="text-center text-xs text-muted-foreground pb-2">
              <Shield className="size-3 inline mr-1 text-brand" />
              Your information is encrypted and securely transmitted. It will only be shared
              with your healthcare provider.
            </motion.p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Fallback
  return null;
}

// ---- Header Component ----

function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
            <Heart className="size-4 text-white" />
          </div>
          <span className="font-bold text-lg text-foreground tracking-tight">
            DoctA
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="size-3.5 text-brand" />
          <span>Patient Intake Portal</span>
        </div>
      </div>
    </header>
  );
}

// ---- Footer Component ----

function Footer() {
  return (
    <footer className="border-t border-border/50 bg-white/80 mt-auto">
      <div className="max-w-4xl mx-auto px-4 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by <span className="font-semibold text-foreground">DoctA</span> &middot; Patient Intake Portal
        </p>
      </div>
    </footer>
  );
}
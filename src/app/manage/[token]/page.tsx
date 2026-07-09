"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format, isAfter, subHours, differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Shield,
  CheckCircle2,
  AlertCircle,
  Building2,
  Heart,
  FileText,
  CreditCard,
  User,
  Loader2,
  Video,
  Timer,
  Star,
  QrCode,
} from "lucide-react";
import { QrCodeDisplay } from "@/components/qr-code-display";

// ---- Types ----

interface ManageData {
  token: {
    purpose: string;
    consumedAt: string | null;
    justCheckedIn: boolean;
  };
  appointment: {
    id: string;
    status: string;
    patientName: string;
    reasonForVisit: string;
    modality: string;
    startTime: string;
    endTime: string;
    isDemoInsurance: boolean;
    depositCents: number;
    selfPayCents: number;
    paymentStatus: string;
    paymentMethod: string | null;
    intakeCompleted: boolean;
  };
  provider: {
    firstName: string;
    lastName: string;
    credentials: string | null;
    photoUrl: string | null;
  };
  specialty: {
    name: string;
  };
  service: {
    name: string;
  };
  clinic: {
    name: string;
    logoUrl: string | null;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    phoneNumber: string;
    videoVisitLink: string | null;
  };
  insurance: {
    name: string;
    isDemo: boolean;
  } | null;
  ledger: {
    type: string;
    amountCents: number;
    description: string | null;
  } | null;
}

type PageState = "loading" | "valid" | "expired" | "not_found" | "cancelled" | "check_in_early" | "error";

// ---- Animation variants ----

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.5, ease: "easeOut" as const },
} as const;

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } },
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
    transition: { pathLength: { duration: 0.6, ease: "easeInOut" as const, delay: 0.5 }, opacity: { duration: 0.1, delay: 0.5 } },
  },
} as const;

// ---- Countdown Component ----

function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [now, setNow] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(new Date()), 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const days = differenceInDays(targetDate, now);
  const hours = differenceInHours(targetDate, now) % 24;

  if (days > 0) {
    return (
      <div className="flex items-center gap-2 text-brand-hover bg-brand-muted rounded-lg px-4 py-3">
        <Timer className="size-5 text-brand" />
        <span className="font-semibold text-lg">
          {days} day{days !== 1 ? "s" : ""} and {hours} hour{hours !== 1 ? "s" : ""} until your appointment
        </span>
      </div>
    );
  }

  if (hours > 0) {
    const mins = differenceInMinutes(targetDate, now) % 60;
    return (
      <div className="flex items-center gap-2 text-brand-hover bg-brand-muted rounded-lg px-4 py-3">
        <Timer className="size-5 text-brand" />
        <span className="font-semibold text-lg">
          {hours} hour{hours !== 1 ? "s" : ""} and {mins} minute{mins !== 1 ? "s" : ""} until your appointment
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
      <Timer className="size-5 text-amber-600" />
      <span className="font-semibold text-lg">Your appointment is very soon!</span>
    </div>
  );
}

// ---- Format currency ----

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---- Main Page Component ----

export default function ManagePage() {
  const params = useParams();
  const token = params.token as string;
  const [pageState, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<ManageData | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!token || fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        // Detect token format: 64-hex raw token vs cuid token ID (QR code links)
        const isRawToken = /^[0-9a-fA-F]{64}$/.test(token);
        const apiUrl = isRawToken
          ? `/api/manage?token=${encodeURIComponent(token)}`
          : `/api/manage?tokenId=${encodeURIComponent(token)}`;
        const res = await fetch(apiUrl);
        if (cancelled) return;

        if (res.status === 404) {
          setPageState("not_found");
          return;
        }

        if (res.status === 410) {
          const body = await res.json();
          if (body.code === "APPOINTMENT_CANCELLED") {
            setPageState("cancelled");
          } else {
            setPageState("expired");
          }
          return;
        }

        if (res.status === 400) {
          const body = await res.json();
          if (body.code === "CHECK_IN_TOO_EARLY") {
            setPageState("check_in_early");
            setData(body);
          } else {
            setPageState("error");
            setErrorMessage(body.error || "Invalid request");
          }
          return;
        }

        if (!res.ok) {
          setPageState("error");
          setErrorMessage("Something went wrong. Please try again.");
          return;
        }

        const body = await res.json();
        setData(body);
        setPageState("valid");
      } catch {
        if (cancelled) return;
        setPageState("error");
        setErrorMessage("Unable to connect. Please check your internet and try again.");
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  // Determine if check-in button should show
  const showCheckInButton = () => {
    if (!data || pageState !== "valid") return false;
    if (data.token.purpose !== "CHECK_IN") return false;
    if (data.token.consumedAt) return false;
    if (data.appointment.status !== "BOOKED") return false;

    const now = new Date();
    const windowStart = subHours(new Date(data.appointment.startTime), 24);
    return isAfter(now, windowStart);
  };

  // ---- Render: Loading State ----

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="size-10 text-brand animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">Loading your appointment details…</p>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  // ---- Render: Error / Expired / Not Found States ----

  if (pageState === "not_found" || pageState === "expired" || pageState === "cancelled" || pageState === "error" || pageState === "check_in_early") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div
            className="max-w-md w-full"
            {...fadeInUp}
          >
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
                      We couldn&apos;t find an appointment associated with this link.
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
                      This appointment link has expired. Appointment management links are valid
                      for 7 days after the scheduled appointment date.
                    </p>
                  </>
                )}

                {pageState === "cancelled" && (
                  <>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Appointment Cancelled
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      This appointment has been cancelled. If you believe this is an error,
                      please contact the clinic directly.
                    </p>
                  </>
                )}

                {pageState === "check_in_early" && (
                  <>
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Check-In Not Yet Available
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Check-in opens 24 hours before your appointment time.
                      Please check back closer to your appointment.
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

                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    Need help? Please call the clinic directly:
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <Phone className="size-4 text-brand" />
                    <span className="font-semibold text-foreground text-lg">
                      {data?.clinic?.phoneNumber || "(555) 123-4567"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  // ---- Render: Valid Appointment ----

  if (pageState === "valid" && data) {
    const startTime = new Date(data.appointment.startTime);
    const endTime = new Date(data.appointment.endTime);
    const isInPerson = data.appointment.modality === "IN_PERSON";
    const isVideo = data.appointment.modality === "VIDEO";
    const isCheckedIn = data.token.consumedAt !== null;
    const justCheckedIn = data.token.justCheckedIn === true;
    const providerName = `${data.provider.firstName} ${data.provider.lastName}${data.provider.credentials ? `, ${data.provider.credentials}` : ""}`;

    // Payment display logic
    const getPaymentDisplay = () => {
      if (data.appointment.isDemoInsurance || data.insurance) {
        if (data.appointment.isDemoInsurance) {
          return { label: "Demo Insurance", sublabel: "No payment required", color: "bg-brand-subtle text-brand" };
        }
        if (data.ledger?.amountCents && data.ledger.amountCents > 0) {
          return { label: `Insurance + ${formatCents(data.ledger.amountCents)} deposit`, sublabel: "Deposit will be applied to your copay", color: "bg-blue-100 text-blue-800" };
        }
        return { label: "Insurance", sublabel: "Please bring your insurance card", color: "bg-brand-subtle text-brand" };
      }

      if (data.appointment.selfPayCents > 0) {
        return { label: "Self-Pay", sublabel: `Total: ${formatCents(data.appointment.selfPayCents)}`, color: "bg-amber-100 text-amber-800" };
      }

      if (data.appointment.depositCents > 0) {
        return { label: `Deposit: ${formatCents(data.appointment.depositCents)}`, sublabel: "Remaining balance due at visit", color: "bg-amber-100 text-amber-800" };
      }

      return { label: "Free Visit", sublabel: "No payment required", color: "bg-brand-subtle text-brand" };
    };

    const paymentInfo = getPaymentDisplay();

    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <Header />

        <main className="flex-1 py-6 px-4">
          <div className="max-w-2xl mx-auto space-y-5">
            <AnimatePresence mode="wait">
              {/* ---- Check-In Success Overlay ---- */}
              {justCheckedIn && (
                <motion.div
                  key="checkin-success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-2"
                >
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-brand to-brand-hover text-white overflow-hidden">
                    <CardContent className="pt-8 pb-8 px-8 text-center">
                      <motion.div
                        className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-5"
                        variants={checkmarkVariants}
                        initial="initial"
                        animate="animate"
                      >
                        <motion.svg
                          className="size-10 text-white"
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
                      <h2 className="text-2xl font-bold mb-2">You&apos;re Checked In!</h2>
                      <p className="text-brand-muted text-lg mb-1">
                        {data.clinic.name}
                      </p>
                      <p className="text-brand-muted/80">
                        {format(startTime, "EEEE, MMMM d, yyyy")} at {format(startTime, "h:mm a")}
                      </p>
                      {isVideo && data.clinic.videoVisitLink && (
                        <div className="mt-5">
                          <Button
                            size="lg"
                            className="bg-white text-brand-hover hover:bg-brand-muted font-semibold rounded-lg"
                            asChild
                          >
                            <a href={data.clinic.videoVisitLink} target="_blank" rel="noopener noreferrer">
                              <Video className="size-4" />
                              Join Video Visit
                            </a>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ---- Appointment Card ---- */}
              <motion.div
                key="appointment-card"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-5"
              >
                {/* Status Banner */}
                {(isCheckedIn || justCheckedIn) && !justCheckedIn && (
                  <motion.div {...fadeInUp}>
                    <div className="flex items-center gap-2 bg-brand-muted border border-brand-border rounded-lg px-4 py-3">
                      <CheckCircle2 className="size-5 text-brand shrink-0" />
                      <span className="text-brand font-medium">You are checked in for this appointment</span>
                    </div>
                  </motion.div>
                )}

                {/* Main Appointment Card */}
                <motion.div {...fadeInUp}>
                  <Card className="border-0 shadow-lg overflow-hidden status-card-gradient-border">
                    {/* Gradient Top Bar */}
                    <div className="h-2 bg-gradient-to-r from-brand via-lavender to-brand" />

                    <CardHeader className="pb-4">
                      <div className="flex items-start gap-4">
                        {/* Clinic Logo/Placeholder */}
                        <div className="w-14 h-14 rounded-xl bg-brand-subtle flex items-center justify-center shrink-0 border border-brand-border">
                          {data.clinic.logoUrl ? (
                            <img
                              src={data.clinic.logoUrl}
                              alt={data.clinic.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <Building2 className="size-6 text-brand" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-xl">{data.clinic.name}</CardTitle>
                          <CardDescription className="flex items-start gap-1.5 mt-1.5">
                            <MapPin className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                            <span>
                              {data.clinic.streetAddress}, {data.clinic.city},{" "}
                              {data.clinic.state} {data.clinic.zipCode}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5">
                      {/* Appointment Date/Time + Modality */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex items-start gap-3 bg-muted/40 rounded-lg p-4">
                          <Calendar className="size-5 text-brand mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Date
                            </p>
                            <p className="text-base font-semibold text-foreground mt-0.5">
                              {format(startTime, "EEEE, MMMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 bg-muted/40 rounded-lg p-4">
                          <Clock className="size-5 text-brand mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Time
                            </p>
                            <p className="text-base font-semibold text-foreground mt-0.5">
                              {format(startTime, "h:mm a")} – {format(endTime, "h:mm a")}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Modality Badge */}
                      <div className="flex items-center gap-2">
                        {isVideo ? (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 gap-1.5 px-3 py-1 text-sm">
                            <Video className="size-3.5" />
                            Video Visit
                          </Badge>
                        ) : (
                          <Badge className="bg-brand-subtle text-brand border-brand-border hover:bg-brand-subtle gap-1.5 px-3 py-1 text-sm">
                            <Building2 className="size-3.5" />
                            In-Clinic
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-sm px-3 py-1">
                          {data.service.name}
                        </Badge>
                      </div>

                      {/* Video link for active check-in */}
                      {isVideo && isCheckedIn && data.clinic.videoVisitLink && !justCheckedIn && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <a
                            href={data.clinic.videoVisitLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 text-blue-700 hover:text-blue-900 transition-colors"
                          >
                            <Video className="size-5 shrink-0" />
                            <div>
                              <p className="font-semibold">Join Your Video Visit</p>
                              <p className="text-sm text-blue-600">Click to open the video call link</p>
                            </div>
                          </a>
                        </div>
                      )}

                      <Separator />

                      {/* Provider Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 border border-brand-border">
                          {data.provider.photoUrl ? (
                            <img
                              src={data.provider.photoUrl}
                              alt={providerName}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <User className="size-5 text-brand" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-base">{providerName}</p>
                          <p className="text-sm text-muted-foreground">{data.specialty.name}</p>
                        </div>
                      </div>

                      <Separator />

                      {/* Insurance & Payment */}
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <CreditCard className="size-4" />
                          Payment &amp; Insurance
                        </h3>

                        {data.insurance && !data.appointment.isDemoInsurance && (
                          <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3">
                            <span className="text-sm text-muted-foreground">Insurance</span>
                            <span className="font-medium text-foreground">{data.insurance.name}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-3">
                          <span className="text-sm text-muted-foreground">Status</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${paymentInfo.color}`}>
                            {paymentInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-1">{paymentInfo.sublabel}</p>
                      </div>

                      <Separator />

                      {/* Countdown */}
                      {data.appointment.status === "BOOKED" && (
                        <CountdownTimer targetDate={startTime} />
                      )}
                    </CardContent>

                    {/* Check-In Button in Footer */}
                    {showCheckInButton() && (
                      <CardFooter className="pt-0">
                        <Button
                          variant="brand"
                          size="cta"
                          className="w-full checkin-pulse-glow"
                          disabled={checkInLoading}
                          onClick={async () => {
                            setCheckInLoading(true);
                            try {
                              const res = await fetch(`/api/manage?token=${encodeURIComponent(token)}`);
                              const body = await res.json();
                              if (res.ok) {
                                setData(body);
                              }
                            } catch {
                              // Keep existing data on re-fetch failure
                            }
                            setCheckInLoading(false);
                          }}
                        >
                          {checkInLoading ? (
                            <>
                              <Loader2 className="size-5 animate-spin" />
                              Checking In…
                            </>
                          ) : (
                            <>
                              <Shield className="size-5" />
                              Check In for Your Appointment
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                </motion.div>

                {/* ---- QR Code Section (BOOKED or CONFIRMED only) ---- */}
                {(data.appointment.status === "BOOKED" || data.appointment.status === "CONFIRMED") && (
                  <motion.div {...fadeInUp}>
                    <Card className="border-brand-border shadow-md bg-white">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <QrCode className="size-5 text-brand" />
                          Your Appointment QR Code
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Scan this QR code to quickly access your appointment management page.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <QrCodeDisplay
                          appointmentId={data.appointment.id}
                          patientName={data.appointment.patientName}
                          manageUrl={typeof window !== "undefined" ? window.location.href : undefined}
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* ---- What to Know Section ---- */}
                <motion.div {...fadeInUp}>
                  <Card className="border-0 shadow-md card-hover-lift">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="size-5 text-brand" />
                        What to Know Before Your Visit
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                          <Clock className="size-3.5 text-brand-hover" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            Arrive 10–15 Minutes Early
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isVideo
                              ? "Join the video link a few minutes early to test your camera and microphone."
                              : "This gives you time to check in, complete any remaining paperwork, and get settled."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                          <CreditCard className="size-3.5 text-brand-hover" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            Bring Your Insurance Card &amp; ID
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {data.insurance && !data.appointment.isDemoInsurance
                              ? `Please bring your ${data.insurance.name} insurance card and a valid photo ID.`
                              : "Please bring a valid photo ID to your appointment."}
                          </p>
                        </div>
                      </div>

                      {isVideo && (
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                            <Video className="size-3.5 text-brand-hover" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              Prepare Your Device
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Find a quiet, well-lit space with a stable internet connection. Use a device with a camera and microphone.
                            </p>
                          </div>
                        </div>
                      )}

                      {!data.appointment.intakeCompleted && (
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
                            <FileText className="size-3.5 text-brand-hover" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              Intake Forms
                            </p>
                            <p className="text-sm text-muted-foreground">
                              You may be asked to complete intake forms before or at the time of your visit to help your provider prepare.
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* ---- Complete Intake Form Button ---- */}
                {!data.appointment.intakeCompleted && data.appointment.status === "BOOKED" && (
                  <motion.div {...fadeInUp}>
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full border-brand-border text-brand-hover hover:bg-brand-muted hover:text-brand-hover font-semibold text-base h-12 rounded-lg"
                      asChild
                    >
                      <Link href={`/intake/${token}`}>
                        <FileText className="size-5" />
                        Complete Intake Form
                      </Link>
                    </Button>
                  </motion.div>
                )}

                {/* ---- Cancellation Policy ---- */}
                <motion.div {...fadeInUp}>
                  <Card className="border-0 shadow-md card-hover-lift bg-muted/30 border-l-4 border-l-red-300/60">
                    <CardContent className="py-5 px-6">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-foreground text-sm">Cancellation Policy</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Please cancel or reschedule at least 24 hours before your appointment to avoid
                            any deposit forfeiture. Contact the clinic directly to make changes.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* ---- Leave a Review Button (completed appointments) ---- */}
                {data.appointment.status === "COMPLETED" && (
                  <motion.div {...fadeInUp}>
                    <Button
                      variant="brand"
                      size="cta"
                      className="w-full"
                      asChild
                    >
                      <a href={`/review/${token}`}>
                        <Star className="size-5" />
                        Leave a Review
                      </a>
                    </Button>
                  </motion.div>
                )}

                {/* ---- Clinic Contact ---- */}
                <motion.div {...fadeInUp}>
                  <div className="text-center py-3">
                    <p className="text-sm text-muted-foreground mb-2">Questions about your appointment?</p>
                    <a
                      href={`tel:${data.clinic.phoneNumber}`}
                      className="inline-flex items-center gap-2 text-brand-hover hover:text-brand-hover font-medium transition-colors"
                    >
                      <Phone className="size-4" />
                      {data.clinic.phoneNumber}
                    </a>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
}

// ---- Header Component ----

function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-lavender-hover flex items-center justify-center">
            <Heart className="size-4 text-white" />
          </div>
          <span className="font-bold text-lg text-foreground tracking-tight">
            DoctA
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="size-3.5 text-brand" />
          <span>Secure Patient Portal</span>
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
          Powered by <span className="font-semibold text-foreground">DoctA</span> &middot; Patient Self-Service Portal
        </p>
      </div>
    </footer>
  );
}
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Star,
  CheckCircle,
  AlertCircle,
  Heart,
  Loader2,
  Calendar,
  Building2,
  User,
  Clock,
  Shield,
} from "lucide-react";

// ---- Types ----

interface AppointmentData {
  appointment: {
    id: string;
    status: string;
    patientName: string;
    reasonForVisit: string;
    modality: string;
    startTime: string;
    endTime: string;
  };
  provider: {
    firstName: string;
    lastName: string;
    credentials: string | null;
  };
  specialty: {
    name: string;
  };
  service: {
    name: string;
  };
  clinic: {
    name: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

type PageState = "loading" | "valid" | "invalid" | "error" | "submitted";

// ---- Rating Label ----

const RATING_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

// ---- Animation Variants ----

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.5, ease: "easeOut" as const },
} as const;

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

// ---- Star Selector Component ----

function StarSelector({
  label,
  description,
  value,
  onChange,
  required,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (val: number) => void;
  required?: boolean;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </div>
        {value > 0 && (
          <span className="text-sm font-medium text-brand-hover">
            {RATING_LABELS[value]}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            aria-label={`${label}: ${star} star${star !== 1 ? "s" : ""}`}
          >
            <Star
              className={`size-7 transition-colors ${
                star <= (hovered || value)
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-none text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Main Page Component ----

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const fetchedRef = useRef(false);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [appointmentData, setAppointmentData] = useState<AppointmentData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ratings
  const [overallRating, setOverallRating] = useState(0);
  const [waitTimeRating, setWaitTimeRating] = useState(0);
  const [bedsideRating, setBedsideRating] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [comment, setComment] = useState("");

  // Fetch appointment details
  useEffect(() => {
    if (!token || fetchedRef.current) return;
    fetchedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/manage?token=${encodeURIComponent(token)}`
        );
        if (cancelled) return;

        if (!res.ok) {
          setPageState("invalid");
          return;
        }

        const body = await res.json();
        if (cancelled) return;

        setAppointmentData(body);
        setPageState("valid");
      } catch {
        if (cancelled) return;
        setPageState("error");
        setErrorMessage("Unable to connect. Please check your internet.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (overallRating === 0 || !token) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          overallRating,
          waitTimeRating: waitTimeRating || 1,
          bedsideRating: bedsideRating || 1,
          staffRating: staffRating || 1,
          comment: comment.trim() || undefined,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        const msg =
          body.error || "Something went wrong. Please try again.";
        setErrorMessage(msg);
        setSubmitting(false);
        return;
      }

      setPageState("submitted");
    } catch {
      setErrorMessage("Unable to connect. Please try again.");
      setSubmitting(false);
    }
  }, [token, overallRating, waitTimeRating, bedsideRating, staffRating, comment]);

  const canSubmit = overallRating > 0 && !submitting;
  const startTime = appointmentData
    ? new Date(appointmentData.appointment.startTime)
    : null;
  const providerName = appointmentData
    ? `${appointmentData.provider.firstName} ${appointmentData.provider.lastName}${appointmentData.provider.credentials ? `, ${appointmentData.provider.credentials}` : ""}`
    : "";

  // ---- Render: Loading ----

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <ReviewHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full space-y-6">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </main>
        <ReviewFooter />
      </div>
    );
  }

  // ---- Render: Invalid Token ----

  if (pageState === "invalid") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <ReviewHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div className="max-w-md w-full" {...fadeInUp}>
            <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-10 pb-8 px-8">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="size-8 text-amber-500" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Invalid Review Link
                </h2>
                <p className="text-muted-foreground mb-6">
                  This review link is not valid or has expired. Reviews can only
                  be submitted from a secure link sent after your appointment.
                </p>
                <Button
                  variant="outline"
                  className="font-medium"
                  onClick={() => router.push("/")}
                >
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
        <ReviewFooter />
      </div>
    );
  }

  // ---- Render: Error ----

  if (pageState === "error") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <ReviewHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div className="max-w-md w-full" {...fadeInUp}>
            <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-10 pb-8 px-8">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="size-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Something Went Wrong
                </h2>
                <p className="text-muted-foreground mb-6">
                  {errorMessage ||
                    "An unexpected error occurred. Please try again."}
                </p>
                <Button
                  variant="outline"
                  className="font-medium"
                  onClick={() => router.push("/")}
                >
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
        <ReviewFooter />
      </div>
    );
  }

  // ---- Render: Success ----

  if (pageState === "submitted") {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
        <ReviewHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div className="max-w-md w-full" {...fadeInUp}>
            <Card className="text-center border-0 shadow-lg overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-brand via-lavender to-brand" />
              <CardContent className="pt-10 pb-10 px-8">
                <motion.div
                  className="w-20 h-20 rounded-full bg-brand-subtle flex items-center justify-center mx-auto mb-6"
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
                <h2 className="text-2xl font-bold text-foreground mb-3">
                  Thank You for Your Review!
                </h2>
                <p className="text-muted-foreground text-base leading-relaxed mb-8">
                  Your feedback helps other patients make informed decisions and
                  helps providers improve their care. Your review has been
                  submitted successfully.
                </p>
                <Button
                  size="lg"
                  className="bg-brand hover:bg-brand-hover text-white font-semibold rounded-lg"
                  onClick={() => router.push("/")}
                >
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </main>
        <ReviewFooter />
      </div>
    );
  }

  // ---- Render: Valid — Review Form ----

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-muted/50 to-white">
      <ReviewHeader />

      <main className="flex-1 py-6 px-4">
        <div className="max-w-2xl mx-auto space-y-5">
          <AnimatePresence mode="wait">
            {/* Page Title */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Rate Your Experience
              </h1>
              <p className="text-muted-foreground mt-1.5">
                Your honest feedback helps the community
              </p>
            </motion.div>

            {/* Appointment Summary Card */}
            {appointmentData && startTime && (
              <motion.div {...fadeInUp}>
                <Card className="border-0 shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-brand-subtle flex items-center justify-center shrink-0 border border-brand-border">
                        <User className="size-6 text-brand" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <p className="font-semibold text-foreground">
                            {providerName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {appointmentData.specialty.name} &middot;{" "}
                            {appointmentData.service.name}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="size-3.5" />
                            {appointmentData.clinic.name}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="size-3.5" />
                            {format(startTime, "MMM d, yyyy")}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="size-3.5" />
                            {format(startTime, "h:mm a")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Rating Form Card */}
            <motion.div {...fadeInUp}>
              <Card className="border-0 shadow-lg overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-brand via-lavender to-brand" />
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="size-5 text-brand" />
                    Your Ratings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Overall Rating */}
                  <StarSelector
                    label="Overall Experience"
                    description="How would you rate your overall visit?"
                    value={overallRating}
                    onChange={setOverallRating}
                    required
                  />

                  <Separator />

                  {/* Wait Time */}
                  <StarSelector
                    label="Wait Time"
                    description="How was the wait time before your appointment?"
                    value={waitTimeRating}
                    onChange={setWaitTimeRating}
                  />

                  <Separator />

                  {/* Bedside Manner */}
                  <StarSelector
                    label="Bedside Manner"
                    description="How would you rate the provider's bedside manner and communication?"
                    value={bedsideRating}
                    onChange={setBedsideRating}
                  />

                  <Separator />

                  {/* Staff Friendliness */}
                  <StarSelector
                    label="Staff Friendliness"
                    description="How friendly and helpful was the clinic staff?"
                    value={staffRating}
                    onChange={setStaffRating}
                  />

                  <Separator />

                  {/* Comment */}
                  <div className="space-y-2">
                    <label
                      htmlFor="review-comment"
                      className="text-sm font-medium text-foreground"
                    >
                      Additional Comments{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </label>
                    <Textarea
                      id="review-comment"
                      placeholder="Share more about your experience..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      maxLength={1000}
                      className="min-h-[120px] resize-y"
                    />
                    <div className="flex justify-end">
                      <span
                        className={`text-xs ${
                          comment.length > 900
                            ? "text-amber-600 font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {comment.length}/1,000
                      </span>
                    </div>
                  </div>

                  {/* Error message */}
                  {errorMessage && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <AlertCircle className="size-4 text-red-500 shrink-0" />
                      <p className="text-sm text-red-700">{errorMessage}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    variant="brand"
                    size="cta"
                    className="w-full disabled:cursor-not-allowed"
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-5 animate-spin" />
                        Submitting Review…
                      </>
                    ) : (
                      <>
                        <CheckCircle className="size-5" />
                        Submit Review
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Your review is verified and linked to your appointment. It
                    cannot be edited after submission.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <ReviewFooter />
    </div>
  );
}

// ---- Header Component ----

function ReviewHeader() {
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
          <span>Patient Review Portal</span>
        </div>
      </div>
    </header>
  );
}

// ---- Footer Component ----

function ReviewFooter() {
  return (
    <footer className="border-t border-border/50 bg-white/80 mt-auto">
      <div className="max-w-4xl mx-auto px-4 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by{" "}
          <span className="font-semibold text-foreground">DoctA</span>{" "}
          &middot; Patient Review Portal
        </p>
      </div>
    </footer>
  );
}
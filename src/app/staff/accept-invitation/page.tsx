"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Lock,
  Loader2,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DoctALogo } from "@/components/docta-logo";

type ViewState =
  | "loading"
  | "setup"
  | "already_used"
  | "expired"
  | "invalid"
  | "success"
  | "error";

interface InvitationInfo {
  email: string;
  role: string;
  clinicName: string;
  clinicId: string;
  expiresAt: string;
}

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // View state
  const [view, setView] = useState<ViewState>("loading");
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Form state
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>("");

  // Password strength indicator
  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  // Validate the token on mount
  const validateToken = useCallback(async () => {
    if (!token) {
      setView("invalid");
      setErrorMessage("No invitation token found in the URL.");
      return;
    }

    try {
      const res = await fetch(
        `/api/staff/accept-invitation?token=${encodeURIComponent(token)}`
      );

      if (res.status === 410) {
        const data = await res.json();
        if (data.expired) {
          setView("expired");
          setErrorMessage(
            `This invitation expired on ${new Date(
              data.expiresAt
            ).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}. Please ask the clinic admin to resend the invitation.`
          );
        } else {
          setView("already_used");
          setErrorMessage(
            "This invitation has already been used. If you already set up your account, please sign in."
          );
        }
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setView("invalid");
        setErrorMessage(data.error || "This invitation link is not valid.");
        return;
      }

      const data = await res.json();
      setInvitationInfo(data);
      setView("setup");
    } catch {
      setView("error");
      setErrorMessage(
        "Something went wrong while validating your invitation. Please try again."
      );
    }
  }, [token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  // Submit the form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Client-side validations
    if (name.trim().length < 2) {
      setFormError("Please enter your full name (at least 2 characters)");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    if (passwordStrength.score < 2) {
      setFormError("Please choose a stronger password");
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await fetch("/api/staff/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Failed to create account. Please try again.");
        return;
      }

      setView("success");
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-brand-muted/80 via-background to-coral-muted/40">
      {/* Top accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-brand via-coral to-brand" />

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative">
        <div className="w-full max-w-md">
          {/* Logo + back link */}
          <div className="text-center mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer"
            >
              <span>←</span>
              <span>Back to DoctA</span>
            </Link>
            <div className="flex justify-center mb-3">
              <DoctALogo height={42} />
            </div>
            <p className="text-muted-foreground text-sm">
              Staff Portal — Set up your account
            </p>
          </div>

          {/* Decorative elements (matching login page) */}
          <svg
            className="absolute pointer-events-none"
            style={{
              opacity: 0.04,
              top: "25%",
              left: "50%",
              transform: "translateX(-50%)",
            }}
            width="500"
            height="120"
            viewBox="0 0 500 120"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M0 60 L100 60 L120 60 L140 20 L160 100 L180 10 L200 110 L220 60 L240 60 L350 60 L370 60 L390 20 L410 100 L430 10 L450 110 L470 60 L490 60 L500 60"
              stroke="#059669"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* ==================== LOADING STATE ==================== */}
          {view === "loading" && (
            <div className="relative bg-card rounded-2xl shadow-xl border border-border/60 p-8 animate-card-mount">
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="size-8 text-brand animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">
                  Validating your invitation...
                </p>
              </div>
            </div>
          )}

          {/* ==================== SETUP FORM ==================== */}
          {view === "setup" && invitationInfo && (
            <div className="relative bg-card rounded-2xl shadow-xl border border-border/60 p-8 animate-card-mount">
              {/* Header */}
              <div className="flex items-center gap-3 mb-2">
                <div className="size-10 rounded-xl bg-brand-subtle flex items-center justify-center">
                  <Shield className="size-5 text-brand" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    Set Up Your Account
                  </h1>
                </div>
              </div>

              {/* Clinic info banner */}
              <div className="mb-6 p-3.5 rounded-xl bg-brand-muted border border-brand-border ">
                <div className="flex items-center gap-2 mb-1.5">
                  <Building2 className="size-4 text-brand" />
                  <p className="text-sm font-medium text-brand">
                    {invitationInfo.clinicName}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-brand-hover/80/80">
                  <Mail className="size-3" />
                  <span>{invitationInfo.email}</span>
                </div>
                <p className="text-xs text-brand-hover/60/60 mt-1">
                  You&apos;ll be added as a Receptionist to this clinic.
                </p>
              </div>

              {/* Form error */}
              {formError && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200/60 flex items-start gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-300">
                  <AlertCircle className="size-5 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {formError}
                  </p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-sm font-medium text-foreground"
                  >
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Jane Smith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                      disabled={isSubmitting}
                      className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      className="pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                      tabIndex={-1}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {/* Password strength bar */}
                  {password.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                              i < passwordStrength.score
                                ? passwordStrength.color
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p
                        className={`text-xs ${
                          passwordStrength.textColor
                        } transition-colors`}
                      >
                        {passwordStrength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="confirm-password"
                    className="text-sm font-medium text-foreground"
                  >
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      className={`pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors ${
                        confirmPassword.length > 0 && !passwordsMatch
                          ? "border-red-300 dark:border-red-800 focus-visible:ring-red-500/30"
                          : confirmPassword.length > 0 && passwordsMatch
                            ? "border-brand-border "
                            : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                      tabIndex={-1}
                      aria-label={
                        showConfirmPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && passwordsMatch && (
                    <p className="text-xs text-brand">
                      Passwords match
                    </p>
                  )}
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !name.trim() ||
                    !password ||
                    !confirmPassword ||
                    !passwordsMatch
                  }
                  variant="brand"
                  size="cta"
                  className="w-full shadow-md shadow-brand/20 hover:shadow-lg hover:shadow-brand/30 font-medium"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center">
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Creating your account...
                    </span>
                  ) : (
                    "Create Account & Get Started"
                  )}
                </Button>
              </form>

              {/* Terms hint */}
              <p className="text-xs text-center text-muted-foreground mt-5">
                By creating an account, you agree to be bound to{" "}
                <strong>{invitationInfo.clinicName}</strong> as a staff member.
              </p>
            </div>
          )}

          {/* ==================== ALREADY USED ==================== */}
          {view === "already_used" && (
            <div className="relative bg-card rounded-2xl shadow-xl border border-border/60 p-8 animate-card-mount">
              <div className="flex flex-col items-center text-center py-6">
                <div className="size-14 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-4">
                  <CheckCircle2 className="size-7 text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold mb-2">
                  Invitation Already Used
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  {errorMessage}
                </p>
                <Button
                  variant="brand"
                  onClick={() => router.push("/staff/login")}
                  className="font-medium"
                >
                  Go to Sign In
                </Button>
              </div>
            </div>
          )}

          {/* ==================== EXPIRED ==================== */}
          {view === "expired" && (
            <div className="relative bg-card rounded-2xl shadow-xl border border-border/60 p-8 animate-card-mount">
              <div className="flex flex-col items-center text-center py-6">
                <div className="size-14 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-4">
                  <Clock className="size-7 text-amber-600" />
                </div>
                <h2 className="text-lg font-semibold mb-2">
                  Invitation Expired
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  {errorMessage}
                </p>
                <Link href="/">
                  <Button
                    variant="outline"
                    className="font-medium cursor-pointer"
                  >
                    Back to Home
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* ==================== INVALID ==================== */}
          {view === "invalid" && (
            <div className="relative bg-card rounded-2xl shadow-xl border border-border/60 p-8 animate-card-mount">
              <div className="flex flex-col items-center text-center py-6">
                <div className="size-14 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center mb-4">
                  <XCircle className="size-7 text-red-500" />
                </div>
                <h2 className="text-lg font-semibold mb-2">
                  Invalid Invitation
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  {errorMessage}
                </p>
                <Link href="/">
                  <Button
                    variant="outline"
                    className="font-medium cursor-pointer"
                  >
                    Back to Home
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* ==================== SUCCESS ==================== */}
          {view === "success" && (
            <div className="relative bg-card rounded-2xl shadow-xl border border-border/60 p-8 animate-card-mount">
              <div className="flex flex-col items-center text-center py-6">
                <div className="size-14 rounded-full bg-brand-subtle flex items-center justify-center mb-4 animate-in zoom-in-0 duration-500">
                  <CheckCircle2 className="size-7 text-brand" />
                </div>
                <h2 className="text-lg font-semibold mb-2">
                  Account Created Successfully!
                </h2>
                <p className="text-sm text-muted-foreground mb-2 max-w-sm">
                  Your staff account has been set up and you&apos;re now part of the
                  team. You can sign in using your email and the password you just
                  created.
                </p>
                {invitationInfo && (
                  <p className="text-xs text-muted-foreground mb-6">
                    <strong>{invitationInfo.email}</strong> at{" "}
                    <strong>{invitationInfo.clinicName}</strong>
                  </p>
                )}
                <Button
                  variant="brand"
                  onClick={() => router.push("/staff/login")}
                  className="shadow-md shadow-brand/20 font-medium"
                >
                  Go to Sign In
                </Button>
              </div>
            </div>
          )}

          {/* ==================== ERROR ==================== */}
          {view === "error" && (
            <div className="relative bg-card rounded-2xl shadow-xl border border-border/60 p-8 animate-card-mount">
              <div className="flex flex-col items-center text-center py-6">
                <div className="size-14 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center mb-4">
                  <AlertCircle className="size-7 text-red-500" />
                </div>
                <h2 className="text-lg font-semibold mb-2">
                  Something Went Wrong
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  {errorMessage}
                </p>
                <Button
                  variant="outline"
                  onClick={() => validateToken()}
                  className="font-medium cursor-pointer"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/60 mt-6">
            &copy; 2026 DoctA. Staff access only. Unauthorized access is
            prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Password Strength Helpers ----

function getPasswordStrength(
  password: string
): { score: number; label: string; color: string; textColor: string } {
  if (password.length === 0) return { score: 0, label: "", color: "", textColor: "text-muted-foreground" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Cap at 4
  score = Math.min(score, 4);

  if (score <= 1)
    return {
      score,
      label: "Weak — add uppercase, numbers, or symbols",
      color: "bg-red-500",
      textColor: "text-red-500",
    };
  if (score === 2)
    return {
      score,
      label: "Fair — consider adding more variety",
      color: "bg-amber-500",
      textColor: "text-amber-500",
    };
  if (score === 3)
    return {
      score,
      label: "Good",
      color: "bg-brand-muted",
      textColor: "text-brand",
    };
  return {
    score,
    label: "Strong",
    color: "bg-brand",
    textColor: "text-brand",
  };
}
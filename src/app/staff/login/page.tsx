"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Heart,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function StaffLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/staff/dashboard";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === "CredentialsSignin"
      ? "Invalid email or password"
      : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50/80 via-background to-teal-50/40">
      {/* Top accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo + back link */}
          <div className="text-center mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer"
            >
              <span>←</span>
              <span>Back to ClinicBook</span>
            </Link>
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <div className="relative">
                <Heart className="size-8 text-emerald-600 fill-emerald-600" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-foreground">
                ClinicBook
              </span>
            </div>
            <p className="text-muted-foreground text-sm">
              Staff Portal — Sign in to manage your clinic
            </p>
          </div>

          {/* Login card */}
          <div className="bg-card rounded-2xl shadow-xl shadow-emerald-900/5 border border-border/60 p-8">
            {/* Card header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Shield className="size-5 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  Welcome back
                </h1>
                <p className="text-sm text-muted-foreground">
                  Enter your credentials to continue
                </p>
              </div>
            </div>

            {/* Error alert */}
            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200/60 flex items-start gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-300">
                <AlertCircle className="size-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    Authentication failed
                  </p>
                  <p className="text-sm text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email field */}
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-foreground"
                >
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@downtownmedical.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    disabled={isLoading}
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
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            {/* Demo credentials hint */}
            <div className="mt-6 pt-5 border-t border-border/40">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Demo Credentials
              </p>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <span className="font-mono font-medium text-foreground/80">
                    admin@downtownmedicalgroup.clinicbook.com
                  </span>
                  <span className="text-border">/</span>
                  <span className="font-mono text-foreground/80">
                    admin123
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <span className="font-mono font-medium text-foreground/80">
                    reception@downtownmedicalgroup.clinicbook.com
                  </span>
                  <span className="text-border">/</span>
                  <span className="font-mono text-foreground/80">
                    reception123
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  <span className="font-mono font-medium text-foreground/80">
                    sysadmin@clinicbook.com
                  </span>
                  <span className="text-border">/</span>
                  <span className="font-mono text-foreground/80">
                    sysadmin123
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground/60 mt-6">
            © 2026 ClinicBook. Staff access only. Unauthorized access is
            prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}
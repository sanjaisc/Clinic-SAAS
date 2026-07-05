"use client";

import { useSession } from "next-auth/react";
import { Building2, Phone, Mail, Globe, Clock, Shield, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClinicBookSessionUser } from "@/lib/auth";
import { useEffect, useState } from "react";

interface ClinicInfo {
  id: string;
  name: string;
  slug: string;
  phoneNumber: string;
  email: string | null;
  website: string | null;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  status: string;
  inPersonDepositCents: number;
  videoDepositCents: number;
  selfPayFlatRateCents: number;
  cancellationLeadTimeMin: number;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as ClinicBookSessionUser | undefined;
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [loading, setLoading] = useState(!!user?.clinicId);

  useEffect(() => {
    if (!user?.clinicId) return;
    let cancelled = false;
    fetch(`/api/staff/clinic-info?clinicId=${user.clinicId}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setClinic(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.clinicId]);

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Clinic configuration and account details
        </p>
      </div>

      {!user?.clinicId ? (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Info className="size-8 text-amber-400 mb-3" />
            <p className="text-sm font-medium text-amber-800">
              System Manager Settings
            </p>
            <p className="text-xs text-amber-600 mt-1 max-w-sm text-center">
              System-wide settings are not yet available in this version.
              Clinic-specific settings require selecting a clinic context.
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : clinic ? (
        <>
          {/* Clinic Information */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Building2 className="size-4 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Clinic Information</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] px-2 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                      {clinic.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Clinic Name</p>
                  <p className="text-sm font-semibold text-foreground">{clinic.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Slug</p>
                  <p className="text-sm text-foreground font-mono">{clinic.slug}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <Building2 className="size-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Address</p>
                    <p className="text-sm text-foreground truncate">{clinic.streetAddress}</p>
                    <p className="text-xs text-muted-foreground">{clinic.city}, {clinic.state} {clinic.zipCode}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <div className="size-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Phone className="size-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Phone</p>
                    <p className="text-sm text-foreground">{clinic.phoneNumber}</p>
                  </div>
                </div>
                {clinic.email && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                    <div className="size-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <Mail className="size-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Email</p>
                      <p className="text-sm text-foreground truncate">{clinic.email}</p>
                    </div>
                  </div>
                )}
                {clinic.website && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                    <div className="size-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                      <Globe className="size-4 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Website</p>
                      <p className="text-sm text-foreground truncate">{clinic.website}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Financial Configuration */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Shield className="size-4 text-emerald-600" />
                </div>
                <CardTitle className="text-base">Financial Configuration</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-medium">In-Person Deposit</p>
                  <p className="text-lg font-bold text-emerald-800 mt-1">
                    ${(clinic.inPersonDepositCents / 100).toFixed(2)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-blue-600 font-medium">Video Deposit</p>
                  <p className="text-lg font-bold text-blue-800 mt-1">
                    ${(clinic.videoDepositCents / 100).toFixed(2)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-amber-600 font-medium">Self-Pay Rate</p>
                  <p className="text-lg font-bold text-amber-800 mt-1">
                    {clinic.selfPayFlatRateCents > 0
                      ? `$${(clinic.selfPayFlatRateCents / 100).toFixed(2)}`
                      : "Not set"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
                <Clock className="size-3.5 shrink-0" />
                <span>
                  Cancellation lead time: <strong>{Math.floor(clinic.cancellationLeadTimeMin / 60)}h {clinic.cancellationLeadTimeMin % 60}m</strong>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Shield className="size-4 text-emerald-600" />
                </div>
                <CardTitle className="text-base">Your Account</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Name</p>
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="text-sm text-foreground">{user.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Role</p>
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                    {user.role.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
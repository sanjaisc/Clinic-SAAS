"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Users,
  Send,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  UserPlus,
  Shield,
  Clock,
  Mail,
  BadgeCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DoctASessionUser } from "@/lib/auth";
import { useActiveClinicId } from "@/components/active-clinic-context";

// ---- Types ----
interface StaffInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  acceptedByName: string | null;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInvitationStatus(inv: StaffInvitation): "Pending" | "Accepted" | "Expired" {
  if (inv.acceptedAt) return "Accepted";
  if (new Date(inv.expiresAt) < new Date()) return "Expired";
  return "Pending";
}

const ROLE_LABELS: Record<string, string> = {
  CLINIC_ADMIN: "Admin",
  CLINIC_RECEPTION: "Receptionist",
  SYSTEM_MANAGER: "System Manager",
};

const ROLE_COLORS: Record<string, string> = {
  CLINIC_ADMIN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  CLINIC_RECEPTION: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  SYSTEM_MANAGER: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
};

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  Accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  Expired: "bg-muted text-muted-foreground",
};

// ---- Main Component ----
export default function StaffPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const clinicId = useActiveClinicId(user?.clinicId);

  // Staff state
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    invitationLink: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const fetchInvitations = useCallback(async () => {
    try {
      setInvitationsLoading(true);
      const res = await fetch(`/api/staff/invitations?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setInvitations(data.invitations || []);
    } catch {
      toast.error("Failed to load invitations");
    } finally {
      setInvitationsLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    if (clinicId) {
      fetchInvitations();
    }
  }, [clinicId, fetchInvitations]);

  // Derived staff list from accepted invitations
  const acceptedStaff = invitations.filter((inv) => inv.acceptedAt);

  // Send invitation
  const sendInvitation = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setInviteSending(true);
      setInviteResult(null);
      const res = await fetch(`/api/staff/invitations?clinicId=${clinicId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: "CLINIC_RECEPTION" }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send invitation");
        return;
      }

      toast.success("Invitation sent successfully!");
      setInviteEmail("");
      setInviteResult(data);
      fetchInvitations();
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setInviteSending(false);
    }
  };

  // Copy invitation link
  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  // Revoke invitation
  const revokeInvitation = async (id: string) => {
    try {
      const res = await fetch(
        `/api/staff/invitations/${id}?clinicId=${clinicId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success("Invitation revoked");
      fetchInvitations();
    } catch {
      toast.error("Failed to revoke invitation");
    }
  };

  // Resend invitation
  const resendInvitation = async (id: string) => {
    try {
      const res = await fetch(
        `/api/staff/invitations/${id}/resend?clinicId=${clinicId}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to resend");
        return;
      }
      toast.success("Invitation resent");
      fetchInvitations();
    } catch {
      toast.error("Failed to resend invitation");
    }
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Current Staff */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50">
              <Users className="size-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Current Staff</CardTitle>
              <CardDescription>
                Staff members who have accepted invitations to your clinic
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : acceptedStaff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No staff members yet</p>
              <p className="text-xs mt-1">
                Invite receptionists using the form below
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Name</th>
                    <th className="pb-2 font-medium text-muted-foreground">Email</th>
                    <th className="pb-2 font-medium text-muted-foreground">Role</th>
                    <th className="pb-2 font-medium text-muted-foreground">Accepted</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {acceptedStaff.map((inv) => (
                    <tr key={inv.id} className="py-3">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                            <Shield className="size-3.5 text-emerald-600" />
                          </div>
                          <span className="font-medium">
                            {inv.acceptedByName || inv.email.split("@")[0]}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{inv.email}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            ROLE_COLORS[inv.role] || ROLE_COLORS.CLINIC_RECEPTION
                          }`}
                        >
                          {ROLE_LABELS[inv.role] || inv.role}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground text-xs">
                        {inv.acceptedAt ? formatDateTime(inv.acceptedAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Invite New Receptionist */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-sky-50 dark:bg-sky-950/50">
              <UserPlus className="size-5 text-sky-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Invite New Receptionist</CardTitle>
              <CardDescription>
                Generate a secure, one-time-use invitation link
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="invite-email" className="sr-only">
                Email address
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="receptionist@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendInvitation();
                }}
              />
            </div>
            <Button
              onClick={sendInvitation}
              disabled={inviteSending || !inviteEmail.trim()}
            >
              {inviteSending ? (
                <>
                  <svg
                    className="animate-spin size-4 mr-1.5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-4 mr-1.5" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>

          {/* Show invitation link on success */}
          {inviteResult && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-5 text-emerald-600" />
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Invitation link generated! Share this with the new staff member.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border rounded-md px-3 py-2 break-all">
                  {inviteResult.invitationLink}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyLink(inviteResult.invitationLink)}
                >
                  {linkCopied ? (
                    <Check className="size-3.5 mr-1" />
                  ) : (
                    <Copy className="size-3.5 mr-1" />
                  )}
                  {linkCopied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            The invited person will be assigned the <strong>Receptionist</strong>{" "}
            role and bound to your clinic. The link expires in 7 days.
          </p>
        </CardContent>
      </Card>

      {/* Card 3: Pending Invitations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-amber-50 dark:bg-amber-950/50">
              <Mail className="size-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Invitations</CardTitle>
              <CardDescription>
                Track all sent invitations — pending, accepted, and expired
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No invitations sent yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {invitations.map((inv) => {
                const status = getInvitationStatus(inv);
                const isPending = status === "Pending";
                return (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border bg-background"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`size-2 rounded-full flex-shrink-0 ${
                          status === "Pending"
                            ? "bg-amber-500"
                            : status === "Accepted"
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/30"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">
                            {inv.email}
                          </p>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_COLORS[status]
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>Created: {formatDate(inv.createdAt)}</span>
                          <span>Expires: {formatDate(inv.expiresAt)}</span>
                          {inv.acceptedAt && inv.acceptedByName && (
                            <span>
                              Accepted by{" "}
                              <span className="font-medium text-foreground">
                                {inv.acceptedByName}
                              </span>{" "}
                              on {formatDateTime(inv.acceptedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {(isPending || status === "Expired") && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isPending && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8"
                            onClick={() => resendInvitation(inv.id)}
                          >
                            <RotateCcw className="size-3 mr-1" />
                            Resend
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 text-destructive hover:text-destructive"
                          onClick={() => revokeInvitation(inv.id)}
                        >
                          <Trash2 className="size-3 mr-1" />
                          Revoke
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
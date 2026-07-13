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
  LogIn,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DoctASessionUser } from "@/lib/auth";
import { useActiveClinicId } from "@/components/active-clinic-context";

// ---- Types ----
interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
}

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

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
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
  CLINIC_ADMIN: "bg-brand-subtle text-brand",
  CLINIC_RECEPTION: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
  SYSTEM_MANAGER: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
};

const ROLE_AVATAR_COLORS: Record<string, string> = {
  CLINIC_ADMIN: "bg-brand-subtle",
  CLINIC_RECEPTION: "bg-sky-100 dark:bg-sky-900/50",
  SYSTEM_MANAGER: "bg-purple-100 dark:bg-purple-900/50",
};

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  Accepted: "bg-brand-subtle text-brand",
  Expired: "bg-muted text-muted-foreground",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ---- Main Component ----
export default function StaffPage() {
  const { data: session } = useSession();
  const user = session?.user as DoctASessionUser | undefined;
  const clinicId = useActiveClinicId(user?.clinicId);

  // Staff state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    invitationLink: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Revoke confirmation state
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [revokingInvitation, setRevokingInvitation] = useState<StaffInvitation | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  const fetchInvitations = useCallback(async () => {
    try {
      setInvitationsLoading(true);
      const res = await fetch(`/api/staff/invitations?clinicId=${clinicId}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setInvitations(data.invitations || []);
      setStaffMembers(data.staffMembers || []);
    } catch {
      toast.error("Failed to load staff data");
    } finally {
      setInvitationsLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    if (clinicId) {
      fetchInvitations();
    }
  }, [clinicId, fetchInvitations]);

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
  const confirmRevokeInvitation = (inv: StaffInvitation) => {
    setRevokingInvitation(inv);
    setRevokeConfirmOpen(true);
  };

  const revokeInvitation = async () => {
    if (!revokingInvitation) return;
    try {
      setRevokeLoading(true);
      const res = await fetch(
        `/api/staff/invitations/${revokingInvitation.id}?clinicId=${clinicId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      toast.success("Invitation revoked");
      setRevokeConfirmOpen(false);
      setRevokingInvitation(null);
      fetchInvitations();
    } catch {
      toast.error("Failed to revoke invitation");
    } finally {
      setRevokeLoading(false);
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg bg-brand-muted">
                <Users className="size-5 text-brand" />
              </div>
              <div>
                <CardTitle className="text-lg">Current Staff</CardTitle>
                <CardDescription>
                  All staff members with access to this clinic
                </CardDescription>
              </div>
            </div>
            {!invitationsLoading && staffMembers.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {staffMembers.length} member{staffMembers.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : staffMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No staff members yet</p>
              <p className="text-xs mt-1">
                Invite team members using the form below
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
                    <th className="pb-2 font-medium text-muted-foreground">Last Login</th>
                    <th className="pb-2 font-medium text-muted-foreground">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staffMembers.map((member) => (
                    <tr key={member.id} className="group">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                              ROLE_AVATAR_COLORS[member.role] || "bg-muted"
                            } ${
                              member.role === "CLINIC_ADMIN"
                                ? "text-brand"
                                : member.role === "CLINIC_RECEPTION"
                                  ? "text-sky-700 dark:text-sky-300"
                                  : "text-purple-700 dark:text-purple-300"
                            }`}
                          >
                            {getInitials(member.name)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium block truncate">
                              {member.name}
                            </span>
                            {/* Show "You" indicator for current user */}
                            {user?.id === member.id && (
                              <span className="text-[10px] text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{member.email}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            ROLE_COLORS[member.role] || ROLE_COLORS.CLINIC_RECEPTION
                          }`}
                        >
                          {member.role === "CLINIC_ADMIN" && (
                            <Shield className="size-3" />
                          )}
                          {ROLE_LABELS[member.role] || member.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <LogIn className="size-3 opacity-40" />
                          <span className="text-xs" title={formatDateTime(member.lastLoginAt)}>
                            {getRelativeTime(member.lastLoginAt)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground text-xs">
                        {formatDate(member.createdAt)}
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
            <div className="rounded-lg border border-brand-border bg-brand-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-5 text-brand" />
                <p className="text-sm font-medium text-brand">
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

      {/* Card 3: Invitations History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
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
            {!invitationsLoading && invitations.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {invitations.length}
              </Badge>
            )}
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
              <p className="text-xs mt-1">
                Invitations will appear here after sending
              </p>
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
                              ? "bg-brand-muted"
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
                          onClick={() => confirmRevokeInvitation(inv)}
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
      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation for{" "}
              <span className="font-semibold text-foreground">
                {revokingInvitation?.email}
              </span>
              ? This action cannot be undone and the invitation link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={revokeInvitation}
              disabled={revokeLoading}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {revokeLoading ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
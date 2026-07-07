"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  UserPlus,
  Search,
  Send,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  Users,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pencil,
  Ban,
  Copy,
  Link2,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// ---- Types ----
interface ClinicOption {
  id: string;
  name: string;
  city: string | null;
  status: string;
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  clinicId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  clinicName: string | null;
  invitedByName: string | null;
  invitationInfo: {
    inviterName: string | null;
    invitationRole: string;
    invitationCreatedAt: string;
    invitationAcceptedAt: string | null;
  } | null;
}

interface InvitationRecord {
  id: string;
  email: string;
  role: string;
  clinicId: string;
  clinicName: string;
  invitedByName: string | null;
  status: "Pending" | "Accepted" | "Expired";
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByName: string | null;
}

// ---- Role Helpers ----
const ROLE_LABELS: Record<string, string> = {
  SYSTEM_MANAGER: "System Manager",
  CLINIC_ADMIN: "Clinic Admin",
  CLINIC_RECEPTION: "Receptionist",
};

const ROLE_COLORS: Record<string, string> = {
  SYSTEM_MANAGER: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  CLINIC_ADMIN: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CLINIC_RECEPTION: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const INVITATION_STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  Expired: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---- Component ----
export default function AdminUsersPage() {
  // Data states
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitationsLoading, setInvitationsLoading] = useState(true);

  // Search / filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Create user form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "CLINIC_RECEPTION" as string,
    clinicId: "" as string,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Invite form
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "CLINIC_ADMIN" as string,
    clinicId: "" as string,
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Edit dialog
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "" as string,
    clinicId: "" as string,
    newPassword: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  // Deactivate dialog
  const [deactivateUser, setDeactivateUser] = useState<UserRecord | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // Fetch data
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast.error("Failed to load users");
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/admin/users/invitations");
      if (!res.ok) throw new Error("Failed to fetch invitations");
      const data = await res.json();
      setInvitations(data.invitations || []);
    } catch {
      toast.error("Failed to load invitations");
    }
  }, []);

  const fetchClinics = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/admin/users/clinics");
      if (!res.ok) throw new Error("Failed to fetch clinics");
      const data = await res.json();
      setClinics(data.clinics || []);
    } catch {
      toast.error("Failed to load clinics");
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchInvitations(), fetchClinics()]).finally(() => {
      setLoading(false);
      setInvitationsLoading(false);
    });
  }, [fetchUsers, fetchInvitations, fetchClinics]);

  // ---- Handlers ----
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const payload: Record<string, string | null> = {
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
        clinicId: createForm.role === "SYSTEM_MANAGER" ? null : createForm.clinicId,
      };
      const res = await fetch("/api/staff/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      toast.success(`User "${createForm.name}" created successfully`);
      setCreateForm({ name: "", email: "", password: "", role: "CLINIC_RECEPTION", clinicId: "" });
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteLink(null);
    try {
      const payload: Record<string, string> = {
        email: inviteForm.email,
        role: inviteForm.role,
        clinicId: inviteForm.clinicId,
      };
      const res = await fetch("/api/staff/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invitation");
      toast.success(`Invitation sent to ${inviteForm.email}`);
      setInviteLink(data.invitationLink || null);
      setInviteForm({ email: "", role: "CLINIC_ADMIN", clinicId: "" });
      fetchInvitations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleEdit = (user: UserRecord) => {
    setEditUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      clinicId: user.clinicId || "",
      newPassword: "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: editForm.name,
        role: editForm.role,
        clinicId: editForm.role === "SYSTEM_MANAGER" ? null : (editForm.clinicId || null),
      };
      if (editForm.newPassword) {
        payload.newPassword = editForm.newPassword;
      }
      const res = await fetch(`/api/staff/admin/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      toast.success(`User "${editForm.name}" updated`);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    setDeactivateLoading(true);
    try {
      const res = await fetch(`/api/staff/admin/users/${deactivateUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to deactivate user");
      toast.success(data.message || "User deactivated");
      setDeactivateUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate user");
    } finally {
      setDeactivateLoading(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // ---- Render ----
  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* =================== CARD 1: Create User / Invite =================== */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <UserPlus className="size-5 text-purple-700 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Create User</CardTitle>
              <CardDescription>
                Create staff accounts directly or send invitation links
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Toggle between create and invite */}
          <div className="flex gap-2 mb-5">
            <Button
              variant={!showInviteForm ? "default" : "outline"}
              size="sm"
              onClick={() => setShowInviteForm(false)}
              className={!showInviteForm ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
            >
              <UserPlus className="size-4 mr-1.5" />
              Create User
            </Button>
            <Button
              variant={showInviteForm ? "default" : "outline"}
              size="sm"
              onClick={() => { setShowInviteForm(true); setInviteLink(null); }}
              className={showInviteForm ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
            >
              <Send className="size-4 mr-1.5" />
              Send Invitation Link
            </Button>
          </div>

          {!showInviteForm ? (
            /* Create User Form */
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  placeholder="John Doe"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="user@example.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Password</Label>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">Role</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v, clinicId: v === "SYSTEM_MANAGER" ? "" : f.clinicId }))}
                >
                  <SelectTrigger id="create-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYSTEM_MANAGER">System Manager</SelectItem>
                    <SelectItem value="CLINIC_ADMIN">Clinic Admin</SelectItem>
                    <SelectItem value="CLINIC_RECEPTION">Receptionist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {createForm.role !== "SYSTEM_MANAGER" && (
                <div className="space-y-2">
                  <Label htmlFor="create-clinic">Clinic</Label>
                  <Select
                    value={createForm.clinicId}
                    onValueChange={(v) => setCreateForm((f) => ({ ...f, clinicId: v }))}
                  >
                    <SelectTrigger id="create-clinic">
                      <SelectValue placeholder="Select clinic" />
                    </SelectTrigger>
                    <SelectContent>
                      {clinics.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={createLoading || !createForm.name || !createForm.email || !createForm.password || (createForm.role !== "SYSTEM_MANAGER" && !createForm.clinicId)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {createLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <UserPlus className="size-4 mr-2" />}
                  Create User
                </Button>
              </div>
            </form>
          ) : (
            /* Invitation Form */
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v, clinicId: v === "SYSTEM_MANAGER" ? "" : f.clinicId }))}
                  >
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLINIC_ADMIN">Clinic Admin</SelectItem>
                      <SelectItem value="CLINIC_RECEPTION">Receptionist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {inviteForm.role !== "SYSTEM_MANAGER" && (
                  <div className="space-y-2">
                    <Label htmlFor="invite-clinic">Clinic</Label>
                    <Select
                      value={inviteForm.clinicId}
                      onValueChange={(v) => setInviteForm((f) => ({ ...f, clinicId: v }))}
                    >
                      <SelectTrigger id="invite-clinic">
                        <SelectValue placeholder="Select clinic" />
                      </SelectTrigger>
                      <SelectContent>
                        {clinics.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={inviteLoading || !inviteForm.email || (inviteForm.role !== "SYSTEM_MANAGER" && !inviteForm.clinicId)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {inviteLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
                  Send Invitation
                </Button>
              </div>

              {/* Show invite link after sending */}
              {inviteLink && (
                <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                        Invitation link generated!
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <code className="text-xs bg-white dark:bg-gray-900 px-2 py-1 rounded border truncate max-w-md block">
                          {inviteLink}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(inviteLink);
                            toast.success("Link copied to clipboard");
                          }}
                        >
                          <Copy className="size-3.5 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>

      {/* =================== CARD 2: Staff Directory =================== */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Users className="size-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Staff Directory</CardTitle>
                <CardDescription>
                  {users.length} staff {users.length === 1 ? "member" : "members"} across all clinics
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  <SelectItem value="SYSTEM_MANAGER">System Manager</SelectItem>
                  <SelectItem value="CLINIC_ADMIN">Clinic Admin</SelectItem>
                  <SelectItem value="CLINIC_RECEPTION">Receptionist</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-10">
              <Users className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery || roleFilter !== "ALL"
                  ? "No users match your filters"
                  : "No staff users found"}
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden lg:table-cell">Clinic</TableHead>
                    <TableHead className="hidden lg:table-cell">Invited By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className={!user.isActive ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={ROLE_COLORS[user.role] || ""}>
                          {ROLE_LABELS[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {user.clinicName || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {user.invitedByName || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {formatShortDate(user.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(user)}
                            title="Edit user"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {user.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => setDeactivateUser(user)}
                              title="Deactivate user"
                            >
                              <Ban className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =================== CARD 3: Invitation History =================== */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Link2 className="size-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Invitation History</CardTitle>
              <CardDescription>
                All staff invitation records across all clinics
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-10">
              <Mail className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No invitations have been sent yet
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden lg:table-cell">Clinic</TableHead>
                    <TableHead className="hidden md:table-cell">Invited By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="hidden xl:table-cell">Accepted At</TableHead>
                    <TableHead className="hidden xl:table-cell">Accepted By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={ROLE_COLORS[inv.role] || ""}>
                          {ROLE_LABELS[inv.role] || inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {inv.clinicName}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {inv.invitedByName || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={INVITATION_STATUS_STYLES[inv.status] || ""}
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {formatShortDate(inv.createdAt)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground">
                        {formatShortDate(inv.acceptedAt)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground">
                        {inv.acceptedByName || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =================== Edit User Dialog =================== */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update role, clinic assignment, or reset password for {editUser?.name}
            </DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, role: v, clinicId: v === "SYSTEM_MANAGER" ? "" : f.clinicId }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYSTEM_MANAGER">System Manager</SelectItem>
                    <SelectItem value="CLINIC_ADMIN">Clinic Admin</SelectItem>
                    <SelectItem value="CLINIC_RECEPTION">Receptionist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.role !== "SYSTEM_MANAGER" && (
                <div className="space-y-2">
                  <Label>Clinic</Label>
                  <Select
                    value={editForm.clinicId}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, clinicId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select clinic" />
                    </SelectTrigger>
                    <SelectContent>
                      {clinics.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>New Password (leave blank to keep current)</Label>
                <Input
                  type="password"
                  placeholder="Enter new password to reset"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm((f) => ({ ...f, newPassword: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters. Leave empty to keep the current password.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editLoading || !editForm.name}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {editLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================== Deactivate Confirmation =================== */}
      <AlertDialog open={!!deactivateUser} onOpenChange={(open) => !open && setDeactivateUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="size-5 text-red-500" />
              Deactivate User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <strong>{deactivateUser?.name}</strong> ({deactivateUser?.email})? They will
              no longer be able to log in. This can be reversed by editing the user later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={deactivateLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deactivateLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { STAFF_ROLE, isValidStaffRole } from "@/lib/enums";

// =============================================================================
// GET /api/staff/admin/users
// Lists ALL staff users with role, clinic, last login, invitation info.
// Enriched with inviter name from StaffInvitation.createdBy → User.name.
// SYSTEM_MANAGER only.
// =============================================================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all users with clinic info
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clinicId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        clinic: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch all invitations with creator info to enrich users
    const allInvitations = await db.staffInvitation.findMany({
      select: {
        email: true,
        role: true,
        createdBy: true,
        createdAt: true,
        acceptedAt: true,
        acceptedBy: true,
      },
    });

    // Build a map: email → most recent invitation with creator name
    const creatorIds = allInvitations
      .map((inv) => inv.createdBy)
      .filter((id): id is string => !!id);

    const creatorMap = new Map<string, string>();
    if (creatorIds.length > 0) {
      const creators = await db.user.findMany({
        where: { id: { in: [...new Set(creatorIds)] } },
        select: { id: true, name: true },
      });
      for (const c of creators) {
        creatorMap.set(c.id, c.name);
      }
    }

    // Build email → invitation info map (use the first matching invitation)
    const invitationMap = new Map<
      string,
      {
        inviterName: string | null;
        invitationRole: string;
        invitationCreatedAt: string;
        invitationAcceptedAt: string | null;
      }
    >();
    for (const inv of allInvitations) {
      if (!invitationMap.has(inv.email)) {
        invitationMap.set(inv.email, {
          inviterName: inv.createdBy ? (creatorMap.get(inv.createdBy) ?? null) : null,
          invitationRole: inv.role,
          invitationCreatedAt: inv.createdAt.toISOString(),
          invitationAcceptedAt: inv.acceptedAt?.toISOString() ?? null,
        });
      }
    }

    // Enrich users with invitation data
    const enrichedUsers = users.map((user) => {
      const invInfo = invitationMap.get(user.email);
      return {
        ...user,
        clinicName: user.clinic?.name ?? null,
        invitedByName: invInfo?.inviterName ?? null,
        invitationInfo: invInfo ?? null,
      };
    });

    return NextResponse.json({ users: enrichedUsers });
  } catch (error) {
    console.error("[ADMIN_USERS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/staff/admin/users
// Create new user directly (for System Managers, Clinic Admins).
// SYSTEM_MANAGER only.
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, password, role, clinicId } = body;

    // Validate required fields
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters" },
        { status: 400 }
      );
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (!role || !isValidStaffRole(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be SYSTEM_MANAGER, CLINIC_ADMIN, or CLINIC_RECEPTION" },
        { status: 400 }
      );
    }

    // Clinic validation: required for CLINIC_ADMIN and CLINIC_RECEPTION, null for SYSTEM_MANAGER
    if (role === STAFF_ROLE.SYSTEM_MANAGER && clinicId) {
      return NextResponse.json(
        { error: "SYSTEM_MANAGER cannot be bound to a clinic" },
        { status: 400 }
      );
    }
    if (role !== STAFF_ROLE.SYSTEM_MANAGER && !clinicId) {
      return NextResponse.json(
        { error: `${role} requires a clinic assignment` },
        { status: 400 }
      );
    }

    // Verify clinic exists if clinicId is provided
    if (clinicId) {
      const clinic = await db.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true },
      });
      if (!clinic) {
        return NextResponse.json(
          { error: "Clinic not found" },
          { status: 404 }
        );
      }
    }

    const normalizedEmail = email.toLowerCase().trim();
    const trimmedName = name.trim();

    // Check for existing user
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: trimmedName,
        passwordHash,
        role,
        clinicId: clinicId || null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clinicId: true,
        isActive: true,
        createdAt: true,
        clinic: { select: { name: true } },
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.USER_CREATED,
      targetType: "USER",
      targetId: user.id,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_USERS_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
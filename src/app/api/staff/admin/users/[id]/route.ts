import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { STAFF_ROLE, isValidStaffRole } from "@/lib/enums";

// =============================================================================
// PATCH /api/staff/admin/users/[id]
// Edit user: change role, clinic binding, active status, reset password.
// SYSTEM_MANAGER only.
// =============================================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, role, clinicId, isActive, newPassword } = body;

    // Verify user exists
    const existingUser = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clinicId: true,
        isActive: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deactivating yourself
    if (id === session.user.id && isActive === false) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 2) {
        return NextResponse.json(
          { error: "Name must be at least 2 characters" },
          { status: 400 }
        );
      }
      updateData.name = trimmed;
    }

    if (role !== undefined) {
      if (!isValidStaffRole(role)) {
        return NextResponse.json(
          { error: "Invalid role" },
          { status: 400 }
        );
      }
      updateData.role = role;

      // Validate clinic binding consistency
      if (role === STAFF_ROLE.SYSTEM_MANAGER) {
        updateData.clinicId = null;
      } else if (!clinicId && !existingUser.clinicId) {
        return NextResponse.json(
          { error: `${role} requires a clinic assignment` },
          { status: 400 }
        );
      }
    }

    if (clinicId !== undefined) {
      const resolvedRole = role || existingUser.role;
      if (resolvedRole === STAFF_ROLE.SYSTEM_MANAGER && clinicId !== null) {
        return NextResponse.json(
          { error: "SYSTEM_MANAGER cannot be bound to a clinic" },
          { status: 400 }
        );
      }
      if (resolvedRole !== STAFF_ROLE.SYSTEM_MANAGER && clinicId) {
        const clinic = await db.clinic.findUnique({
          where: { id: clinicId },
          select: { id: true },
        });
        if (!clinic) {
          return NextResponse.json(
            { error: "Clinic not found" },
            { status: 404 }
          );
        }
      }
      updateData.clinicId = clinicId;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    if (newPassword) {
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 }
        );
      }
      updateData.passwordHash = await hashPassword(newPassword);

      await createAuditLog({
        userId: session.user.id,
        action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
        targetType: "USER",
        targetId: id,
      });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        clinicId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        clinic: { select: { name: true } },
      },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.USER_UPDATED,
      targetType: "USER",
      targetId: id,
    });

    return NextResponse.json({
      user: {
        ...updatedUser,
        clinicName: updatedUser.clinic?.name ?? null,
      },
    });
  } catch (error) {
    console.error("[ADMIN_USERS_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/staff/admin/users/[id]
// Deactivate user (set isActive=false, do NOT hard delete).
// SYSTEM_MANAGER only.
// =============================================================================
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Prevent deactivating yourself
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Cannot deactivate your own account" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { id },
      select: { id: true, isActive: true, name: true },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!existingUser.isActive) {
      return NextResponse.json(
        { error: "User is already inactive" },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id },
      data: { isActive: false },
    });

    await createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.USER_DEACTIVATED,
      targetType: "USER",
      targetId: id,
    });

    return NextResponse.json({
      success: true,
      message: `User "${existingUser.name}" has been deactivated`,
    });
  } catch (error) {
    console.error("[ADMIN_USERS_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
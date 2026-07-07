import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";

// =============================================================================
// GET /api/staff/admin/users/invitations
// List ALL StaffInvitation records across all clinics with enriched data.
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

    const invitations = await db.staffInvitation.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        clinicId: true,
        createdBy: true,
        expiresAt: true,
        acceptedAt: true,
        acceptedBy: true,
        createdAt: true,
        clinic: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Collect all creator and acceptor user IDs for batch lookup
    const userIds = new Set<string>();
    for (const inv of invitations) {
      if (inv.createdBy) userIds.add(inv.createdBy);
      if (inv.acceptedBy) userIds.add(inv.acceptedBy);
    }

    const userMap = new Map<string, string>();
    if (userIds.size > 0) {
      const users = await db.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true },
      });
      for (const u of users) {
        userMap.set(u.id, u.name);
      }
    }

    const now = new Date();

    const enriched = invitations.map((inv) => {
      // Determine status
      let status: "Pending" | "Accepted" | "Expired";
      if (inv.acceptedAt) {
        status = "Accepted";
      } else if (inv.expiresAt < now) {
        status = "Expired";
      } else {
        status = "Pending";
      }

      return {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        clinicId: inv.clinicId,
        clinicName: inv.clinic.name,
        invitedByName: inv.createdBy ? (userMap.get(inv.createdBy) ?? null) : null,
        status,
        createdAt: inv.createdAt.toISOString(),
        expiresAt: inv.expiresAt.toISOString(),
        acceptedAt: inv.acceptedAt?.toISOString() ?? null,
        acceptedByName: inv.acceptedBy ? (userMap.get(inv.acceptedBy) ?? null) : null,
      };
    });

    return NextResponse.json({ invitations: enriched });
  } catch (error) {
    console.error("[ADMIN_INVITATIONS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
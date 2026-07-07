// =============================================================================
// Data Seed Trigger — POST /api/staff/admin/data/seed
// =============================================================================
// Triggers demo data re-seeding. Auth-gated: SYSTEM_MANAGER only.
// =============================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { STAFF_ROLE } from "@/lib/enums";
import { createAuditLog } from "@/lib/audit";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // For now, return a message that seed was triggered.
    // In production, this would execute the seed script.
    await createAuditLog({
      userId: user.id,
      action: "DATA_SEED_TRIGGERED",
      targetType: "SYSTEM",
    });

    return NextResponse.json({
      success: true,
      message: "Demo data seed triggered. Run `bun run db:seed` from the CLI to execute the full seed script.",
    });
  } catch (error) {
    console.error("[DATA_SEED]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
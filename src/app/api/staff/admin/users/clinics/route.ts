import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAFF_ROLE } from "@/lib/enums";

// =============================================================================
// GET /api/staff/admin/users/clinics
// Lists all clinics for the clinic dropdown in user management.
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

    const clinics = await db.clinic.findMany({
      select: { id: true, name: true, city: true, status: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ clinics });
  } catch (error) {
    console.error("[ADMIN_CLINICS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
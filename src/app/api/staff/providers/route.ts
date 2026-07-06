import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROVIDER_STATUS } from "@/lib/enums";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId = request.nextUrl.searchParams.get("clinicId") || session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json({ error: "No clinic specified" }, { status: 400 });
    }

    if (session.user.role !== "SYSTEM_MANAGER" && session.user.clinicId && clinicId !== session.user.clinicId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const providers = await db.provider.findMany({
      where: {
        clinicId,
        status: PROVIDER_STATUS.ACTIVE,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        credentials: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("[STAFF_PROVIDERS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
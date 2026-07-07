import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clinicId =
      request.nextUrl.searchParams.get("clinicId") || session.user.clinicId;
    if (!clinicId) {
      return NextResponse.json(
        { error: "No clinic specified" },
        { status: 400 }
      );
    }

    if (
      session.user.role !== "SYSTEM_MANAGER" &&
      session.user.clinicId &&
      clinicId !== session.user.clinicId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { providerId, languageIds } = body as {
      providerId?: string;
      languageIds?: string[];
    };

    if (!providerId) {
      return NextResponse.json(
        { error: "providerId is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(languageIds)) {
      return NextResponse.json(
        { error: "languageIds must be an array" },
        { status: 400 }
      );
    }

    // Verify provider belongs to this clinic
    const provider = await db.provider.findFirst({
      where: { id: providerId, clinicId },
      select: { id: true },
    });

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found or does not belong to this clinic" },
        { status: 404 }
      );
    }

    // Verify all language IDs exist
    const existingLanguages = await db.language.findMany({
      where: { id: { in: languageIds } },
      select: { id: true },
    });
    const existingIds = existingLanguages.map((l) => l.id);

    const invalidIds = languageIds.filter((id) => !existingIds.includes(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid language IDs: ${invalidIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Delete existing and recreate
    await db.$transaction([
      db.providerLanguage.deleteMany({ where: { providerId } }),
      ...languageIds.map((languageId) =>
        db.providerLanguage.create({
          data: { providerId, languageId },
        })
      ),
    ]);

    // Invalidate cache
    const { cache } = await import("@/lib/cache");
    cache.deleteByPrefix("clinic:");

    // Audit log
    const { createAuditLog } = await import("@/lib/audit");
    const { AUDIT_ACTIONS } = await import("@/lib/constants");
    createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.PROVIDER_UPDATED,
      targetType: "Provider",
      targetId: providerId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CLINIC_LANGUAGES_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
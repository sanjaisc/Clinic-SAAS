import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(request: NextRequest) {
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
    const { url, type } = body as { url?: string; type?: string };

    if (!url || !type) {
      return NextResponse.json(
        { error: "Missing url or type" },
        { status: 400 }
      );
    }

    const validTypes = ["logo", "cover", "gallery"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "Invalid type" },
        { status: 400 }
      );
    }

    const clinic = await db.clinic.findUnique({
      where: { id: clinicId },
      select: { logoUrl: true, coverImageUrl: true, galleryUrls: true },
    });

    if (!clinic) {
      return NextResponse.json(
        { error: "Clinic not found" },
        { status: 404 }
      );
    }

    if (type === "logo" && clinic.logoUrl === url) {
      await db.clinic.update({
        where: { id: clinicId },
        data: { logoUrl: null },
      });
    } else if (type === "cover" && clinic.coverImageUrl === url) {
      await db.clinic.update({
        where: { id: clinicId },
        data: { coverImageUrl: null },
      });
    } else if (type === "gallery") {
      let gallery: string[] = [];
      if (clinic.galleryUrls) {
        try {
          gallery = JSON.parse(clinic.galleryUrls);
        } catch {
          gallery = [];
        }
      }
      gallery = gallery.filter((g) => g !== url);
      await db.clinic.update({
        where: { id: clinicId },
        data: { galleryUrls: JSON.stringify(gallery) },
      });
    } else {
      return NextResponse.json(
        { error: "URL does not match the specified type" },
        { status: 400 }
      );
    }

    // Try to delete the physical file (best effort)
    try {
      const filepath = path.join(process.cwd(), "public", url);
      await unlink(filepath);
    } catch {
      // File might not exist, ignore
    }

    // Invalidate cache
    const { cache } = await import("@/lib/cache");
    cache.deleteByPrefix("clinic:");

    // Audit log
    const { createAuditLog } = await import("@/lib/audit");
    const { AUDIT_ACTIONS } = await import("@/lib/constants");
    createAuditLog({
      userId: session.user.id,
      action: AUDIT_ACTIONS.CLINIC_UPDATED,
      targetType: "Clinic",
      targetId: clinicId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CLINIC_PROFILE_MEDIA_DELETE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
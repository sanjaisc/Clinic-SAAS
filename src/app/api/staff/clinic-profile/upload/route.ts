import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const VALID_TYPES = ["logo", "cover", "gallery", "provider-photo"] as const;

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;
    const providerId = formData.get("providerId") as string | null;
    const cropStr = formData.get("crop") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: "Invalid type. Must be: logo, cover, gallery, provider-photo" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 5MB." },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    // Parse crop data
    let crop: { x: number; y: number; width: number; height: number } | null =
      null;
    if (cropStr) {
      try {
        crop = JSON.parse(cropStr);
        if (
          typeof crop.x !== "number" ||
          typeof crop.y !== "number" ||
          typeof crop.width !== "number" ||
          typeof crop.height !== "number" ||
          crop.width <= 0 ||
          crop.height <= 0
        ) {
          return NextResponse.json(
            { error: "Invalid crop parameters" },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Invalid crop JSON" },
          { status: 400 }
        );
      }
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // Determine output dimensions based on type
    let outputWidth: number;
    let outputHeight: number;

    switch (type) {
      case "logo":
      case "provider-photo":
        outputWidth = 400;
        outputHeight = 400;
        break;
      case "cover":
      case "gallery":
        outputWidth = 1200;
        outputHeight = 675;
        break;
      default:
        outputWidth = 800;
        outputHeight = 800;
    }

    // Process with sharp
    let pipeline = sharp(buffer);

    // Apply crop if provided
    if (crop) {
      pipeline = pipeline.extract({
        left: Math.round(crop.x),
        top: Math.round(crop.y),
        width: Math.round(crop.width),
        height: Math.round(crop.height),
      });
    }

    // Resize to target dimensions
    pipeline = pipeline.resize(outputWidth, outputHeight, {
      fit: "cover",
      position: "center",
    });

    // Convert to webp for optimization
    buffer = await pipeline.webp({ quality: 85 }).toBuffer();

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads", "clinic");
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const filename = `${type}-${uuidv4()}.webp`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    await writeFile(filepath, buffer);

    // Build URL path
    const url = `/uploads/clinic/${filename}`;

    // If provider-photo, update provider directly
    if (type === "provider-photo" && providerId) {
      const provider = await db.provider.findFirst({
        where: { id: providerId, clinicId },
      });
      if (provider) {
        await db.provider.update({
          where: { id: providerId },
          data: { photoUrl: url },
        });
      }
      // Invalidate cache
      const { cache } = await import("@/lib/cache");
      cache.deleteByPrefix("clinic:");

      return NextResponse.json({ url });
    }

    // For clinic-level media, update the clinic record
    if (type === "logo") {
      await db.clinic.update({
        where: { id: clinicId },
        data: { logoUrl: url },
      });
    } else if (type === "cover") {
      await db.clinic.update({
        where: { id: clinicId },
        data: { coverImageUrl: url },
      });
    } else if (type === "gallery") {
      const clinic = await db.clinic.findUnique({
        where: { id: clinicId },
        select: { galleryUrls: true },
      });

      let gallery: string[] = [];
      if (clinic?.galleryUrls) {
        try {
          gallery = JSON.parse(clinic.galleryUrls);
        } catch {
          gallery = [];
        }
      }
      gallery.push(url);
      await db.clinic.update({
        where: { id: clinicId },
        data: { galleryUrls: JSON.stringify(gallery) },
      });
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

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[CLINIC_PROFILE_UPLOAD]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
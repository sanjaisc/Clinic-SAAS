import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";
import { cache } from "@/lib/cache";
import { Prisma } from "@prisma/client";

// ─── GET /api/staff/admin/taxonomy/languages ──────────────────────────────────

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== "SYSTEM_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const languages = await db.language.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(languages);
  } catch (error) {
    console.error("[TAXONOMY_LANGUAGES_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── POST /api/staff/admin/taxonomy/languages ─────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== "SYSTEM_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, sortOrder } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      return NextResponse.json({ error: "Language code is required" }, { status: 400 });
    }

    const language = await db.language.create({
      data: {
        name: name.trim(),
        code: code.trim().toLowerCase(),
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.TAXONOMY_LANGUAGE_CREATED,
      targetType: "Language",
      targetId: language.id,
    });

    cache.deleteByPrefix("taxonomy:");

    return NextResponse.json(language, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A language with this name or code already exists" },
        { status: 409 }
      );
    }
    console.error("[TAXONOMY_LANGUAGES_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
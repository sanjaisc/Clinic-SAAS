import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type DoctASessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache, CacheTTL } from "@/lib/cache";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Allowed update fields (whitelist)
// ---------------------------------------------------------------------------
const UPDATABLE_FIELDS = [
  "minDepositCents",
  "maxDepositCents",
  "lockTtlSeconds",
  "slotGenerationWindowDays",
  "waitlistProcessingDelayMin",
  "zeroDepositRequireCard",
  "reviewEmailTriggerHours",
  "platformFeeCents",
] as const;

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

function isUpdatableField(key: string): key is UpdatableField {
  return (UPDATABLE_FIELDS as readonly string[]).includes(key);
}

// ---------------------------------------------------------------------------
// GET — Read the SystemConfig singleton
// ---------------------------------------------------------------------------
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

    const config = await cache.getOrSet("config:system", () => fetchConfig(), CacheTTL.SYSTEM_CONFIG);

    return NextResponse.json(config);
  } catch (error) {
    console.error("[ADMIN_CONFIG_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — Update SystemConfig fields
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== "SYSTEM_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!isUpdatableField(key)) continue;

      // Type-specific validation
      if (key === "zeroDepositRequireCard") {
        if (typeof value !== "boolean") {
          return NextResponse.json(
            { error: `${key} must be a boolean` },
            { status: 400 }
          );
        }
      } else {
        // All other fields are integers
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
          return NextResponse.json(
            { error: `${key} must be a non-negative integer` },
            { status: 400 }
          );
        }
      }

      updateData[key] = value;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Validate deposit bounds: min must be <= max
    if (
      ("minDepositCents" in updateData || "maxDepositCents" in updateData) &&
      typeof updateData.minDepositCents === "number" &&
      typeof updateData.maxDepositCents === "number" &&
      updateData.minDepositCents > updateData.maxDepositCents
    ) {
      return NextResponse.json(
        { error: "minDepositCents cannot exceed maxDepositCents" },
        { status: 400 }
      );
    }

    const config = await db.systemConfig.upsert({
      where: { id: "singleton" },
      update: updateData,
      create: { id: "singleton", ...updateData },
    });

    // Invalidate config cache
    cache.deleteByPrefix("config:");

    // Audit log
    await createAuditLog({
      userId: user.id,
      action: AUDIT_ACTIONS.SYSTEM_CONFIG_UPDATED,
      targetType: "SystemConfig",
      targetId: "singleton",
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("[ADMIN_CONFIG_PATCH]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function fetchConfig() {
  const config = await db.systemConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return config;
}
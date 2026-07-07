// =============================================================================
// Integration Credentials Status — GET /api/staff/admin/integrations
// =============================================================================
// Returns masked status of external integration credentials (Stripe, JWT, Gravity Forms).
// Auth-gated: SYSTEM_MANAGER only.
// =============================================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { DoctASessionUser } from "@/lib/auth";
import { STAFF_ROLE } from "@/lib/enums";

/**
 * Mask a string: show first `prefixLen` chars, then `****`, then last `suffixLen` chars.
 */
function maskValue(value: string, prefixLen = 8, suffixLen = 4): string {
  if (!value) return "";
  if (value.length <= prefixLen + suffixLen) {
    return "*".repeat(value.length);
  }
  return value.slice(0, prefixLen) + "****" + value.slice(-suffixLen);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as DoctASessionUser;
    if (user.role !== STAFF_ROLE.SYSTEM_MANAGER) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stripeKey = process.env.STRIPE_PUBLIC_KEY;
    const jwtSecret = process.env.NEXTAUTH_SECRET;

    return NextResponse.json({
      stripe: {
        configured: !!stripeKey && stripeKey.length > 0,
        publicKey: stripeKey ? maskValue(stripeKey) : "",
      },
      jwt: {
        configured: !!jwtSecret && jwtSecret.length > 0,
        secretMasked: jwtSecret ? maskValue(jwtSecret) : "",
      },
      gravityForms: {
        configured: false,
      },
    });
  } catch (error) {
    console.error("[INTEGRATIONS_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
// =============================================================================
// Audit Logging Utility
// =============================================================================
// Action-level logging only (userId, action, targetType, targetId, timestamp).
// NO before/after text payloads to keep DB size manageable — per spec Section 14.
// =============================================================================

import { db } from "@/lib/db";
import { AUDIT_ACTIONS } from "@/lib/constants";

type CreateAuditLogInput = {
  userId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  appointmentId?: string;
  ipAddress?: string;
};

/**
 * Write an audit log entry. Fire-and-forget — errors are logged but never
 * thrown to avoid disrupting the business operation that triggered the log.
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        targetType: input.targetType || null,
        targetId: input.targetId || null,
        appointmentId: input.appointmentId || null,
        ipAddress: input.ipAddress || null,
      },
    });
  } catch (error) {
    // Audit logging should NEVER break business operations
    console.error("[AUDIT] Failed to write audit log:", error);
  }
}

// Re-export AUDIT_ACTIONS for convenient importing
export { AUDIT_ACTIONS };
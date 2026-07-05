// =============================================================================
// Cryptographic Utilities
// =============================================================================
// Handles password hashing (bcrypt) and secure token generation/hashing (Node.js crypto).
// Patient tokens are generated with crypto.randomBytes(32), stored as SHA-256 hashes.
// =============================================================================

import bcrypt from "bcryptjs";
import crypto from "crypto";

// ---- Password Hashing (Staff Accounts) ----

const BCRYPT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt.
 * Used exclusively for staff user account authentication.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * Returns true if the password matches.
 */
export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

// ---- Secure Token Generation (Patient Self-Service) ----

/**
 * The number of random bytes used for token generation.
 * 32 bytes = 256 bits of entropy — cryptographically secure.
 */
export const TOKEN_BYTE_LENGTH = 32;

/**
 * Generate a cryptographically secure random token.
 * Returns the raw hex string (to be sent to the patient via email/URL).
 * This raw token is NEVER stored in the database.
 *
 * Uses Node.js crypto.randomBytes for CSPRNG.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString("hex");
}

/**
 * Hash a raw token using SHA-256 for database storage.
 * We use SHA-256 (not bcrypt) for tokens because:
 * - Tokens are already 256 bits of entropy (no need for slow hash)
 * - We need deterministic hashing for lookup (bcrypt adds salt)
 * - Token validation is a simple constant-time comparison
 *
 * The hex output is 64 characters — stored in Token.tokenHash column.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Validate a raw token against a stored hash.
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 */
export function verifyToken(rawToken: string, storedHash: string): boolean {
  const computedHash = hashToken(rawToken);

  // timingSafeEqual requires Buffer inputs of equal length
  if (computedHash.length !== storedHash.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, "utf-8"),
      Buffer.from(storedHash, "utf-8")
    );
  } catch {
    return false;
  }
}

// ---- IP Hashing (Fraud Detection) ----

/**
 * Hash a client IP address for anonymized storage in audit/fraud detection.
 * Uses SHA-256 with a server-side salt for additional protection.
 */
export function hashIpAddress(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "clinic-platform-default-salt-v1";
  return crypto
    .createHash("sha256")
    .update(ip + salt)
    .digest("hex");
}

// ---- FNV-1a Hash for Client-Side Lock Keys ----

/**
 * Simple fast hash for generating client-side lock keys.
 * Not cryptographically secure — only used for browser session identification.
 */
export function simpleHash(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return (hash >>> 0).toString(16);
}
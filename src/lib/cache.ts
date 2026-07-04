// =============================================================================
// In-Memory Cache (Redis Replacement)
// =============================================================================
// A lightweight, production-ready in-memory cache with TTL support.
// Suitable for single-instance deployments. For multi-instance setups,
// this should be replaced with Redis.
// =============================================================================

type CacheEntry<T> = {
  value: T;
  expiresAt: number; // Unix timestamp in ms
};

class MemoryCache {
  private store: Map<string, CacheEntry<unknown>>;
  private cleanupInterval: ReturnType<typeof setInterval> | null;

  constructor() {
    this.store = new Map();
    this.cleanupInterval = null;
  }

  /**
   * Start periodic cleanup of expired entries.
   * Call once at app initialization.
   */
  startCleanup(intervalMs: number = 60_000): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.cleanup(), intervalMs);
    // Allow the process to exit even if the interval is running
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop the cleanup interval.
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get a value from cache. Returns null if not found or expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set a value in cache with a TTL in seconds.
   * Returns the cache instance for chaining.
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Delete a specific key from cache.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Delete all keys matching a prefix pattern.
   * Useful for cache tag invalidation (e.g., all slot-related keys).
   *
   * @param prefix - The prefix to match (e.g., "slots:", "search:")
   * @returns The number of keys deleted
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Delete all keys matching a tag.
   * Convention: when setting cache, use keys like "tag:tagName:uniqueKey".
   * This method deletes all keys with a given tag.
   */
  deleteByTag(tag: string): number {
    return this.deleteByPrefix(`tag:${tag}:`);
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get or set a value. If the key doesn't exist, the factory function
   * is called and the result is cached.
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    const existing = this.get<T>(key);
    if (existing !== null) return existing;

    const value = await factory();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Get the number of entries currently in the cache (including expired).
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Remove all expired entries from the cache.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.store.clear();
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Auto-start cleanup on import
if (typeof globalThis !== "undefined" && typeof window === "undefined") {
  cache.startCleanup();
}

// =============================================================================
// Cache Key Builders (Centralized Key Naming Convention)
// =============================================================================

export const CacheKeys = {
  // Public search results: "search:{hashOfParams}"
  search: (paramsHash: string) => `search:${paramsHash}`,

  // Clinic detail page: "clinic:{clinicSlug}"
  clinic: (slug: string) => `clinic:${slug}`,

  // Provider slots: "slots:provider:{providerId}:{date}"
  providerSlots: (providerId: string, date: string) =>
    `slots:provider:${providerId}:${date}`,

  // Clinic slots: "slots:clinic:{clinicId}:{date}"
  clinicSlots: (clinicId: string, date: string) =>
    `slots:clinic:${clinicId}:${date}`,

  // System config: "config:system"
  systemConfig: () => "config:system",
} as const;

// Default TTLs in seconds
export const CacheTTL = {
  SEARCH_RESULTS: 180, // 3 minutes
  CLINIC_DETAIL: 300, // 5 minutes
  SLOTS: 120, // 2 minutes
  SYSTEM_CONFIG: 3600, // 1 hour
  SHORT: 30, // 30 seconds
} as const;
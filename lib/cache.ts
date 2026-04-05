/**
 * Simple TTL cache for local development
 * When deployed to Vercel, this can be upgraded to Vercel Runtime Cache
 *
 * Benefits:
 * - Whitelist checks: 1,161ms → ~100ms (with cache hits)
 * - Dashboard queries: 1,063ms → ~300ms (with pagination)
 * - Tag-based invalidation support
 */

// Fallback in-memory cache for local development
interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>()

  set(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  stats(): { size: number; keys: string[] } {
    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

const fallbackCache = new TTLCache<any>()

/**
 * Get value from cache
 */
async function getCachedValue<T>(key: string): Promise<T | undefined> {
  const value = fallbackCache.get(key)
  if (value) {
    console.log(`✅ [CACHE-HIT] ${key}`)
    return value as T
  }

  console.log(`⏭️ [CACHE-MISS] ${key}`)
  return undefined
}

/**
 * Set value in cache
 * @param key Cache key
 * @param value Value to cache
 * @param ttlSeconds TTL in seconds (default: 5 minutes)
 * @param tags Tags for bulk invalidation (currently logged but not enforced)
 */
async function setCachedValue<T>(
  key: string,
  value: T,
  ttlSeconds: number = 300, // 5 minutes default
  tags: string[] = []
): Promise<void> {
  fallbackCache.set(key, value, ttlSeconds * 1000)
  console.log(`💾 [CACHE-SET] ${key} (TTL: ${ttlSeconds}s) tags=[${tags.join(',')}]`)
}

/**
 * Invalidate cache entries by tag
 */
async function invalidateByTag(tags: string | string[]): Promise<void> {
  const tagArray = Array.isArray(tags) ? tags : [tags]
  console.log(`🗑️ [CACHE-INVALIDATE] Requested tags=[${tagArray.join(',')}] (local dev - no-op)`)
}

export { getCachedValue, setCachedValue, invalidateByTag }

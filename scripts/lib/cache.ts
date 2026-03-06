/**
 * File-based cache manager for X API results
 *
 * Stores cached responses as JSON files, keyed by MD5 hash of the query.
 * Each cache category (search, threads, users) has its own subdirectory.
 * Expired entries are cleaned up lazily on read.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

interface CacheEntry {
  data: any;
  cached_at: string;
  expires_at: string;
  ttl_ms: number;
}

export class CacheManager {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Generate a deterministic cache key for a search query + options
   */
  searchKey(query: string, options: Record<string, any> = {}): string {
    const normalized = JSON.stringify({ query: query.toLowerCase().trim(), ...options });
    return crypto.createHash("md5").update(normalized).digest("hex");
  }

  /**
   * Get a cached entry. Returns null if missing or expired.
   */
  get(category: string, key: string): any | null {
    const filePath = this.filePath(category, key);

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const entry: CacheEntry = JSON.parse(raw);

      if (new Date(entry.expires_at).getTime() < Date.now()) {
        // Expired — clean up lazily
        try { fs.unlinkSync(filePath); } catch {}
        return null;
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  /**
   * Store a value in the cache with a given TTL (in milliseconds)
   */
  set(category: string, key: string, data: any, ttlMs: number): void {
    const dir = path.join(this.baseDir, category);
    fs.mkdirSync(dir, { recursive: true });

    const now = new Date();
    const entry: CacheEntry = {
      data,
      cached_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ttlMs).toISOString(),
      ttl_ms: ttlMs,
    };

    fs.writeFileSync(this.filePath(category, key), JSON.stringify(entry, null, 2));
  }

  /**
   * Check if a fresh cache entry exists for this key
   */
  has(category: string, key: string): boolean {
    return this.get(category, key) !== null;
  }

  /**
   * Remove a specific cache entry
   */
  invalidate(category: string, key: string): void {
    try {
      fs.unlinkSync(this.filePath(category, key));
    } catch {}
  }

  /**
   * Clear all entries in a category, or all categories if none specified
   */
  clear(category?: string): void {
    if (category) {
      const dir = path.join(this.baseDir, category);
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          fs.unlinkSync(path.join(dir, file));
        }
      } catch {}
    } else {
      for (const cat of ["search", "threads", "users"]) {
        this.clear(cat);
      }
    }
  }

  /**
   * Get cache stats — useful for debugging
   */
  stats(): Record<string, { entries: number; size_bytes: number }> {
    const result: Record<string, { entries: number; size_bytes: number }> = {};

    for (const category of ["search", "threads", "users"]) {
      const dir = path.join(this.baseDir, category);
      try {
        const files = fs.readdirSync(dir);
        let totalSize = 0;
        for (const file of files) {
          const stat = fs.statSync(path.join(dir, file));
          totalSize += stat.size;
        }
        result[category] = { entries: files.length, size_bytes: totalSize };
      } catch {
        result[category] = { entries: 0, size_bytes: 0 };
      }
    }

    return result;
  }

  private filePath(category: string, key: string): string {
    return path.join(this.baseDir, category, `${key}.json`);
  }
}

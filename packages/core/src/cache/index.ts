/**
 * cache/index.ts — SHA-256 keyed LLM response cache.
 *
 * Cache key: SHA-256 of (functionCode + sorted testTypes + model)
 * Cache dir: <cwd>/.codecheck-cache/
 * Cache TTL: config.cacheTtlDays (default 7 days)
 *
 * A cache hit means: same function code + same test types requested + same model
 * → skip the LLM call and reuse the previous test cases.
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { CacheEntry, TestCase, TestType } from '../types.js'

const CACHE_DIR_NAME = '.codecheck-cache'

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a cache key from the function code, requested test types, and model.
 */
export function computeCacheKey(
  functionCode: string,
  testTypes: TestType[],
  model: string
): string {
  const sorted = [...testTypes].sort().join(',')
  const input = `${functionCode}|${sorted}|${model}`
  return crypto.createHash('sha256').update(input).digest('hex')
}

/**
 * Look up cached test cases. Returns null if:
 *   - No cache file exists
 *   - Cache file is older than ttlDays
 *   - Cache file is malformed JSON
 */
export async function getCached(
  key: string,
  cwd: string,
  ttlDays: number
): Promise<TestCase[] | null> {
  const filePath = cacheFilePath(key, cwd)

  try {
    const stat = await fs.stat(filePath)
    if (!isFresh(stat.mtime, ttlDays)) return null

    const raw = await fs.readFile(filePath, 'utf-8')
    const entry: CacheEntry = JSON.parse(raw) as CacheEntry
    return entry.testCases
  } catch {
    return null
  }
}

/**
 * Write test cases to the cache.
 * Creates the cache directory if it doesn't exist.
 */
export async function setCached(
  key: string,
  testCases: TestCase[],
  model: string,
  cwd: string
): Promise<void> {
  const dir = cacheDirPath(cwd)
  await fs.mkdir(dir, { recursive: true })

  const entry: CacheEntry = {
    testCases,
    generatedAt: new Date().toISOString(),
    model,
  }

  await fs.writeFile(cacheFilePath(key, cwd), JSON.stringify(entry, null, 2), 'utf-8')
}

/**
 * Delete the entire cache directory. Used by `codecheck --clear-cache`.
 */
export async function clearCache(cwd: string): Promise<void> {
  await fs.rm(cacheDirPath(cwd), { recursive: true, force: true })
}

/**
 * Return stats about the cache (number of entries, total size).
 */
export async function getCacheStats(cwd: string): Promise<{ entries: number; sizeBytes: number }> {
  const dir = cacheDirPath(cwd)
  try {
    const files = await fs.readdir(dir)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))
    let totalSize = 0
    for (const file of jsonFiles) {
      const stat = await fs.stat(path.join(dir, file))
      totalSize += stat.size
    }
    return { entries: jsonFiles.length, sizeBytes: totalSize }
  } catch {
    return { entries: 0, sizeBytes: 0 }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cacheDirPath(cwd: string): string {
  return path.join(cwd, CACHE_DIR_NAME)
}

function cacheFilePath(key: string, cwd: string): string {
  return path.join(cacheDirPath(cwd), `${key}.json`)
}

function isFresh(mtime: Date, ttlDays: number): boolean {
  if (ttlDays <= 0) return true // 0 = never expire
  const ageMs = Date.now() - mtime.getTime()
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000
  return ageMs < ttlMs
}

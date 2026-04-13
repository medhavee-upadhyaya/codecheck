import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { computeCacheKey, getCached, setCached, clearCache, getCacheStats } from '../cache/index.js'
import type { TestCase } from '../types.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const sampleCases: TestCase[] = [
  {
    description: 'adds two numbers',
    input: [1, 2],
    expectedOutput: 3,
    category: 'happy-path',
    testType: 'unit',
    shouldThrow: false,
  },
]

let tmpDir: string

beforeEach(async () => {
  // Use a fresh temp directory for each test to avoid cross-test pollution
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codecheck-cache-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ─── computeCacheKey ──────────────────────────────────────────────────────────

describe('computeCacheKey', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const key = computeCacheKey('function code', ['unit'], 'claude-sonnet-4-6')
    expect(key).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces the same key for identical inputs', () => {
    const key1 = computeCacheKey('fn code', ['unit', 'smoke'], 'model')
    const key2 = computeCacheKey('fn code', ['unit', 'smoke'], 'model')
    expect(key1).toBe(key2)
  })

  it('produces different keys when code differs', () => {
    const key1 = computeCacheKey('function a() {}', ['unit'], 'model')
    const key2 = computeCacheKey('function b() {}', ['unit'], 'model')
    expect(key1).not.toBe(key2)
  })

  it('produces the same key regardless of testTypes order', () => {
    const key1 = computeCacheKey('code', ['unit', 'smoke'], 'model')
    const key2 = computeCacheKey('code', ['smoke', 'unit'], 'model')
    expect(key1).toBe(key2)
  })

  it('produces different keys when model differs', () => {
    const key1 = computeCacheKey('code', ['unit'], 'claude-sonnet-4-6')
    const key2 = computeCacheKey('code', ['unit'], 'gpt-4o')
    expect(key1).not.toBe(key2)
  })
})

// ─── getCached / setCached ────────────────────────────────────────────────────

describe('getCached + setCached', () => {
  it('returns null when no cache entry exists', async () => {
    const result = await getCached('nonexistent-key', tmpDir, 7)
    expect(result).toBeNull()
  })

  it('returns test cases after writing to cache', async () => {
    const key = computeCacheKey('fn code', ['unit'], 'model')
    await setCached(key, sampleCases, 'model', tmpDir)

    const result = await getCached(key, tmpDir, 7)
    expect(result).not.toBeNull()
    expect(result).toHaveLength(1)
    expect(result?.[0]?.description).toBe('adds two numbers')
  })

  it('creates the .codecheck-cache directory automatically', async () => {
    const key = computeCacheKey('fn code', ['unit'], 'model')
    await setCached(key, sampleCases, 'model', tmpDir)

    const cacheDir = path.join(tmpDir, '.codecheck-cache')
    const stat = await fs.stat(cacheDir)
    expect(stat.isDirectory()).toBe(true)
  })

  it('returns null when TTL has expired (ttlDays = 0 means never-expire)', async () => {
    // TTL of 0 days = never expire — test cache IS returned
    const key = computeCacheKey('fn', ['unit'], 'model')
    await setCached(key, sampleCases, 'model', tmpDir)
    const result = await getCached(key, tmpDir, 0)
    expect(result).not.toBeNull()
  })

  it('returns null for a different cache key', async () => {
    const key1 = computeCacheKey('fn1', ['unit'], 'model')
    const key2 = computeCacheKey('fn2', ['unit'], 'model')
    await setCached(key1, sampleCases, 'model', tmpDir)

    const result = await getCached(key2, tmpDir, 7)
    expect(result).toBeNull()
  })

  it('preserves all test case fields round-trip', async () => {
    const complexCase: TestCase = {
      description: 'complex case',
      input: { key: 'value', nested: { arr: [1, 2, 3] } },
      expectedOutput: true,
      category: 'edge-case',
      testType: 'integration',
      shouldThrow: false,
    }
    const key = computeCacheKey('code', ['integration'], 'model')
    await setCached(key, [complexCase], 'model', tmpDir)

    const result = await getCached(key, tmpDir, 7)
    expect(result?.[0]).toMatchObject(complexCase)
  })
})

// ─── clearCache ───────────────────────────────────────────────────────────────

describe('clearCache', () => {
  it('removes the entire .codecheck-cache directory', async () => {
    const key = computeCacheKey('fn', ['unit'], 'model')
    await setCached(key, sampleCases, 'model', tmpDir)

    await clearCache(tmpDir)

    const cacheDir = path.join(tmpDir, '.codecheck-cache')
    await expect(fs.stat(cacheDir)).rejects.toThrow()
  })

  it('does not throw if cache directory does not exist', async () => {
    await expect(clearCache(tmpDir)).resolves.not.toThrow()
  })
})

// ─── getCacheStats ────────────────────────────────────────────────────────────

describe('getCacheStats', () => {
  it('returns zero entries when cache is empty', async () => {
    const stats = await getCacheStats(tmpDir)
    expect(stats.entries).toBe(0)
    expect(stats.sizeBytes).toBe(0)
  })

  it('counts written entries correctly', async () => {
    const key1 = computeCacheKey('fn1', ['unit'], 'model')
    const key2 = computeCacheKey('fn2', ['smoke'], 'model')
    await setCached(key1, sampleCases, 'model', tmpDir)
    await setCached(key2, sampleCases, 'model', tmpDir)

    const stats = await getCacheStats(tmpDir)
    expect(stats.entries).toBe(2)
    expect(stats.sizeBytes).toBeGreaterThan(0)
  })
})

/**
 * engine.test.ts — Integration tests for CodeCheckEngine.
 *
 * Uses MockLLMClient (no API calls) and a mock runner (no Jest subprocess).
 * Tests the full pipeline: filter → extract → cache → generate → run → results.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CodeCheckEngine } from '../engine.js'
import { MockLLMClient } from '../llm/client.js'
import { configDefaults } from '../config.js'
import type { CodeCheckConfig, GeneratedTestFile, ScopePlugin, TestResult, TestTarget } from '../types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, 'fixtures')
const sampleTsPath = path.join(fixturesDir, 'sample.ts')

// ─── Mock Runner ──────────────────────────────────────────────────────────────

/** Returns all test cases as passed — no subprocess spawned */
const mockRunner = async (
  file: GeneratedTestFile,
  _config: CodeCheckConfig,
  _cwd: string
): Promise<TestResult[]> => {
  return file.testCases.map((tc) => ({
    testCase: tc,
    target: file.target,
    passed: true,
    duration: 1,
  }))
}

/** Returns all test cases as failed */
const failingRunner = async (
  file: GeneratedTestFile,
  _config: CodeCheckConfig,
  _cwd: string
): Promise<TestResult[]> => {
  return file.testCases.map((tc) => ({
    testCase: tc,
    target: file.target,
    passed: false,
    duration: 1,
    error: 'Expected 3, received 4',
  }))
}

// ─── Minimal Scope Plugin ─────────────────────────────────────────────────────

const unitScopePlugin: ScopePlugin = {
  name: 'unit',
  testTypes: ['unit'],
  async extractTargets(files, _config) {
    // Delegate to the real extractor — we want to test real extraction
    const { extractTargets } = await import('../extractor/index.js')
    const groups = await Promise.all(files.map((f) => extractTargets(f).catch(() => [])))
    return groups.flat()
  },
  buildPrompt(_target, _testType) {
    return 'Generate thorough unit tests covering edge cases and boundaries.'
  },
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

let tmpDir: string
let config: CodeCheckConfig

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codecheck-engine-test-'))
  config = {
    ...configDefaults,
    testTypes: ['unit', 'smoke'],
    threshold: 0.8,
    exclude: ['node_modules', 'dist', '*.test.ts', '*.spec.ts'],
    cacheTtlDays: 7,
    keepGeneratedTests: false,
  }
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CodeCheckEngine.run()', () => {
  it('returns an empty array when no files are provided', async () => {
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: mockRunner,
    })
    const results = await engine.run([])
    expect(results).toEqual([])
  })

  it('returns results for a real TypeScript fixture file', async () => {
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: mockRunner,
    })
    const results = await engine.run([sampleTsPath])
    expect(results.length).toBeGreaterThan(0)
  })

  it('each result has required fields', async () => {
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: mockRunner,
    })
    const results = await engine.run([sampleTsPath])

    for (const result of results) {
      expect(typeof result.passed).toBe('boolean')
      expect(typeof result.duration).toBe('number')
      expect(result.testCase).toBeDefined()
      expect(result.target).toBeDefined()
      expect(typeof result.target.name).toBe('string')
    }
  })

  it('all results pass when using the passing mock runner', async () => {
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: mockRunner,
    })
    const results = await engine.run([sampleTsPath])
    expect(results.every((r) => r.passed)).toBe(true)
  })

  it('all results fail when using the failing mock runner', async () => {
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: failingRunner,
    })
    const results = await engine.run([sampleTsPath])
    expect(results.every((r) => !r.passed)).toBe(true)
  })

  it('filters out excluded files', async () => {
    const engineConfig: CodeCheckConfig = {
      ...config,
      exclude: ['*.ts'], // exclude all TS files
    }
    const engine = new CodeCheckEngine(engineConfig, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: mockRunner,
    })
    const results = await engine.run([sampleTsPath])
    expect(results).toEqual([])
  })

  it('handles unsupported file types gracefully (no crash)', async () => {
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: mockRunner,
    })
    // .rb is not supported — should not throw
    const results = await engine.run(['/fake/path/script.rb'])
    // Either empty results or error results — either is fine
    expect(Array.isArray(results)).toBe(true)
  })

  it('handles non-existent files gracefully (no crash)', async () => {
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: mockRunner,
    })
    const results = await engine.run(['/does/not/exist.ts'])
    expect(Array.isArray(results)).toBe(true)
  })

  it('uses the LLM cache on the second run (MockLLMClient call count stays same after cache hit)', async () => {
    const mockClient = new MockLLMClient()
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: mockClient,
      runnerFn: mockRunner,
    })

    await engine.run([sampleTsPath])
    const callsAfterFirst = mockClient.calls

    // Second run with same files — results should come from cache
    await engine.run([sampleTsPath])
    expect(mockClient.calls).toBe(callsAfterFirst) // no new LLM calls
  })

  it('produces results referencing multiple extracted functions', async () => {
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: mockRunner,
    })
    const results = await engine.run([sampleTsPath])

    // sample.ts has 6+ exported targets — verify we get results for multiple
    const uniqueTargets = new Set(results.map((r) => r.target.name))
    expect(uniqueTargets.size).toBeGreaterThan(2)
  })
})

// ─── File Filtering ───────────────────────────────────────────────────────────

describe('File filtering', () => {
  it('excludes node_modules paths', async () => {
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: mockRunner,
    })
    const results = await engine.run(['/project/node_modules/lodash/math.ts'])
    expect(results).toEqual([])
  })

  it('excludes dist paths', async () => {
    const engine = new CodeCheckEngine(config, [unitScopePlugin], {
      cwd: tmpDir,
      llmClient: new MockLLMClient(),
      runnerFn: mockRunner,
    })
    const results = await engine.run(['/project/dist/index.ts'])
    expect(results).toEqual([])
  })
})

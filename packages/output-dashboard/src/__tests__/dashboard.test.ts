import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DashboardOutputPlugin, loadJson } from '../index.js'
import type { RunRecord, RunSummary, FlakinessEntry } from '../index.js'
import type { CodeCheckConfig, TestResult, TestCase, TestTarget } from '@codecheck/core'

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['unit'],
    output: ['dashboard'],
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    language: 'typescript',
    framework: 'jest',
    threshold: 0.8,
    exclude: [],
    concurrency: 3,
    failOnError: false,
    keepGeneratedTests: false,
    cacheTtlDays: 7,
    ...overrides,
  }
}

function makeTarget(name = 'add', filePath = '/project/src/math.ts'): TestTarget {
  return {
    filePath,
    name,
    code: 'function add(a, b) { return a + b }',
    language: 'typescript',
    targetType: 'function',
    startLine: 1,
    endLine: 1,
  }
}

function makeResult(overrides: Partial<TestResult> = {}): TestResult {
  const tc: TestCase = {
    description: 'adds two numbers',
    input: [1, 2],
    expectedOutput: 3,
    category: 'happy-path',
    testType: 'unit',
    shouldThrow: false,
  }
  return {
    testCase: tc,
    target: makeTarget(),
    passed: true,
    duration: 12,
    ...overrides,
  }
}

describe('DashboardOutputPlugin', () => {
  let tmpDir: string
  const plugin = new DashboardOutputPlugin()
  const origCwd = process.cwd

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'codecheck-dashboard-test-'))
    // Override process.cwd so the plugin writes to our tmpDir
    process.cwd = () => tmpDir
  })

  afterEach(async () => {
    process.cwd = origCwd
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('has name "dashboard"', () => {
    expect(plugin.name).toBe('dashboard')
  })

  it('creates .codecheck-results/ directory', async () => {
    await plugin.report([makeResult()], makeConfig())
    const { existsSync } = await import('node:fs')
    expect(existsSync(join(tmpDir, '.codecheck-results'))).toBe(true)
  })

  it('writes latest.json with test results', async () => {
    const results = [makeResult(), makeResult({ passed: false })]
    await plugin.report(results, makeConfig())

    const record = await loadJson<RunRecord>(join(tmpDir, '.codecheck-results', 'latest.json'), null as unknown as RunRecord)
    expect(record).not.toBeNull()
    expect(record.results).toHaveLength(2)
    expect(record.summary.totalTests).toBe(2)
    expect(record.summary.passedTests).toBe(1)
  })

  it('computes correct pass rate in summary', async () => {
    const results = [makeResult(), makeResult(), makeResult({ passed: false })]
    await plugin.report(results, makeConfig())

    const record = await loadJson<RunRecord>(join(tmpDir, '.codecheck-results', 'latest.json'), null as unknown as RunRecord)
    expect(record.summary.passRate).toBeCloseTo(2 / 3)
  })

  it('writes history.json and prepends new runs', async () => {
    await plugin.report([makeResult()], makeConfig())
    await plugin.report([makeResult(), makeResult()], makeConfig())

    const history = await loadJson<RunSummary[]>(join(tmpDir, '.codecheck-results', 'history.json'), [])
    expect(history).toHaveLength(2)
    expect(history[0]?.totalTests).toBe(2) // most recent first
    expect(history[1]?.totalTests).toBe(1)
  })

  it('caps history at 50 entries', async () => {
    for (let i = 0; i < 55; i++) {
      await plugin.report([makeResult()], makeConfig())
    }
    const history = await loadJson<RunSummary[]>(join(tmpDir, '.codecheck-results', 'history.json'), [])
    expect(history.length).toBeLessThanOrEqual(50)
  })

  it('writes flakiness.json', async () => {
    await plugin.report([makeResult()], makeConfig())
    const { existsSync } = await import('node:fs')
    expect(existsSync(join(tmpDir, '.codecheck-results', 'flakiness.json'))).toBe(true)
  })

  it('detects flaky tests after 3+ runs with mixed results', async () => {
    // Pass on run 1, fail on run 2, pass on run 3
    await plugin.report([makeResult({ passed: true })], makeConfig())
    await plugin.report([makeResult({ passed: false })], makeConfig())
    await plugin.report([makeResult({ passed: true })], makeConfig())

    const store = await loadJson<Record<string, FlakinessEntry>>(
      join(tmpDir, '.codecheck-results', 'flakiness.json'),
      {},
    )
    const entries = Object.values(store)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.isFlaky).toBe(true)
    expect(entries[0]?.passCount).toBe(2)
    expect(entries[0]?.failCount).toBe(1)
  })

  it('does not flag tests as flaky if fewer than 3 runs', async () => {
    await plugin.report([makeResult({ passed: true })], makeConfig())
    await plugin.report([makeResult({ passed: false })], makeConfig())

    const store = await loadJson<Record<string, FlakinessEntry>>(
      join(tmpDir, '.codecheck-results', 'flakiness.json'),
      {},
    )
    const entries = Object.values(store)
    expect(entries[0]?.isFlaky).toBe(false)
  })

  it('does not flag consistently passing tests as flaky', async () => {
    await plugin.report([makeResult({ passed: true })], makeConfig())
    await plugin.report([makeResult({ passed: true })], makeConfig())
    await plugin.report([makeResult({ passed: true })], makeConfig())

    const store = await loadJson<Record<string, FlakinessEntry>>(
      join(tmpDir, '.codecheck-results', 'flakiness.json'),
      {},
    )
    const entries = Object.values(store)
    expect(entries[0]?.isFlaky).toBe(false)
  })

  it('serializes error messages in results', async () => {
    const failed = makeResult({ passed: false, error: 'AssertionError: expected 5 to equal 3' })
    await plugin.report([failed], makeConfig())

    const record = await loadJson<RunRecord>(join(tmpDir, '.codecheck-results', 'latest.json'), null as unknown as RunRecord)
    expect(record.results[0]?.error).toContain('AssertionError')
  })

  it('handles empty results without throwing', async () => {
    await expect(plugin.report([], makeConfig())).resolves.not.toThrow()
  })
})

describe('loadJson', () => {
  it('returns default when file does not exist', async () => {
    const result = await loadJson('/does/not/exist.json', { default: true })
    expect(result).toEqual({ default: true })
  })

  it('parses existing JSON file', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'codecheck-loadjson-test-'))
    try {
      const filePath = join(tmpDir, 'test.json')
      const { writeFile } = await import('node:fs/promises')
      await writeFile(filePath, JSON.stringify({ hello: 'world' }), 'utf8')
      const result = await loadJson<{ hello: string }>(filePath, { hello: '' })
      expect(result.hello).toBe('world')
    } finally {
      await rm(tmpDir, { recursive: true, force: true })
    }
  })
})

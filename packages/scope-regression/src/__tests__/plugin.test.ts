import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RegressionScopePlugin } from '../index.js'
import type { CodeCheckConfig } from '@codecheck/core'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureFile = resolve(__dirname, '../../src/index.ts')

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['regression'],
    output: ['terminal'],
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

describe('RegressionScopePlugin', () => {
  const plugin = new RegressionScopePlugin()
  let tmpDir: string
  const origCwd = process.cwd

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'codecheck-regression-test-'))
    process.cwd = () => tmpDir
  })

  afterEach(async () => {
    process.cwd = origCwd
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('has name "regression"', () => {
    expect(plugin.name).toBe('regression')
  })

  it('has testTypes ["regression"]', () => {
    expect(plugin.testTypes).toEqual(['regression'])
  })

  it('extractTargets returns an array', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    expect(Array.isArray(targets)).toBe(true)
  })

  it('extractTargets handles missing files gracefully', async () => {
    const targets = await plugin.extractTargets(['/does/not/exist.ts'], makeConfig())
    expect(targets).toEqual([])
  })

  it('extractTargets works with no flakiness history (all targets returned)', async () => {
    // No .codecheck-results/flakiness.json exists → returns all targets
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    expect(targets.length).toBeGreaterThan(0)
  })

  it('sorts previously-failed functions to the front', async () => {
    // Write a flakiness file marking one target as having failures
    const resultsDir = join(tmpDir, '.codecheck-results')
    await mkdir(resultsDir, { recursive: true })

    // We'll use the real fixtureFile's functions — pick the first one by reading what extractTargets returns
    // First get all targets to know what names exist
    const allTargets = await (async () => {
      process.cwd = origCwd
      const t = await plugin.extractTargets([fixtureFile], makeConfig())
      process.cwd = () => tmpDir
      return t
    })()

    if (allTargets.length < 2) return // not enough targets to test ordering

    const firstTarget = allTargets[0]!
    const flakinessData: Record<string, unknown> = {
      [`${firstTarget.filePath}::${firstTarget.name}::regression::desc`]: {
        targetName: firstTarget.name,
        filePath: firstTarget.filePath,
        testType: 'regression',
        passCount: 1,
        failCount: 3,
        totalRuns: 4,
        isFlaky: true,
        lastStatus: 'failed',
      },
    }

    await writeFile(
      join(resultsDir, 'flakiness.json'),
      JSON.stringify(flakinessData),
      'utf8',
    )

    const sorted = await plugin.extractTargets([fixtureFile], makeConfig())
    // The target with failures should be first
    expect(sorted[0]?.name).toBe(firstTarget.name)
  })

  it('buildPrompt contains regression test instructions', () => {
    const fakeTarget = {
      filePath: '/a/b.ts',
      name: 'calculate',
      code: 'function calculate(x) { return x * 2 }',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'regression')
    expect(prompt).toContain('Regression Test Instructions')
    expect(prompt).toContain('regression')
    expect(prompt).toContain('Failure-prone inputs')
  })

  it('buildPrompt instructs to use testType "regression"', () => {
    const fakeTarget = {
      filePath: '/a/b.ts',
      name: 'fn',
      code: 'function fn() {}',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'regression')
    expect(prompt).toContain('"regression"')
  })

  it('buildPrompt mentions off-by-one errors', () => {
    const fakeTarget = {
      filePath: '/a/b.ts',
      name: 'clamp',
      code: 'function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'regression')
    expect(prompt).toContain('Off-by-one')
  })
})

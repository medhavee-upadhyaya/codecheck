import { describe, it, expect } from 'vitest'
import { formatResult, formatSummary, formatHeader, formatNoTargets, formatTargetHeader } from '../formatter.js'
import type { TestResult, CodeCheckConfig, TestTarget, TestCase } from '@codecheck/core'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTarget(overrides: Partial<TestTarget> = {}): TestTarget {
  return {
    filePath: '/project/src/utils.ts',
    name: 'add',
    code: 'export function add(a, b) { return a + b }',
    language: 'typescript',
    targetType: 'function',
    startLine: 1,
    endLine: 1,
    ...overrides,
  }
}

function makeCase(overrides: Partial<TestCase> = {}): TestCase {
  return {
    description: 'returns sum of two numbers',
    input: [1, 2],
    expectedOutput: 3,
    category: 'happy-path',
    testType: 'unit',
    ...overrides,
  }
}

function makeResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    testCase: makeCase(),
    target: makeTarget(),
    passed: true,
    duration: 12,
    ...overrides,
  }
}

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['unit', 'smoke'],
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

// ─── formatResult ─────────────────────────────────────────────────────────────

describe('formatResult', () => {
  it('includes ✓ for passing test', () => {
    const result = makeResult({ passed: true })
    const output = formatResult(result)
    expect(output).toContain('✓')
  })

  it('includes ✗ for failing test', () => {
    const result = makeResult({ passed: false })
    const output = formatResult(result)
    expect(output).toContain('✗')
  })

  it('includes the test description', () => {
    const result = makeResult({ testCase: makeCase({ description: 'my custom test description' }) })
    const output = formatResult(result)
    expect(output).toContain('my custom test description')
  })

  it('includes duration', () => {
    const result = makeResult({ duration: 42 })
    const output = formatResult(result)
    expect(output).toContain('42ms')
  })

  it('includes [cached] for cache hits', () => {
    const result = makeResult({ fromCache: true })
    const output = formatResult(result)
    expect(output).toContain('[cached]')
  })

  it('does not include [cached] when not from cache', () => {
    const result = makeResult({ fromCache: false })
    const output = formatResult(result)
    expect(output).not.toContain('[cached]')
  })

  it('includes error message for failing tests', () => {
    const result = makeResult({ passed: false, error: 'Expected 3 but received 4' })
    const output = formatResult(result)
    expect(output).toContain('Expected 3 but received 4')
  })

  it('includes test type label', () => {
    const result = makeResult({ testCase: makeCase({ testType: 'smoke' }) })
    const output = formatResult(result)
    expect(output).toContain('[smoke]')
  })
})

// ─── formatSummary ────────────────────────────────────────────────────────────

describe('formatSummary', () => {
  it('shows correct pass/fail counts', () => {
    const results = [
      makeResult({ passed: true }),
      makeResult({ passed: true }),
      makeResult({ passed: false }),
    ]
    const output = formatSummary(results, makeConfig())
    expect(output).toContain('2 passed')
    expect(output).toContain('1 failed')
  })

  it('shows 100% pass rate for all passing', () => {
    const results = [makeResult({ passed: true }), makeResult({ passed: true })]
    const output = formatSummary(results, makeConfig())
    expect(output).toContain('100%')
  })

  it('shows threshold warning when below threshold', () => {
    const results = [makeResult({ passed: false }), makeResult({ passed: false })]
    const output = formatSummary(results, makeConfig({ threshold: 0.8, failOnError: true }))
    expect(output).toContain('Below threshold')
  })

  it('shows no-tests message when results are empty', () => {
    const output = formatSummary([], makeConfig())
    expect(output).toContain('No tests generated')
  })

  it('shows cached count when results are from cache', () => {
    const results = [
      makeResult({ passed: true, fromCache: true }),
      makeResult({ passed: true, fromCache: false }),
    ]
    const output = formatSummary(results, makeConfig())
    expect(output).toContain('1 from cache')
  })
})

// ─── formatHeader ─────────────────────────────────────────────────────────────

describe('formatHeader', () => {
  it('includes CodeCheck label', () => {
    const output = formatHeader(3)
    expect(output).toContain('CodeCheck')
  })

  it('includes file count', () => {
    expect(formatHeader(1)).toContain('1 file')
    expect(formatHeader(5)).toContain('5 files')
  })
})

// ─── formatTargetHeader ───────────────────────────────────────────────────────

describe('formatTargetHeader', () => {
  it('includes target name', () => {
    const output = formatTargetHeader('myFunction', '/project/src/utils.ts')
    expect(output).toContain('myFunction')
  })
})

// ─── formatNoTargets ──────────────────────────────────────────────────────────

describe('formatNoTargets', () => {
  it('returns a non-empty string', () => {
    expect(formatNoTargets().length).toBeGreaterThan(0)
  })
})

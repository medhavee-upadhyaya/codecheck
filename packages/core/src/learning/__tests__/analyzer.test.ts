import { describe, it, expect } from 'vitest'
import { humanizeError, updateProfile } from '../analyzer.js'
import { emptyProfile } from '../profile.js'
import type { TestResult } from '../../types.js'

// ─── humanizeError ────────────────────────────────────────────────────────────

describe('humanizeError', () => {
  it('translates "expected X to equal Y"', () => {
    const msg = humanizeError('expected undefined to equal 5')
    expect(msg).toContain('Returned undefined')
    expect(msg).toContain('expected 5')
  })

  it('translates null property access', () => {
    const msg = humanizeError('Cannot read properties of null (reading "name")')
    expect(msg).toContain('null')
    expect(msg).toContain('null check')
  })

  it('translates "is not a function"', () => {
    const msg = humanizeError('obj.greet is not a function')
    expect(msg).toContain('not found')
  })

  it('translates timeout', () => {
    const msg = humanizeError('Timeout of 5000ms exceeded')
    expect(msg).toContain('timed out')
  })

  it('translates did not throw', () => {
    const msg = humanizeError('Expected function to throw but did not throw')
    expect(msg).toContain('throw')
  })

  it('returns first line for unknown errors', () => {
    const msg = humanizeError('Some weird error\nat line 5\nmore details')
    expect(msg).toBe('Some weird error')
  })

  it('never returns empty string', () => {
    expect(humanizeError('')).toBeDefined()
    expect(humanizeError('').length).toBeGreaterThanOrEqual(0)
  })
})

// ─── updateProfile ────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    testCase: {
      description: 'does something useful',
      input: null,
      expectedOutput: null,
      category: 'happy-path',
      testType: 'unit',
    },
    target: {
      filePath: '/a/b.ts',
      name: 'myFn',
      code: 'function myFn() {}',
      language: 'typescript',
      targetType: 'function',
      startLine: 1,
      endLine: 1,
    },
    passed: true,
    duration: 10,
    ...overrides,
  }
}

describe('updateProfile', () => {
  it('increments totalRuns', () => {
    const profile = emptyProfile()
    const updated = updateProfile(profile, [makeResult()])
    expect(updated.totalRuns).toBe(1)
  })

  it('does not mutate the original profile', () => {
    const profile = emptyProfile()
    const updated = updateProfile(profile, [makeResult()])
    expect(profile.totalRuns).toBe(0)
    expect(updated.totalRuns).toBe(1)
  })

  it('tracks pass counts by test type', () => {
    const profile = emptyProfile()
    const results = [
      makeResult({ passed: true, testCase: { description: 'a', input: null, expectedOutput: null, category: 'happy-path', testType: 'unit' } }),
      makeResult({ passed: false, testCase: { description: 'b', input: null, expectedOutput: null, category: 'happy-path', testType: 'unit' }, error: 'TypeError: bad' }),
    ]
    const updated = updateProfile(profile, results)
    expect(updated.passRateByTestType['unit']?.passCount).toBe(1)
    expect(updated.passRateByTestType['unit']?.totalCount).toBe(2)
  })

  it('collects successful examples (max 5)', () => {
    const profile = emptyProfile()
    const results = Array.from({ length: 7 }, (_, i) =>
      makeResult({ passed: true, testCase: { description: `test ${i}`, input: null, expectedOutput: null, category: 'happy-path', testType: 'unit' } })
    )
    const updated = updateProfile(profile, results)
    expect(updated.successfulExamples.length).toBeLessThanOrEqual(5)
  })

  it('records failure reasons', () => {
    const profile = emptyProfile()
    const results = [
      makeResult({ passed: false, error: 'Cannot read properties of null', testCase: { description: 'x', input: null, expectedOutput: null, category: 'null-check', testType: 'unit' } }),
    ]
    const updated = updateProfile(profile, results)
    expect(updated.topFailureReasons.length).toBeGreaterThan(0)
  })

  it('keeps successful examples unique', () => {
    const profile = emptyProfile()
    const results = [
      makeResult({ passed: true, testCase: { description: 'same desc', input: null, expectedOutput: null, category: 'happy-path', testType: 'unit' } }),
      makeResult({ passed: true, testCase: { description: 'same desc', input: null, expectedOutput: null, category: 'happy-path', testType: 'unit' } }),
    ]
    const updated = updateProfile(profile, results)
    const count = updated.successfulExamples.filter((e) => e === 'same desc').length
    expect(count).toBe(1)
  })
})

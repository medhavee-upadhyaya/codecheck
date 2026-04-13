import { describe, it, expect } from 'vitest'
import { buildCommentBody } from '../formatter.js'
import type { TestResult, CodeCheckConfig, TestTarget, TestCase } from '@codecheck/core'

function makeTarget(name = 'add', file = '/project/src/utils.ts'): TestTarget {
  return {
    filePath: file, name, code: 'function add(a,b){return a+b}',
    language: 'typescript', targetType: 'function', startLine: 1, endLine: 1,
  }
}

function makeCase(desc = 'returns correct sum', type: TestCase['testType'] = 'unit'): TestCase {
  return { description: desc, input: [1, 2], expectedOutput: 3, category: 'happy-path', testType: type }
}

function makeResult(overrides: Partial<TestResult> = {}): TestResult {
  return { testCase: makeCase(), target: makeTarget(), passed: true, duration: 10, ...overrides }
}

function makeConfig(threshold = 0.8): CodeCheckConfig {
  return {
    trigger: 'oncommit', testTypes: ['unit'], output: ['github'],
    model: 'claude-sonnet-4-6', provider: 'anthropic', language: 'typescript',
    framework: 'jest', threshold, exclude: [], concurrency: 3,
    failOnError: false, keepGeneratedTests: false, cacheTtlDays: 7,
  }
}

describe('buildCommentBody', () => {
  it('includes CodeCheck Results header', () => {
    const body = buildCommentBody([makeResult()], makeConfig())
    expect(body).toContain('CodeCheck Results')
  })

  it('shows pass count', () => {
    const results = [makeResult({ passed: true }), makeResult({ passed: true })]
    const body = buildCommentBody(results, makeConfig())
    expect(body).toContain('2 passed')
  })

  it('shows fail count', () => {
    const results = [makeResult({ passed: true }), makeResult({ passed: false })]
    const body = buildCommentBody(results, makeConfig())
    expect(body).toContain('1 failed')
  })

  it('shows pass rate percentage', () => {
    const results = [makeResult({ passed: true })]
    const body = buildCommentBody(results, makeConfig())
    expect(body).toContain('100%')
  })

  it('shows threshold warning when below threshold', () => {
    const results = [makeResult({ passed: false }), makeResult({ passed: false })]
    const body = buildCommentBody(results, makeConfig(0.8))
    expect(body).toContain('below the configured threshold')
  })

  it('includes ✅ emoji when above threshold', () => {
    const results = [makeResult({ passed: true })]
    const body = buildCommentBody(results, makeConfig(0.8))
    expect(body).toContain('✅')
  })

  it('includes ❌ emoji when below threshold', () => {
    const results = [makeResult({ passed: false })]
    const body = buildCommentBody(results, makeConfig(0.8))
    expect(body).toContain('❌')
  })

  it('includes function name in output', () => {
    const results = [makeResult({ target: makeTarget('mySpecialFunction') })]
    const body = buildCommentBody(results, makeConfig())
    expect(body).toContain('mySpecialFunction')
  })

  it('includes failure details section for failed tests', () => {
    const results = [makeResult({ passed: false, error: 'Expected 3 received 4' })]
    const body = buildCommentBody(results, makeConfig())
    expect(body).toContain('Failure details')
    expect(body).toContain('Expected 3 received 4')
  })

  it('marks cached results', () => {
    const results = [makeResult({ fromCache: true })]
    const body = buildCommentBody(results, makeConfig())
    expect(body).toContain('from cache')
  })

  it('shows no-tests message when results are empty', () => {
    const body = buildCommentBody([], makeConfig())
    expect(body).toContain('No testable targets')
  })

  it('includes CodeCheck attribution link', () => {
    const body = buildCommentBody([makeResult()], makeConfig())
    expect(body).toContain('CodeCheck')
  })
})

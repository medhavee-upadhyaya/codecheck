import { describe, it, expect } from 'vitest'
import { parseDiagnostics, groupByFile } from '../diagnostics.js'

const validLatestJson = JSON.stringify({
  results: [
    {
      filePath: '/project/src/utils.ts',
      targetName: 'add',
      description: 'adds two numbers correctly',
      passed: false,
      error: 'AssertionError: expected 4 to equal 3',
      startLine: 5,
      endLine: 7,
    },
    {
      filePath: '/project/src/utils.ts',
      targetName: 'add',
      description: 'handles negative numbers',
      passed: false,
      error: 'AssertionError: expected -1 to equal 1',
      startLine: 5,
      endLine: 7,
    },
    {
      filePath: '/project/src/helper.ts',
      targetName: 'trim',
      description: 'trims whitespace',
      passed: true,
      startLine: 1,
      endLine: 3,
    },
  ],
})

describe('parseDiagnostics', () => {
  it('returns DiagnosticRecord[] for failing tests', () => {
    const records = parseDiagnostics(validLatestJson)
    expect(records.length).toBeGreaterThan(0)
    expect(records[0]?.functionName).toBe('add')
    expect(records[0]?.filePath).toBe('/project/src/utils.ts')
  })

  it('deduplicates by function — one diagnostic per failing function, not per test', () => {
    const records = parseDiagnostics(validLatestJson)
    const addRecords = records.filter((r) => r.functionName === 'add')
    expect(addRecords).toHaveLength(1)
  })

  it('excludes passing tests', () => {
    const records = parseDiagnostics(validLatestJson)
    const trimRecords = records.filter((r) => r.functionName === 'trim')
    expect(trimRecords).toHaveLength(0)
  })

  it('message includes all failing test descriptions', () => {
    const records = parseDiagnostics(validLatestJson)
    const addRecord = records.find((r) => r.functionName === 'add')
    expect(addRecord?.message).toContain('adds two numbers correctly')
    expect(addRecord?.message).toContain('handles negative numbers')
  })

  it('includes line numbers from the result', () => {
    const records = parseDiagnostics(validLatestJson)
    const addRecord = records.find((r) => r.functionName === 'add')
    expect(addRecord?.line).toBe(4) // startLine 5 → 0-indexed = 4
  })

  it('returns empty array for invalid JSON', () => {
    expect(parseDiagnostics('not json')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseDiagnostics('')).toEqual([])
  })

  it('returns empty array when results key is missing', () => {
    expect(parseDiagnostics(JSON.stringify({ summary: {} }))).toEqual([])
  })

  it('returns empty array when all tests pass', () => {
    const allPass = JSON.stringify({
      results: [
        { filePath: '/f.ts', targetName: 'fn', description: 'test', passed: true, startLine: 1, endLine: 1 },
      ],
    })
    expect(parseDiagnostics(allPass)).toEqual([])
  })

  it('sets severity to error for crash errors (TypeError, null check)', () => {
    const crashJson = JSON.stringify({
      results: [
        { filePath: '/f.ts', targetName: 'fn', description: 'null crash', passed: false, error: "TypeError: Cannot read properties of null", startLine: 1, endLine: 3 },
      ],
    })
    const records = parseDiagnostics(crashJson)
    expect(records[0]?.severity).toBe('error')
  })

  it('sets severity to warning for assertion failures', () => {
    const assertionJson = JSON.stringify({
      results: [
        { filePath: '/f.ts', targetName: 'fn', description: 'wrong output', passed: false, error: "Expected: 3, Received: 4", startLine: 1, endLine: 3 },
      ],
    })
    const records = parseDiagnostics(assertionJson)
    expect(records[0]?.severity).toBe('warning')
  })
})

describe('groupByFile', () => {
  it('groups DiagnosticRecords by filePath', () => {
    const records = parseDiagnostics(validLatestJson)
    const byFile = groupByFile(records)
    expect(byFile.has('/project/src/utils.ts')).toBe(true)
    expect(byFile.get('/project/src/utils.ts')).toHaveLength(1)
  })

  it('returns empty map for empty input', () => {
    expect(groupByFile([])).toEqual(new Map())
  })
})

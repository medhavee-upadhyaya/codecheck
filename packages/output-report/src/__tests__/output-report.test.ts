import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReportOutputPlugin } from '../index.js'
import { configDefaults } from '@codecheck/core'
import type { TestResult } from '@codecheck/core'

const { mockMkdir, mockWriteFile } = vi.hoisted(() => ({
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  },
}))

const makeResult = (passed: boolean, name = 'add'): TestResult => ({
  testCase: {
    description: 'adds two numbers',
    input: [1, 2],
    expectedOutput: 3,
    category: 'happy-path',
    testType: 'unit',
    shouldThrow: false,
  },
  target: {
    filePath: '/project/src/utils.ts',
    name,
    code: 'function add(a, b) { return a + b }',
    language: 'typescript',
    targetType: 'function',
    startLine: 1,
    endLine: 1,
    params: [],
  },
  passed,
  error: passed ? undefined : 'AssertionError: expected 4 to equal 3',
  duration: 12,
})

describe('ReportOutputPlugin', () => {
  let plugin: ReportOutputPlugin

  beforeEach(() => {
    plugin = new ReportOutputPlugin()
    mockMkdir.mockReset().mockResolvedValue(undefined)
    mockWriteFile.mockReset().mockResolvedValue(undefined)
  })

  it('has name "report"', () => {
    expect(plugin.name).toBe('report')
  })

  it('writes both report.json and report.html', async () => {
    await plugin.report([makeResult(true), makeResult(false)], configDefaults)

    const writeCalls = mockWriteFile.mock.calls.map((c) => c[0] as string)
    expect(writeCalls.some((p) => p.endsWith('report.json'))).toBe(true)
    expect(writeCalls.some((p) => p.endsWith('report.html'))).toBe(true)
  })

  it('report.json contains correct summary', async () => {
    await plugin.report([makeResult(true), makeResult(false)], configDefaults)

    const jsonCall = mockWriteFile.mock.calls.find((c) => (c[0] as string).endsWith('report.json'))
    expect(jsonCall).toBeDefined()
    const payload = JSON.parse(jsonCall![1] as string)

    expect(payload.summary.total).toBe(2)
    expect(payload.summary.passed).toBe(1)
    expect(payload.summary.failed).toBe(1)
    expect(payload.summary.passRate).toBe(0.5)
  })

  it('report.html contains pass rate', async () => {
    await plugin.report([makeResult(true), makeResult(true)], configDefaults)

    const htmlCall = mockWriteFile.mock.calls.find((c) => (c[0] as string).endsWith('report.html'))
    const html = htmlCall![1] as string
    expect(html).toContain('100%')
    expect(html).toContain('CodeCheck Report')
  })

  it('never throws even if fs fails', async () => {
    mockMkdir.mockRejectedValueOnce(new Error('EACCES'))

    await expect(plugin.report([makeResult(true)], configDefaults)).resolves.toBeUndefined()
  })

  it('handles empty results gracefully', async () => {
    await expect(plugin.report([], configDefaults)).resolves.toBeUndefined()

    const jsonCall = mockWriteFile.mock.calls.find((c) => (c[0] as string).endsWith('report.json'))
    const payload = JSON.parse(jsonCall![1] as string)
    expect(payload.summary.total).toBe(0)
    expect(payload.summary.passRate).toBe(1)
  })
})

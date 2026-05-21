import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SlackOutputPlugin } from '../index.js'
import { configDefaults } from '@codecheck/core'
import type { TestResult } from '@codecheck/core'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const makeResult = (passed: boolean): TestResult => ({
  testCase: {
    description: 'does something',
    input: null,
    expectedOutput: null,
    category: 'happy-path',
    testType: 'unit',
    shouldThrow: false,
  },
  target: {
    filePath: '/project/src/utils.ts',
    name: 'myFn',
    code: 'function myFn() {}',
    language: 'typescript',
    targetType: 'function',
    startLine: 1,
    endLine: 1,
    params: [],
  },
  passed,
  duration: 10,
})

describe('SlackOutputPlugin', () => {
  let plugin: SlackOutputPlugin
  const originalEnv = process.env

  beforeEach(() => {
    plugin = new SlackOutputPlugin()
    mockFetch.mockReset().mockResolvedValue({ ok: true })
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('has name "slack"', () => {
    expect(plugin.name).toBe('slack')
  })

  it('skips silently when SLACK_WEBHOOK_URL is not set', async () => {
    delete process.env['SLACK_WEBHOOK_URL']
    await plugin.report([makeResult(true)], configDefaults)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('posts to SLACK_WEBHOOK_URL when set', async () => {
    process.env['SLACK_WEBHOOK_URL'] = 'https://hooks.slack.com/test'
    await plugin.report([makeResult(true)], configDefaults)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/test',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('payload includes pass rate and counts', async () => {
    process.env['SLACK_WEBHOOK_URL'] = 'https://hooks.slack.com/test'
    await plugin.report([makeResult(true), makeResult(false)], configDefaults)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    const fields: Array<{ title: string; value: string }> = body.attachments[0].fields
    const rateField = fields.find((f) => f.title === 'Pass Rate')
    const testsField = fields.find((f) => f.title === 'Tests')

    expect(rateField?.value).toBe('50%')
    expect(testsField?.value).toContain('1 passed')
    expect(testsField?.value).toContain('1 failed')
  })

  it('never throws when fetch fails', async () => {
    process.env['SLACK_WEBHOOK_URL'] = 'https://hooks.slack.com/test'
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    await expect(plugin.report([makeResult(true)], configDefaults)).resolves.toBeUndefined()
  })

  it('handles empty results without throwing', async () => {
    process.env['SLACK_WEBHOOK_URL'] = 'https://hooks.slack.com/test'
    await expect(plugin.report([], configDefaults)).resolves.toBeUndefined()

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    const fields: Array<{ title: string; value: string }> = body.attachments[0].fields
    const rateField = fields.find((f) => f.title === 'Pass Rate')
    expect(rateField?.value).toBe('100%')
  })
})

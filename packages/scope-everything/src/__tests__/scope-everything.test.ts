import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EverythingScopePlugin } from '../index.js'
import { configDefaults } from '@codecheck/core'

// Mock extractTargets from @codecheck/core
vi.mock('@codecheck/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@codecheck/core')>()
  return {
    ...actual,
    extractTargets: vi.fn().mockResolvedValue([
      {
        filePath: '/project/src/utils.ts',
        name: 'add',
        code: 'export function add(a: number, b: number) { return a + b }',
        language: 'typescript',
        targetType: 'function',
        startLine: 1,
        endLine: 1,
        params: [],
        returnType: 'number',
      },
    ]),
  }
})

// Mock fs to avoid real filesystem traversal
vi.mock('node:fs/promises', () => ({
  default: {
    readdir: vi.fn().mockResolvedValue([
      { name: 'utils.ts', isDirectory: () => false, isFile: () => true },
      { name: 'helper.ts', isDirectory: () => false, isFile: () => true },
      { name: 'node_modules', isDirectory: () => true, isFile: () => false },
    ]),
  },
}))

describe('EverythingScopePlugin', () => {
  let plugin: EverythingScopePlugin

  beforeEach(() => {
    plugin = new EverythingScopePlugin()
  })

  it('has name "unit" and includes multiple test types', () => {
    expect(plugin.name).toBe('unit')
    expect(plugin.testTypes).toContain('unit')
    expect(plugin.testTypes).toContain('smoke')
    expect(plugin.testTypes).toContain('functional')
    expect(plugin.testTypes).toContain('sanity')
  })

  it('returns TestTarget[] when extractTargets succeeds', async () => {
    const targets = await plugin.extractTargets(['/project/src/utils.ts'], configDefaults)
    expect(Array.isArray(targets)).toBe(true)
  })

  it('never throws even if a file fails to parse', async () => {
    const { extractTargets } = await import('@codecheck/core')
    const mock = vi.mocked(extractTargets)
    mock.mockRejectedValueOnce(new Error('parse failure'))

    await expect(
      plugin.extractTargets(['/project/src/bad.ts'], configDefaults),
    ).resolves.toBeDefined()
  })

  it('builds a prompt string for any test type', () => {
    const prompt = plugin.buildPrompt(
      {
        filePath: '/project/src/utils.ts',
        name: 'add',
        code: '',
        language: 'typescript',
        targetType: 'function',
        startLine: 1,
        endLine: 1,
        params: [],
      },
      'unit',
    )
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })
})

import { describe, it, expect } from 'vitest'
import { SanityScopePlugin } from '../index.js'
import type { CodeCheckConfig } from '@codecheck/core'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureFile = resolve(__dirname, '../../src/index.ts')

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['sanity'],
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

describe('SanityScopePlugin', () => {
  const plugin = new SanityScopePlugin()

  it('has name "sanity"', () => {
    expect(plugin.name).toBe('sanity')
  })

  it('has testTypes ["sanity"]', () => {
    expect(plugin.testTypes).toEqual(['sanity'])
  })

  it('extractTargets returns an array', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    expect(Array.isArray(targets)).toBe(true)
  })

  it('extractTargets handles missing files gracefully', async () => {
    const targets = await plugin.extractTargets(['/does/not/exist.ts'], makeConfig())
    expect(targets).toEqual([])
  })

  it('buildPrompt contains sanity test instructions', () => {
    const fakeTarget = {
      filePath: '/a/b.ts', name: 'add', code: 'function add(a,b){return a+b}',
      language: 'typescript' as const, targetType: 'function' as const, startLine: 1, endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'sanity')
    expect(prompt).toContain('Sanity Test Instructions')
    expect(prompt).toContain('sanity')
    expect(prompt).toContain('1–2 test cases')
  })

  it('buildPrompt instructs no shouldThrow tests', () => {
    const fakeTarget = {
      filePath: '/a/b.ts', name: 'fn', code: 'function fn(){}',
      language: 'typescript' as const, targetType: 'function' as const, startLine: 1, endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'sanity')
    expect(prompt).toContain('Do NOT generate shouldThrow')
  })
})

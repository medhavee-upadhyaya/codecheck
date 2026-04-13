import { describe, it, expect } from 'vitest'
import { SmokeScopePlugin } from '../index.js'
import type { CodeCheckConfig } from '@codecheck/core'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureFile = resolve(__dirname, '../../src/index.ts')

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['smoke'],
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

describe('SmokeScopePlugin', () => {
  const plugin = new SmokeScopePlugin()

  it('has name "smoke"', () => {
    expect(plugin.name).toBe('smoke')
  })

  it('has testTypes ["smoke"]', () => {
    expect(plugin.testTypes).toEqual(['smoke'])
  })

  it('extractTargets returns an array', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    expect(Array.isArray(targets)).toBe(true)
  })

  it('extractTargets handles missing files gracefully', async () => {
    const targets = await plugin.extractTargets(['/does/not/exist.ts'], makeConfig())
    expect(targets).toEqual([])
  })

  it('buildPrompt returns the smoke prompt suffix', () => {
    const fakeTarget = {
      filePath: '/a/b.ts',
      name: 'add',
      code: 'function add(a,b){return a+b}',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'smoke')
    expect(prompt).toContain('Smoke Test Instructions')
    expect(prompt).toContain('smoke')
    expect(prompt).toContain('2–3 test cases maximum')
  })

  it('buildPrompt does not instruct shouldThrow tests', () => {
    const fakeTarget = {
      filePath: '/a/b.ts',
      name: 'add',
      code: 'function add(a,b){return a+b}',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'smoke')
    expect(prompt).toContain('Do NOT generate tests with shouldThrow')
  })
})

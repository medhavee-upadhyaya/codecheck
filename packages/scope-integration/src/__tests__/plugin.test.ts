import { describe, it, expect } from 'vitest'
import { IntegrationScopePlugin } from '../index.js'
import type { CodeCheckConfig } from '@codecheck/core'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureFile = resolve(__dirname, '../../src/index.ts')

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['integration'],
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

describe('IntegrationScopePlugin', () => {
  const plugin = new IntegrationScopePlugin()

  it('has name "integration"', () => {
    expect(plugin.name).toBe('integration')
  })

  it('has testTypes ["integration"]', () => {
    expect(plugin.testTypes).toEqual(['integration'])
  })

  it('extractTargets returns an array', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    expect(Array.isArray(targets)).toBe(true)
  })

  it('extractTargets handles missing files gracefully', async () => {
    const targets = await plugin.extractTargets(['/does/not/exist.ts'], makeConfig())
    expect(targets).toEqual([])
  })

  it('buildPrompt contains integration test instructions', () => {
    const fakeTarget = {
      filePath: '/a/b.ts', name: 'pipeline', code: 'function pipeline(x){return x}',
      language: 'typescript' as const, targetType: 'function' as const, startLine: 1, endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'integration')
    expect(prompt).toContain('Integration Test Instructions')
    expect(prompt).toContain('integration')
    expect(prompt).toContain('Pipeline flows')
  })

  it('buildPrompt instructs at least 2 operations per test', () => {
    const fakeTarget = {
      filePath: '/a/b.ts', name: 'fn', code: 'function fn(){}',
      language: 'typescript' as const, targetType: 'function' as const, startLine: 1, endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'integration')
    expect(prompt).toContain('at least 2 operations')
  })
})

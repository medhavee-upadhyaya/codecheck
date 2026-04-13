import { describe, it, expect } from 'vitest'
import { FunctionalScopePlugin } from '../index.js'
import type { CodeCheckConfig } from '@codecheck/core'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureFile = resolve(__dirname, '../../src/index.ts')

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['functional'],
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

describe('FunctionalScopePlugin', () => {
  const plugin = new FunctionalScopePlugin()

  it('has name "functional"', () => {
    expect(plugin.name).toBe('functional')
  })

  it('has testTypes ["functional"]', () => {
    expect(plugin.testTypes).toEqual(['functional'])
  })

  it('extractTargets returns an array', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    expect(Array.isArray(targets)).toBe(true)
  })

  it('extractTargets filters out endpoint targets', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    for (const t of targets) {
      expect(t.targetType).not.toBe('endpoint')
    }
  })

  it('extractTargets handles missing files gracefully', async () => {
    const targets = await plugin.extractTargets(['/does/not/exist.ts'], makeConfig())
    expect(targets).toEqual([])
  })

  it('buildPrompt contains functional test instructions', () => {
    const fakeTarget = {
      filePath: '/a/b.ts', name: 'transform', code: 'function transform(x){return x}',
      language: 'typescript' as const, targetType: 'function' as const, startLine: 1, endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'functional')
    expect(prompt).toContain('Functional Test Instructions')
    expect(prompt).toContain('functional')
    expect(prompt).toContain('Data transformation')
  })

  it('buildPrompt instructs not to mock dependencies', () => {
    const fakeTarget = {
      filePath: '/a/b.ts', name: 'fn', code: 'function fn(){}',
      language: 'typescript' as const, targetType: 'function' as const, startLine: 1, endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'functional')
    expect(prompt).toContain('Do NOT mock')
  })
})

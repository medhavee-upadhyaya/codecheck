import { describe, it, expect } from 'vitest'
import { UnitScopePlugin } from '../index.js'
import type { CodeCheckConfig } from '@codecheck/core'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Fixture: the core package's own extractor fixture lives under core/src/__tests__/fixtures
// We'll use a simple inline temp file approach instead by pointing to the scope-unit src itself
const fixtureFile = resolve(__dirname, '../../src/index.ts')

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['unit'],
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

describe('UnitScopePlugin', () => {
  const plugin = new UnitScopePlugin()

  it('has name "unit"', () => {
    expect(plugin.name).toBe('unit')
  })

  it('has testTypes ["unit"]', () => {
    expect(plugin.testTypes).toEqual(['unit'])
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

  it('buildPrompt returns the unit prompt suffix string', () => {
    const fakeTarget = {
      filePath: '/a/b.ts',
      name: 'add',
      code: 'function add(a,b){return a+b}',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'unit')
    expect(prompt).toContain('Unit Test Instructions')
    expect(prompt).toContain('shouldThrow')
    expect(prompt).toContain('unit')
  })
})

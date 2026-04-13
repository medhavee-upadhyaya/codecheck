import { describe, it, expect } from 'vitest'
import { E2EScopePlugin } from '../index.js'
import type { CodeCheckConfig } from '@codecheck/core'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureFile = resolve(__dirname, '../../src/index.ts')

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['e2e'],
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

describe('E2EScopePlugin', () => {
  const plugin = new E2EScopePlugin()

  it('has name "e2e"', () => {
    expect(plugin.name).toBe('e2e')
  })

  it('has testTypes ["e2e"]', () => {
    expect(plugin.testTypes).toEqual(['e2e'])
  })

  it('extractTargets returns an array', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    expect(Array.isArray(targets)).toBe(true)
  })

  it('extractTargets filters for endpoint and handler targets', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    for (const t of targets) {
      const isEndpoint = t.targetType === 'endpoint'
      const isHandler = /handler|controller|route|endpoint|middleware|page|screen/i.test(t.name)
      expect(isEndpoint || isHandler).toBe(true)
    }
  })

  it('extractTargets handles missing files gracefully', async () => {
    const targets = await plugin.extractTargets(['/does/not/exist.ts'], makeConfig())
    expect(targets).toEqual([])
  })

  it('buildPrompt contains E2E test instructions', () => {
    const fakeTarget = {
      filePath: '/a/b.ts',
      name: 'loginHandler',
      code: 'function loginHandler(req) { return res }',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'e2e')
    expect(prompt).toContain('E2E Test Instructions')
    expect(prompt).toContain('e2e')
    expect(prompt).toContain('Playwright')
  })

  it('buildPrompt instructs not to mock browser or DOM', () => {
    const fakeTarget = {
      filePath: '/a/b.ts',
      name: 'pageHandler',
      code: 'function pageHandler() {}',
      language: 'typescript' as const,
      targetType: 'endpoint' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'e2e')
    expect(prompt).toContain('Do NOT mock')
  })

  it('buildPrompt specifies 2-4 test cases', () => {
    const fakeTarget = {
      filePath: '/a/b.ts',
      name: 'routeHandler',
      code: 'function routeHandler() {}',
      language: 'typescript' as const,
      targetType: 'endpoint' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'e2e')
    expect(prompt).toContain('2–4')
  })
})

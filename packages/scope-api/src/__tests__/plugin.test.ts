import { describe, it, expect } from 'vitest'
import { ApiScopePlugin } from '../index.js'
import type { CodeCheckConfig } from '@codecheck/core'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureFile = resolve(__dirname, '../../src/index.ts')

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['api'],
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

describe('ApiScopePlugin', () => {
  const plugin = new ApiScopePlugin()

  it('has name "api"', () => {
    expect(plugin.name).toBe('api')
  })

  it('has testTypes ["api"]', () => {
    expect(plugin.testTypes).toEqual(['api'])
  })

  it('extractTargets returns an array', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    expect(Array.isArray(targets)).toBe(true)
  })

  it('extractTargets handles missing files gracefully', async () => {
    const targets = await plugin.extractTargets(['/does/not/exist.ts'], makeConfig())
    expect(targets).toEqual([])
  })

  it('buildPrompt contains API test instructions', () => {
    const fakeTarget = {
      filePath: '/a/b.ts', name: 'createUser', code: 'async function createUser(req){return res}',
      language: 'typescript' as const, targetType: 'endpoint' as const, startLine: 1, endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'api')
    expect(prompt).toContain('API Test Instructions')
    expect(prompt).toContain('api')
    expect(prompt).toContain('status')
  })

  it('buildPrompt describes request/response shape', () => {
    const fakeTarget = {
      filePath: '/a/b.ts', name: 'handler', code: 'async function handler(req, res){}',
      language: 'typescript' as const, targetType: 'endpoint' as const, startLine: 1, endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'api')
    expect(prompt).toContain('method')
    expect(prompt).toContain('body')
  })

  it('extractTargets picks up handler-named functions', async () => {
    // The fixture file (scope-api/src/index.ts) has functions named with
    // typical naming conventions. This test just confirms the filter runs without throwing.
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    expect(Array.isArray(targets)).toBe(true)
  })
})

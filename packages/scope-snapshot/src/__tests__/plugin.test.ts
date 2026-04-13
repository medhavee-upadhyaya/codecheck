import { describe, it, expect } from 'vitest'
import { SnapshotScopePlugin } from '../index.js'
import type { CodeCheckConfig } from '@codecheck/core'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureFile = resolve(__dirname, '../../src/index.ts')

function makeConfig(overrides: Partial<CodeCheckConfig> = {}): CodeCheckConfig {
  return {
    trigger: 'oncommit',
    testTypes: ['snapshot'],
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

describe('SnapshotScopePlugin', () => {
  const plugin = new SnapshotScopePlugin()

  it('has name "snapshot"', () => {
    expect(plugin.name).toBe('snapshot')
  })

  it('has testTypes ["snapshot"]', () => {
    expect(plugin.testTypes).toEqual(['snapshot'])
  })

  it('extractTargets returns an array', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    expect(Array.isArray(targets)).toBe(true)
  })

  it('extractTargets filters for PascalCase component names', async () => {
    const targets = await plugin.extractTargets([fixtureFile], makeConfig())
    for (const t of targets) {
      expect(t.name).toMatch(/^[A-Z][a-zA-Z0-9]*$/)
    }
  })

  it('extractTargets handles missing files gracefully', async () => {
    const targets = await plugin.extractTargets(['/does/not/exist.ts'], makeConfig())
    expect(targets).toEqual([])
  })

  it('buildPrompt contains snapshot test instructions', () => {
    const fakeTarget = {
      filePath: '/a/Button.tsx',
      name: 'Button',
      code: 'function Button({ label }) { return <button>{label}</button> }',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'snapshot')
    expect(prompt).toContain('Snapshot Test Instructions')
    expect(prompt).toContain('snapshot')
    expect(prompt).toContain('toMatchSnapshot')
  })

  it('buildPrompt mentions React Testing Library', () => {
    const fakeTarget = {
      filePath: '/a/Card.tsx',
      name: 'Card',
      code: 'function Card({ title }) { return <div>{title}</div> }',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'snapshot')
    expect(prompt).toContain('@testing-library/react')
  })

  it('buildPrompt specifies expectedOutput is null', () => {
    const fakeTarget = {
      filePath: '/a/Modal.tsx',
      name: 'Modal',
      code: 'function Modal({ open }) { return open ? <div/> : null }',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'snapshot')
    expect(prompt).toContain('expectedOutput')
    expect(prompt.toLowerCase()).toContain('null')
  })

  it('buildPrompt specifies 2-4 test cases', () => {
    const fakeTarget = {
      filePath: '/a/Form.tsx',
      name: 'Form',
      code: 'function Form() { return <form/> }',
      language: 'typescript' as const,
      targetType: 'function' as const,
      startLine: 1,
      endLine: 1,
    }
    const prompt = plugin.buildPrompt(fakeTarget, 'snapshot')
    expect(prompt).toContain('2–4')
  })
})

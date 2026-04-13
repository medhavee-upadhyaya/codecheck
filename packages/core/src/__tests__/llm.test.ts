import { describe, it, expect, beforeEach } from 'vitest'
import { MockLLMClient } from '../llm/client.js'
import { parseLLMResponse, LLMResponseSchema } from '../llm/schema.js'
import { buildSystemPrompt, buildUserPrompt } from '../llm/prompts.js'
import { configDefaults } from '../config.js'
import type { TestTarget, TestCase } from '../types.js'

// ─── Shared Fixtures ──────────────────────────────────────────────────────────

const mockTarget: TestTarget = {
  filePath: '/project/src/math.ts',
  name: 'add',
  code: 'export function add(a: number, b: number): number { return a + b }',
  language: 'typescript',
  targetType: 'function',
  startLine: 1,
  endLine: 1,
  params: [
    { name: 'a', type: 'number' },
    { name: 'b', type: 'number' },
  ],
  returnType: 'number',
}

// ─── MockLLMClient ────────────────────────────────────────────────────────────

describe('MockLLMClient', () => {
  let client: MockLLMClient

  beforeEach(() => {
    client = new MockLLMClient()
  })

  it('returns TestCase[] without making any API calls', async () => {
    const cases = await client.generateTestCases(
      mockTarget,
      ['unit', 'smoke'],
      'Generate thorough tests.',
      configDefaults
    )
    expect(Array.isArray(cases)).toBe(true)
    expect(cases.length).toBeGreaterThan(0)
  })

  it('returns test cases with required fields', async () => {
    const cases = await client.generateTestCases(
      mockTarget,
      ['unit', 'smoke'],
      '',
      configDefaults
    )
    for (const tc of cases) {
      expect(typeof tc.description).toBe('string')
      expect(tc.description.length).toBeGreaterThan(0)
      expect(typeof tc.category).toBe('string')
      expect(typeof tc.testType).toBe('string')
    }
  })

  it('filters test cases to requested test types', async () => {
    const cases = await client.generateTestCases(
      mockTarget,
      ['unit'],
      '',
      configDefaults
    )
    for (const tc of cases) {
      expect(tc.testType).toBe('unit')
    }
  })

  it('tracks call count', async () => {
    expect(client.calls).toBe(0)
    await client.generateTestCases(mockTarget, ['unit'], '', configDefaults)
    expect(client.calls).toBe(1)
    await client.generateTestCases(mockTarget, ['smoke'], '', configDefaults)
    expect(client.calls).toBe(2)
  })

  it('reset() clears call count', async () => {
    await client.generateTestCases(mockTarget, ['unit'], '', configDefaults)
    client.reset()
    expect(client.calls).toBe(0)
  })

  it('accepts custom fixtures', async () => {
    const customCase: TestCase = {
      description: 'custom test case',
      input: 42,
      expectedOutput: 84,
      category: 'happy-path',
      testType: 'unit',
      shouldThrow: false,
    }
    const customClient = new MockLLMClient([{ testCases: [customCase] }])
    const cases = await customClient.generateTestCases(
      mockTarget,
      ['unit'],
      '',
      configDefaults
    )
    expect(cases[0]?.description).toBe('custom test case')
  })

  it('rotates through multiple fixtures', async () => {
    const fixture1: TestCase = {
      description: 'fixture 1',
      input: 1,
      expectedOutput: 1,
      category: 'happy-path',
      testType: 'unit',
    }
    const fixture2: TestCase = {
      description: 'fixture 2',
      input: 2,
      expectedOutput: 2,
      category: 'happy-path',
      testType: 'unit',
    }
    const rotatingClient = new MockLLMClient([
      { testCases: [fixture1] },
      { testCases: [fixture2] },
    ])

    const first = await rotatingClient.generateTestCases(mockTarget, ['unit'], '', configDefaults)
    const second = await rotatingClient.generateTestCases(mockTarget, ['unit'], '', configDefaults)

    expect(first[0]?.description).toBe('fixture 1')
    expect(second[0]?.description).toBe('fixture 2')
  })
})

// ─── LLM Response Schema ──────────────────────────────────────────────────────

describe('parseLLMResponse', () => {
  it('parses a valid JSON response', () => {
    const raw = JSON.stringify({
      testCases: [
        {
          description: 'adds two numbers',
          input: [1, 2],
          expectedOutput: 3,
          category: 'happy-path',
          testType: 'unit',
          shouldThrow: false,
        },
      ],
    })
    const result = parseLLMResponse(raw)
    expect(result.testCases.length).toBe(1)
    expect(result.testCases[0]?.description).toBe('adds two numbers')
  })

  it('strips markdown code fences before parsing', () => {
    const raw = '```json\n{"testCases":[{"description":"test","input":1,"expectedOutput":2,"category":"happy-path","testType":"unit"}]}\n```'
    const result = parseLLMResponse(raw)
    expect(result.testCases.length).toBe(1)
  })

  it('strips plain code fences before parsing', () => {
    const raw = '```\n{"testCases":[{"description":"test","input":1,"expectedOutput":2,"category":"happy-path","testType":"unit"}]}\n```'
    const result = parseLLMResponse(raw)
    expect(result.testCases.length).toBe(1)
  })

  it('throws SyntaxError for invalid JSON', () => {
    expect(() => parseLLMResponse('not json')).toThrow(SyntaxError)
  })

  it('throws ZodError for JSON that does not match schema', () => {
    const raw = JSON.stringify({ testCases: [] }) // empty array — min(1) fails
    expect(() => parseLLMResponse(raw)).toThrow()
  })

  it('rejects unknown testType values', () => {
    const raw = JSON.stringify({
      testCases: [
        {
          description: 'test',
          input: 1,
          expectedOutput: 1,
          category: 'happy-path',
          testType: 'invalid-type',
        },
      ],
    })
    expect(() => parseLLMResponse(raw)).toThrow()
  })
})

// ─── Prompt Builders ──────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = buildSystemPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(500)
  })

  it('contains JSON schema instructions', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toContain('testCases')
    expect(prompt).toContain('description')
    expect(prompt).toContain('expectedOutput')
  })

  it('returns the same string every call (static — cacheable)', () => {
    expect(buildSystemPrompt()).toBe(buildSystemPrompt())
  })
})

describe('buildUserPrompt', () => {
  it('includes the function name', () => {
    const prompt = buildUserPrompt(mockTarget, ['unit'], 'test suffix')
    expect(prompt).toContain('add')
  })

  it('includes the test types', () => {
    const prompt = buildUserPrompt(mockTarget, ['unit', 'smoke'], '')
    expect(prompt).toContain('unit')
    expect(prompt).toContain('smoke')
  })

  it('includes the scope suffix', () => {
    const prompt = buildUserPrompt(mockTarget, ['unit'], 'Focus on edge cases please.')
    expect(prompt).toContain('Focus on edge cases please.')
  })

  it('includes the function code', () => {
    const prompt = buildUserPrompt(mockTarget, ['unit'], '')
    expect(prompt).toContain('return a + b')
  })

  it('includes parameter info', () => {
    const prompt = buildUserPrompt(mockTarget, ['unit'], '')
    expect(prompt).toContain('a: number')
    expect(prompt).toContain('b: number')
  })

  it('marks async functions', () => {
    const asyncTarget: TestTarget = { ...mockTarget, isAsync: true }
    const prompt = buildUserPrompt(asyncTarget, ['unit'], '')
    expect(prompt).toContain('Async: Yes')
  })
})

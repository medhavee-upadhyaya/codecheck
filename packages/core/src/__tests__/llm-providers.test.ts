import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LLMApiError, LLMParseError } from '../errors.js'
import { configDefaults } from '../config.js'
import type { TestTarget } from '../types.js'

// ─── Shared fixture ───────────────────────────────────────────────────────────

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

const validJsonResponse = JSON.stringify({
  testCases: [
    {
      description: 'adds two positive numbers',
      input: [1, 2],
      expectedOutput: 3,
      category: 'happy-path',
      testType: 'unit',
      shouldThrow: false,
    },
  ],
})

// Module-level mock fns — defined before vi.mock() hoisting runs
const mockOpenAICreate = vi.fn()
const mockGeminiGenerateContent = vi.fn()

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('openai', () => ({
  default: vi.fn(function (this: any) {
    this.baseURL = 'https://api.openai.com/v1'
    this.chat = { completions: { create: mockOpenAICreate } }
  }),
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function (this: any) {
    this.getGenerativeModel = vi.fn(() => ({
      generateContent: mockGeminiGenerateContent,
    }))
  }),
}))

// ─── OpenAILLMClient ──────────────────────────────────────────────────────────

describe('OpenAILLMClient', () => {
  beforeEach(() => {
    mockOpenAICreate.mockReset()
  })

  it('returns TestCase[] on a valid API response', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: validJsonResponse } }],
    })

    const { OpenAILLMClient } = await import('../llm/openai.js')
    const client = new OpenAILLMClient('test-key')
    const cases = await client.generateTestCases(mockTarget, ['unit'], '', configDefaults)

    expect(Array.isArray(cases)).toBe(true)
    expect(cases[0]?.description).toBe('adds two positive numbers')
  })

  it('throws LLMApiError when the API call fails', async () => {
    mockOpenAICreate.mockRejectedValueOnce(new Error('network failure'))

    const { OpenAILLMClient } = await import('../llm/openai.js')
    const client = new OpenAILLMClient('test-key')

    await expect(
      client.generateTestCases(mockTarget, ['unit'], '', configDefaults),
    ).rejects.toBeInstanceOf(LLMApiError)
  })

  it('throws LLMApiError when response content is empty', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: '' } }],
    })

    const { OpenAILLMClient } = await import('../llm/openai.js')
    const client = new OpenAILLMClient('test-key')

    await expect(
      client.generateTestCases(mockTarget, ['unit'], '', configDefaults),
    ).rejects.toBeInstanceOf(LLMApiError)
  })

  it('throws LLMParseError when response is not valid JSON', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not json at all' } }],
    })

    const { OpenAILLMClient } = await import('../llm/openai.js')
    const client = new OpenAILLMClient('test-key')

    await expect(
      client.generateTestCases(mockTarget, ['unit'], '', configDefaults),
    ).rejects.toBeInstanceOf(LLMParseError)
  })
})

// ─── GeminiLLMClient ──────────────────────────────────────────────────────────

describe('GeminiLLMClient', () => {
  beforeEach(() => {
    mockGeminiGenerateContent.mockReset()
  })

  it('returns TestCase[] on a valid API response', async () => {
    mockGeminiGenerateContent.mockResolvedValueOnce({
      response: { text: () => validJsonResponse },
    })

    const { GeminiLLMClient } = await import('../llm/gemini.js')
    const client = new GeminiLLMClient('test-key')
    const cases = await client.generateTestCases(mockTarget, ['unit'], '', configDefaults)

    expect(Array.isArray(cases)).toBe(true)
    expect(cases[0]?.description).toBe('adds two positive numbers')
  })

  it('throws LLMApiError when the API call fails', async () => {
    mockGeminiGenerateContent.mockRejectedValueOnce(new Error('quota exceeded'))

    const { GeminiLLMClient } = await import('../llm/gemini.js')
    const client = new GeminiLLMClient('test-key')

    await expect(
      client.generateTestCases(mockTarget, ['unit'], '', configDefaults),
    ).rejects.toBeInstanceOf(LLMApiError)
  })

  it('throws LLMApiError when response text is empty', async () => {
    mockGeminiGenerateContent.mockResolvedValueOnce({
      response: { text: () => '' },
    })

    const { GeminiLLMClient } = await import('../llm/gemini.js')
    const client = new GeminiLLMClient('test-key')

    await expect(
      client.generateTestCases(mockTarget, ['unit'], '', configDefaults),
    ).rejects.toBeInstanceOf(LLMApiError)
  })

  it('throws LLMParseError when response is invalid JSON', async () => {
    mockGeminiGenerateContent.mockResolvedValueOnce({
      response: { text: () => 'not json' },
    })

    const { GeminiLLMClient } = await import('../llm/gemini.js')
    const client = new GeminiLLMClient('test-key')

    await expect(
      client.generateTestCases(mockTarget, ['unit'], '', configDefaults),
    ).rejects.toBeInstanceOf(LLMParseError)
  })
})

// ─── OllamaLLMClient ──────────────────────────────────────────────────────────
// OllamaLLMClient reuses the openai package with a custom baseURL — same mock.

describe('OllamaLLMClient', () => {
  beforeEach(() => {
    mockOpenAICreate.mockReset()
  })

  it('returns TestCase[] on a valid API response', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: validJsonResponse } }],
    })

    const { OllamaLLMClient } = await import('../llm/ollama.js')
    const client = new OllamaLLMClient()
    const cases = await client.generateTestCases(mockTarget, ['unit'], '', configDefaults)

    expect(Array.isArray(cases)).toBe(true)
    expect(cases[0]?.description).toBe('adds two positive numbers')
  })

  it('throws LLMApiError with helpful message when Ollama is unreachable', async () => {
    mockOpenAICreate.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const { OllamaLLMClient } = await import('../llm/ollama.js')
    const client = new OllamaLLMClient()

    const err = await client
      .generateTestCases(mockTarget, ['unit'], '', configDefaults)
      .catch((e) => e)

    expect(err).toBeInstanceOf(LLMApiError)
    expect(err.message).toContain('Ollama error')
  })

  it('throws LLMParseError when response is invalid JSON', async () => {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not json' } }],
    })

    const { OllamaLLMClient } = await import('../llm/ollama.js')
    const client = new OllamaLLMClient()

    await expect(
      client.generateTestCases(mockTarget, ['unit'], '', configDefaults),
    ).rejects.toBeInstanceOf(LLMParseError)
  })
})

// ─── createLLMClient factory ─────────────────────────────────────────────────

describe('createLLMClient', () => {
  it('returns AnthropicLLMClient for provider anthropic', async () => {
    const { createLLMClient, AnthropicLLMClient } = await import('../llm/client.js')
    const client = createLLMClient({ ...configDefaults, provider: 'anthropic' })
    expect(client).toBeInstanceOf(AnthropicLLMClient)
  })

  it('returns OpenAILLMClient for provider openai', async () => {
    const { createLLMClient, OpenAILLMClient } = await import('../llm/client.js')
    const client = createLLMClient({ ...configDefaults, provider: 'openai' })
    expect(client).toBeInstanceOf(OpenAILLMClient)
  })

  it('returns GeminiLLMClient for provider gemini', async () => {
    const { createLLMClient, GeminiLLMClient } = await import('../llm/client.js')
    const client = createLLMClient({ ...configDefaults, provider: 'gemini' })
    expect(client).toBeInstanceOf(GeminiLLMClient)
  })

  it('returns OllamaLLMClient for provider ollama', async () => {
    const { createLLMClient, OllamaLLMClient } = await import('../llm/client.js')
    const client = createLLMClient({ ...configDefaults, provider: 'ollama' })
    expect(client).toBeInstanceOf(OllamaLLMClient)
  })

  it('defaults to AnthropicLLMClient for unknown provider', async () => {
    const { createLLMClient, AnthropicLLMClient } = await import('../llm/client.js')
    // @ts-expect-error testing invalid provider
    const client = createLLMClient({ ...configDefaults, provider: 'unknown' })
    expect(client).toBeInstanceOf(AnthropicLLMClient)
  })
})

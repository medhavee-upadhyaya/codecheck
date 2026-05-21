/**
 * llm/client.ts — LLM client implementations.
 *
 * AnthropicLLMClient: real Anthropic SDK with prompt caching on the system message.
 * MockLLMClient: deterministic fixture responses for testing (no API calls).
 *
 * Both implement the LLMClient interface from types.ts.
 */

import Anthropic from '@anthropic-ai/sdk'
import { LLMApiError, LLMParseError } from '../errors.js'
import type { CodeCheckConfig, LLMClient, TestCase, TestTarget, TestType } from '../types.js'
import { buildSystemPrompt, buildUserPrompt } from './prompts.js'
import { parseLLMResponse } from './schema.js'
import { OpenAILLMClient } from './openai.js'
import { GeminiLLMClient } from './gemini.js'
import { OllamaLLMClient } from './ollama.js'

export { OpenAILLMClient } from './openai.js'
export { GeminiLLMClient } from './gemini.js'
export { OllamaLLMClient } from './ollama.js'

// ─── Anthropic Client ─────────────────────────────────────────────────────────

export class AnthropicLLMClient implements LLMClient {
  private readonly client: Anthropic

  constructor(apiKey: string, baseURL?: string) {
    this.client = new Anthropic({
      apiKey,
      ...(baseURL != null ? { baseURL } : {}),
    })
  }

  async generateTestCases(
    target: TestTarget,
    testTypes: TestType[],
    promptSuffix: string,
    config: CodeCheckConfig
  ): Promise<TestCase[]> {
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(target, testTypes, promptSuffix)

    let responseText: string

    try {
      const message = await this.client.messages.create({
        model: config.model,
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            // Prompt caching: the system prompt is static and large — cache it.
            // Calls 2+ for the same model reuse the cache, cutting cost ~90%.
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      })

      const firstBlock = message.content[0]
      if (firstBlock == null || firstBlock.type !== 'text') {
        throw new LLMApiError('Unexpected response format: no text block in response')
      }

      responseText = firstBlock.text
    } catch (err) {
      if (err instanceof LLMApiError) throw err
      if (err instanceof Anthropic.APIError) {
        throw new LLMApiError(err.message, err.status)
      }
      throw new LLMApiError(err instanceof Error ? err.message : String(err))
    }

    try {
      const parsed = parseLLMResponse(responseText)
      // Cast is safe: we validated testType values via Zod and our TestType union matches
      return parsed.testCases as TestCase[]
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new LLMParseError(`Invalid JSON: ${err.message}`, responseText)
      }
      throw new LLMParseError(
        err instanceof Error ? err.message : String(err),
        responseText
      )
    }
  }
}

// ─── Mock Client ──────────────────────────────────────────────────────────────

export interface MockFixture {
  testCases: TestCase[]
}

/**
 * MockLLMClient returns deterministic fixture responses without calling any API.
 * Use this in all tests and CI environments where you don't want to spend API credits.
 *
 * @example
 * const mock = new MockLLMClient()
 * // Uses built-in default fixtures — generates 2 unit + 1 smoke test per function
 *
 * @example
 * const mock = new MockLLMClient([{ testCases: myCustomCases }])
 * // Rotates through your custom fixtures
 */
export class MockLLMClient implements LLMClient {
  private readonly fixtures: MockFixture[]
  private callCount = 0

  constructor(fixtures?: MockFixture[]) {
    this.fixtures = fixtures ?? [defaultFixture]
  }

  async generateTestCases(
    target: TestTarget,
    testTypes: TestType[],
    _promptSuffix: string,
    _config: CodeCheckConfig
  ): Promise<TestCase[]> {
    // Rotate through fixtures
    const fixture = this.fixtures[this.callCount % this.fixtures.length]
    this.callCount++

    if (fixture == null) return defaultFixture.testCases

    // Filter to only the requested test types
    const filtered = fixture.testCases.filter((tc) => testTypes.includes(tc.testType))
    if (filtered.length > 0) return filtered

    // If no fixture matches the requested types, synthesize minimal cases
    return testTypes.flatMap((testType) =>
      synthesizeMinimalCases(target.name, testType)
    )
  }

  /** Reset call count (useful between test cases) */
  reset(): void {
    this.callCount = 0
  }

  /** How many times the client has been called */
  get calls(): number {
    return this.callCount
  }
}

// ─── Default Fixture ──────────────────────────────────────────────────────────

const defaultFixture: MockFixture = {
  testCases: [
    {
      description: 'returns the expected output for typical inputs',
      input: [1, 2],
      expectedOutput: 3,
      category: 'happy-path',
      testType: 'unit',
      shouldThrow: false,
    },
    {
      description: 'handles edge case with zero input',
      input: [0, 0],
      expectedOutput: 0,
      category: 'edge-case',
      testType: 'unit',
      shouldThrow: false,
    },
    {
      description: 'function executes without throwing on valid inputs',
      input: [1, 2],
      expectedOutput: 3,
      category: 'happy-path',
      testType: 'smoke',
      shouldThrow: false,
    },
  ],
}

function synthesizeMinimalCases(functionName: string, testType: TestType): TestCase[] {
  return [
    {
      description: `${functionName} — ${testType} test: executes without error`,
      input: null,
      expectedOutput: null,
      category: 'happy-path',
      testType,
      shouldThrow: false,
    },
  ]
}

// ─── Provider Factory ─────────────────────────────────────────────────────────

/**
 * Instantiate the correct LLM client based on config.provider.
 * Reads API keys from environment variables.
 */
export function createLLMClient(config: CodeCheckConfig): LLMClient {
  switch (config.provider) {
    case 'openai':
      return new OpenAILLMClient(process.env['OPENAI_API_KEY'] ?? '')
    case 'gemini':
      return new GeminiLLMClient(process.env['GEMINI_API_KEY'] ?? '')
    case 'ollama':
      return new OllamaLLMClient(
        process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434/v1',
      )
    case 'anthropic':
    default:
      return new AnthropicLLMClient(process.env['ANTHROPIC_API_KEY'] ?? '')
  }
}

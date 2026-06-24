import OpenAI from 'openai'
import { LLMApiError, LLMParseError } from '../errors.js'
import type { CodeCheckConfig, LLMClient, TestCase, TestTarget, TestType } from '../types.js'
import { buildSystemPrompt, buildUserPrompt } from './prompts.js'
import { parseLLMResponse } from './schema.js'
import { withRetry } from './retry.js'

/**
 * OllamaLLMClient — runs against a local Ollama instance.
 *
 * Ollama exposes an OpenAI-compatible REST API at /v1, so we reuse the openai
 * package pointed at localhost. No separate Ollama SDK needed.
 *
 * Default base URL: http://localhost:11434/v1
 * Override with OLLAMA_BASE_URL env var or constructor arg.
 */
export class OllamaLLMClient implements LLMClient {
  private readonly client: OpenAI

  constructor(baseURL = 'http://localhost:11434/v1') {
    this.client = new OpenAI({
      baseURL,
      apiKey: 'ollama', // Ollama doesn't validate the key, but the SDK requires one
    })
  }

  async generateTestCases(
    target: TestTarget,
    testTypes: TestType[],
    promptSuffix: string,
    config: CodeCheckConfig,
  ): Promise<TestCase[]> {
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(target, testTypes, promptSuffix)

    let responseText: string

    try {
      responseText = await withRetry(async () => {
        const response = await this.client.chat.completions.create({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        })

        const text = response.choices[0]?.message.content ?? ''
        if (!text) {
          throw new LLMApiError('Ollama returned an empty response')
        }
        return text
      })
    } catch (err) {
      if (err instanceof LLMApiError) throw err
      throw new LLMApiError(
        `Ollama error (is Ollama running at ${this.client.baseURL}?): ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    try {
      const parsed = parseLLMResponse(responseText)
      return parsed.testCases as TestCase[]
    } catch (err) {
      if (err instanceof LLMParseError) throw err
      if (err instanceof SyntaxError) {
        throw new LLMParseError(`Invalid JSON: ${err.message}`, responseText)
      }
      throw new LLMParseError(
        err instanceof Error ? err.message : String(err),
        responseText,
      )
    }
  }
}

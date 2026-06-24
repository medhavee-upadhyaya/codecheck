import OpenAI from 'openai'
import { LLMApiError, LLMParseError } from '../errors.js'
import type { CodeCheckConfig, LLMClient, TestCase, TestTarget, TestType } from '../types.js'
import { buildSystemPrompt, buildUserPrompt } from './prompts.js'
import { parseLLMResponse } from './schema.js'
import { withRetry } from './retry.js'

export class OpenAILLMClient implements LLMClient {
  private readonly client: OpenAI

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      ...(baseURL != null ? { baseURL } : {}),
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
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        })

        const text = response.choices[0]?.message.content ?? ''
        if (!text) {
          throw new LLMApiError('OpenAI returned an empty response')
        }
        return text
      })
    } catch (err) {
      if (err instanceof LLMApiError) throw err
      throw new LLMApiError(err instanceof Error ? err.message : String(err))
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

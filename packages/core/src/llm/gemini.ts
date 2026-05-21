import { GoogleGenerativeAI } from '@google/generative-ai'
import { LLMApiError, LLMParseError } from '../errors.js'
import type { CodeCheckConfig, LLMClient, TestCase, TestTarget, TestType } from '../types.js'
import { buildSystemPrompt, buildUserPrompt } from './prompts.js'
import { parseLLMResponse } from './schema.js'

export class GeminiLLMClient implements LLMClient {
  private readonly genAI: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
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
      const model = this.genAI.getGenerativeModel({
        model: config.model,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      })

      const result = await model.generateContent(userPrompt)
      responseText = result.response.text()

      if (!responseText) {
        throw new LLMApiError('Gemini returned an empty response')
      }
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

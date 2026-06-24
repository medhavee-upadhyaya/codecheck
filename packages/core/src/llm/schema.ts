/**
 * llm/schema.ts — Zod schema for validating LLM JSON responses.
 *
 * The LLM is instructed to return exactly this shape.
 * If it doesn't, LLMParseError is thrown.
 */

import { z } from 'zod'

/**
 * Sanitize LLM output into valid JSON.
 * Handles: undefined, NaN, Infinity, -Infinity, control characters,
 * trailing commas, and single-quoted strings.
 */
function sanitizeLLMJson(text: string): string {
  let s = text

  // Replace bare undefined at value positions with null
  s = s.replace(/:\s*undefined\b/g, ': null')
  s = s.replace(/\[\s*undefined\b/g, '[null')
  s = s.replace(/,\s*undefined\b/g, ', null')

  // Replace NaN, Infinity, -Infinity with null
  s = s.replace(/:\s*-Infinity\b/g, ': null')
  s = s.replace(/:\s*Infinity\b/g, ': null')
  s = s.replace(/:\s*NaN\b/g, ': null')
  s = s.replace(/\[\s*-Infinity\b/g, '[null')
  s = s.replace(/\[\s*Infinity\b/g, '[null')
  s = s.replace(/\[\s*NaN\b/g, '[null')
  s = s.replace(/,\s*-Infinity\b/g, ', null')
  s = s.replace(/,\s*Infinity\b/g, ', null')
  s = s.replace(/,\s*NaN\b/g, ', null')

  // Remove control characters (except \n \r \t) that break JSON.parse
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1')

  return s
}

export const TestTypeSchema = z.enum([
  'unit',
  'smoke',
  'functional',
  'sanity',
  'integration',
  'e2e',
  'api',
  'snapshot',
  'regression',
])

export const TestCaseSchema = z.object({
  /** Human-readable description of what this test checks */
  description: z.string().min(1),
  /** Input value(s) to pass to the function — any JSON-serializable value */
  input: z.unknown(),
  /** Expected output — any JSON-serializable value, or null for void functions */
  expectedOutput: z.unknown(),
  /** Short category label: "happy-path", "edge-case", "null-check", "boundary", "type-error", etc. */
  category: z.string().min(1),
  /** Which test type this case belongs to */
  testType: TestTypeSchema,
  /** If true, the test expects the function to throw */
  shouldThrow: z.boolean().optional(),
  /** Expected error message or class name when shouldThrow is true */
  expectedError: z.string().optional(),
})

export const LLMResponseSchema = z.object({
  testCases: z.array(TestCaseSchema).min(1),
})

export type LLMResponseShape = z.infer<typeof LLMResponseSchema>
export type TestCaseShape = z.infer<typeof TestCaseSchema>

/**
 * Parse and validate a raw LLM response string.
 * Strips markdown code fences if present before parsing JSON.
 *
 * @throws {SyntaxError} if the text is not valid JSON
 * @throws {z.ZodError} if the JSON doesn't match the schema
 */
export function parseLLMResponse(raw: string): LLMResponseShape {
  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  let stripped = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()

  // Replace JS-only tokens that are invalid in JSON.
  // LLMs (especially Gemini) emit these when generating edge-case inputs.
  // We substitute null and let the generator emit a safe call.
  stripped = sanitizeLLMJson(stripped)

  const parsed: unknown = JSON.parse(stripped)
  return LLMResponseSchema.parse(parsed)
}

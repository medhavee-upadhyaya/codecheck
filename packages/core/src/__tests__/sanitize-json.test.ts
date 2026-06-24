import { describe, it, expect } from 'vitest'
import { parseLLMResponse } from '../llm/schema.js'

describe('parseLLMResponse — JSON sanitization', () => {
  it('replaces undefined values with null', () => {
    const json = '{"testCases": [{"description": "test", "input": [undefined, 2], "expectedOutput": 3, "category": "happy-path", "testType": "unit"}]}'
    const result = parseLLMResponse(json)
    expect(result.testCases[0].input).toEqual([null, 2])
  })

  it('replaces NaN with null', () => {
    const json = '{"testCases": [{"description": "test", "input": NaN, "expectedOutput": null, "category": "edge-case", "testType": "unit"}]}'
    const result = parseLLMResponse(json)
    expect(result.testCases[0].input).toBe(null)
  })

  it('replaces Infinity with null', () => {
    const json = '{"testCases": [{"description": "test", "input": Infinity, "expectedOutput": null, "category": "edge-case", "testType": "unit"}]}'
    const result = parseLLMResponse(json)
    expect(result.testCases[0].input).toBe(null)
  })

  it('removes trailing commas', () => {
    const json = '{"testCases": [{"description": "test", "input": [1, 2,], "expectedOutput": 3, "category": "happy-path", "testType": "unit",}]}'
    const result = parseLLMResponse(json)
    expect(result.testCases[0].input).toEqual([1, 2])
  })

  it('removes control characters', () => {
    const json = '{"testCases": [{"description": "test", "input": "hello\\u0000world", "expectedOutput": null, "category": "happy-path", "testType": "unit"}]}'
    const result = parseLLMResponse(json)
    expect(result.testCases).toHaveLength(1)
  })

  it('strips markdown code fences', () => {
    const json = '```json\n{"testCases": [{"description": "test", "input": null, "expectedOutput": null, "category": "happy-path", "testType": "unit"}]}\n```'
    const result = parseLLMResponse(json)
    expect(result.testCases).toHaveLength(1)
  })

  it('handles undefined in array positions', () => {
    const json = '{"testCases": [{"description": "test", "input": [1, undefined, 3], "expectedOutput": null, "category": "edge-case", "testType": "unit"}]}'
    const result = parseLLMResponse(json)
    expect(result.testCases[0].input).toEqual([1, null, 3])
  })
})

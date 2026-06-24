import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LLMApiError } from '../errors.js'

// Mock setTimeout to resolve instantly
vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0 })

// Import after stubbing
const { withRetry } = await import('../llm/retry.js')

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on rate limit (429) and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new LLMApiError('rate limited', 429))
      .mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on rate limit message without status code', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Resource exhausted: too many requests'))
      .mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on 503 server error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new LLMApiError('service unavailable', 503))
      .mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry on non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new LLMApiError('invalid api key', 401))
    await expect(withRetry(fn)).rejects.toThrow('invalid api key')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new LLMApiError('rate limited', 429))
    await expect(withRetry(fn)).rejects.toThrow('rate limited')
    expect(fn).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
  })
})

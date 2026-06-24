import { LLMApiError } from '../errors.js'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

function isRetryable(err: unknown): boolean {
  if (err instanceof LLMApiError) {
    if (err.statusCode === 429) return true
    if (err.statusCode != null && err.statusCode >= 500) return true
  }
  const msg = err instanceof Error ? err.message : String(err)
  return /rate.?limit|429|503|quota|too many requests|resource.?exhausted/i.test(msg)
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        await delay(BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500)
        continue
      }
      throw err
    }
  }
  throw lastErr
}

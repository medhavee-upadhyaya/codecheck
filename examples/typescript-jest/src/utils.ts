/**
 * utils.ts — A rich set of utility functions used to demonstrate CodeCheck.
 *
 * These functions cover a variety of patterns so that both unit and smoke
 * test generation produce meaningful, interesting test cases.
 */

// ─── Math Utilities ──────────────────────────────────────────────────────────

/** Returns the sum of two numbers. */
export function add(a: number, b: number): number {
  return a + b
}

/** Returns the absolute difference between two numbers. */
export function subtract(a: number, b: number): number {
  return Math.abs(a - b)
}

/** Clamps a value between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) throw new Error('min must be <= max')
  return Math.min(Math.max(value, min), max)
}

/** Returns true if n is a prime number. */
export function isPrime(n: number): boolean {
  if (n < 2) return false
  if (n === 2) return true
  if (n % 2 === 0) return false
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false
  }
  return true
}

/** Returns the nth Fibonacci number (0-indexed). Throws for negative n. */
export function fibonacci(n: number): number {
  if (n < 0) throw new Error('n must be >= 0')
  if (n === 0) return 0
  if (n === 1) return 1
  let a = 0
  let b = 1
  for (let i = 2; i <= n; i++) {
    const tmp = a + b
    a = b
    b = tmp
  }
  return b
}

// ─── String Utilities ────────────────────────────────────────────────────────

/** Converts a string to title case. */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Truncates a string to maxLength characters, appending '...' if truncated. */
export function truncate(str: string, maxLength: number): string {
  if (maxLength < 0) throw new Error('maxLength must be >= 0')
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}

/** Returns true if the string is a valid email address. */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

/** Reverses a string. */
export function reverseString(str: string): string {
  return str.split('').reverse().join('')
}

/** Counts the number of words in a string. */
export function wordCount(str: string): number {
  const trimmed = str.trim()
  if (trimmed === '') return 0
  return trimmed.split(/\s+/).length
}

// ─── Array Utilities ─────────────────────────────────────────────────────────

/** Returns the unique elements of an array, preserving order. */
export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

/** Flattens a nested array one level deep. */
export function flatten<T>(arr: T[][]): T[] {
  return arr.reduce((acc, cur) => acc.concat(cur), [])
}

/** Returns the maximum value in an array. Throws if array is empty. */
export function arrayMax(arr: number[]): number {
  if (arr.length === 0) throw new Error('Array must not be empty')
  return Math.max(...arr)
}

/** Groups an array of objects by a key. */
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const item of arr) {
    const k = String(item[key])
    if (!result[k]) result[k] = []
    result[k]!.push(item)
  }
  return result
}

/** Chunks an array into sub-arrays of the given size. */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error('Chunk size must be > 0')
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// ─── Object Utilities ────────────────────────────────────────────────────────

/** Deep-merges source into target (non-mutating). Arrays are replaced, not merged. */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target }
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sv = source[key]
    const tv = target[key]
    if (sv !== null && typeof sv === 'object' && !Array.isArray(sv) && typeof tv === 'object' && tv !== null && !Array.isArray(tv)) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>) as T[keyof T]
    } else if (sv !== undefined) {
      result[key] = sv as T[keyof T]
    }
  }
  return result
}

// ─── Async Utilities ─────────────────────────────────────────────────────────

/** Waits for the given number of milliseconds. */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Retries an async function up to maxRetries times. Throws last error if all fail. */
export async function retry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

/** Returns true if a number is even. */
export function isEven(n: number): boolean {
  return n % 2 === 0
}
// @ts-nocheck
export function multiply(a: number, b: number): number {
  return a * b
}

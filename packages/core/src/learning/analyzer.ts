/**
 * learning/analyzer.ts — Update a ProjectProfile from new test results.
 *
 * Also exports humanizeError(), which translates technical assertion errors
 * into plain-English one-liners for the terminal output.
 */

import type { TestResult } from '../types.js'
import type { ProjectProfile, PassFailCounts } from './profile.js'

// ─── Error humanizer ──────────────────────────────────────────────────────────

/**
 * Translate a raw Jest/pytest error string into a plain-English one-liner.
 * Used by the terminal output plugin to show a "what went wrong" line
 * that any developer can understand at a glance.
 */
export function humanizeError(error: string): string {
  // "expected X to equal Y" / "expected X to deeply equal Y"
  const equalMatch = error.match(/expected (.*?) to (?:deeply )?equal (.*)/)
  if (equalMatch != null) {
    const got = equalMatch[1]?.trim() ?? '?'
    const want = equalMatch[2]?.trim().split('\n')[0] ?? '?'
    return `Returned ${got} but expected ${want}`
  }

  // null/undefined property access
  if (/Cannot read propert(?:y|ies) of (?:null|undefined)/.test(error)) {
    return 'Crashed on null or undefined input — the function needs a null check'
  }

  // "X is not a function"
  if (/is not a function/.test(error)) {
    return 'Function not found or not exported — check the import or spelling'
  }

  // undefined returned when something was expected
  if (/(?:expected.*to be defined|received undefined|toBeUndefined)/i.test(error)) {
    return 'Function returned undefined — it may be missing a return statement'
  }

  // Expected a throw but got none
  if (/(?:did not throw|expected.*to throw|toThrow)/i.test(error)) {
    return 'Expected the function to throw an error, but it completed normally'
  }

  // Timeout
  if (/(?:Timeout|timed out)/i.test(error)) {
    return 'Test timed out — the function may be stuck or missing an await'
  }

  // Syntax error in generated test
  if (/SyntaxError/.test(error)) {
    return 'Generated test has a syntax error — run with keepGeneratedTests: true to inspect'
  }

  // Reference error
  if (/ReferenceError/.test(error)) {
    return 'A variable or import was used before being defined'
  }

  // Type error (catch-all)
  if (/TypeError/.test(error)) {
    return 'Type mismatch — the input or return type may not match what the function expects'
  }

  // AssertionError generic
  if (/AssertionError/.test(error)) {
    return 'The value did not match what was expected'
  }

  // Fallback: first line, truncated
  return error.split('\n')[0]?.slice(0, 100) ?? error.slice(0, 100)
}

// ─── Failure classifier ───────────────────────────────────────────────────────

/** Map a raw error to a short recurring-reason label for the profile */
function classifyFailure(error: string): string {
  if (/Cannot read propert/.test(error)) return 'null/undefined crashes (missing null checks)'
  if (/is not a function/.test(error)) return 'missing or wrong function exports'
  if (/Timeout/i.test(error)) return 'async timeout failures'
  if (/expected.*to equal/i.test(error)) return 'wrong return values'
  if (/did not throw/i.test(error)) return 'expected throws not happening'
  if (/SyntaxError/.test(error)) return 'generated test syntax errors'
  if (/TypeError/.test(error)) return 'type mismatch errors'
  return 'unexpected test failures'
}

// ─── Profile updater ──────────────────────────────────────────────────────────

function increment(
  record: Record<string, PassFailCounts>,
  key: string,
  passed: boolean
): void {
  const existing = record[key]
  if (existing == null) {
    record[key] = { passCount: passed ? 1 : 0, totalCount: 1 }
  } else {
    existing.totalCount++
    if (passed) existing.passCount++
  }
}

/**
 * Merge new test results into the existing profile.
 * Returns a new profile object — does not mutate the input.
 */
export function updateProfile(
  profile: ProjectProfile,
  results: TestResult[]
): ProjectProfile {
  // Deep clone to avoid mutation
  const updated: ProjectProfile = {
    ...profile,
    passRateByTestType: { ...profile.passRateByTestType },
    passRateByCategory: { ...profile.passRateByCategory },
    topFailureReasons: [...profile.topFailureReasons],
    successfulExamples: [...profile.successfulExamples],
  }

  updated.totalRuns++
  updated.lastUpdated = new Date().toISOString()

  const failureCounts: Record<string, number> = {}

  for (const result of results) {
    const { testType, category, description } = result.testCase

    increment(updated.passRateByTestType, testType, result.passed)
    increment(updated.passRateByCategory, category, result.passed)

    if (!result.passed && result.error != null) {
      const reason = classifyFailure(result.error)
      failureCounts[reason] = (failureCounts[reason] ?? 0) + 1
    }

    // Collect successful examples (unique, max 5)
    if (
      result.passed &&
      updated.successfulExamples.length < 5 &&
      !updated.successfulExamples.includes(description)
    ) {
      updated.successfulExamples.push(description)
    }
  }

  // Merge new failure reasons into top-3 list (deduplicated)
  const incomingReasons = Object.entries(failureCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([r]) => r)

  const merged = new Set([...updated.topFailureReasons, ...incomingReasons])
  updated.topFailureReasons = [...merged].slice(0, 3)

  return updated
}

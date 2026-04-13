/**
 * learning/injector.ts — Build the project-profile context string for the LLM prompt.
 *
 * Returns null if there is not enough data yet (< 3 runs), so the prompt
 * stays clean until the profile is meaningful.
 */

import type { ProjectProfile, PassFailCounts } from './profile.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rate(counts: PassFailCounts): number {
  return counts.totalCount === 0 ? 0 : counts.passCount / counts.totalCount
}

function pct(r: number): string {
  return `${Math.round(r * 100)}%`
}

// ─── Context builder ──────────────────────────────────────────────────────────

/**
 * Build a short context block to append to the LLM user prompt.
 *
 * Returns null when < 3 runs have been recorded (not enough signal).
 *
 * Example output injected into the prompt:
 *
 *   ## Project Learning (47 CodeCheck runs)
 *   Pass rates by test type: unit 89%, smoke 95%, integration 52%
 *   Generate more of: null-check (92%), boundary (87%)
 *   Be conservative with: async-behavior (34% pass rate)
 *   Common failures: null/undefined crashes; async timeout failures
 *   Proven test examples:
 *     - "returns null for empty string input"
 *     - "throws RangeError when value exceeds max"
 */
export function buildProfileContext(profile: ProjectProfile): string | null {
  if (profile.totalRuns < 3) return null

  const lines: string[] = [
    `## Project Learning (${profile.totalRuns} CodeCheck runs in this repo)`,
  ]

  // ── Test type pass rates ──
  const typeEntries = Object.entries(profile.passRateByTestType)
    .map(([type, counts]) => `${type} ${pct(rate(counts))}`)

  if (typeEntries.length > 0) {
    lines.push(`Pass rates by test type: ${typeEntries.join(', ')}`)
  }

  // ── High-performing categories (≥ 80%, min 3 samples) — generate more ──
  const goodCategories = Object.entries(profile.passRateByCategory)
    .filter(([, c]) => rate(c) >= 0.8 && c.totalCount >= 3)
    .map(([cat]) => cat)

  if (goodCategories.length > 0) {
    lines.push(`Generate more of these (high pass rate): ${goodCategories.join(', ')}`)
  }

  // ── Low-performing categories (< 50%, min 3 samples) — be conservative ──
  const weakCategories = Object.entries(profile.passRateByCategory)
    .filter(([, c]) => rate(c) < 0.5 && c.totalCount >= 3)
    .map(([cat]) => cat)

  if (weakCategories.length > 0) {
    lines.push(`Be conservative with these (low pass rate): ${weakCategories.join(', ')}`)
  }

  // ── Failure patterns to avoid ──
  if (profile.topFailureReasons.length > 0) {
    lines.push(`Common failures in this project: ${profile.topFailureReasons.join('; ')}`)
  }

  // ── Successful examples ──
  if (profile.successfulExamples.length > 0) {
    lines.push(`Proven test descriptions that pass in this project:`)
    for (const ex of profile.successfulExamples.slice(0, 3)) {
      lines.push(`  - "${ex}"`)
    }
  }

  lines.push(
    `Tailor test cases to match what actually works in this codebase.`
  )

  return lines.join('\n')
}

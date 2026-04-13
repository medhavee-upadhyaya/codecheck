/**
 * @codecheck/scope-regression — Regression test scope plugin.
 *
 * Reads the flakiness store from `.codecheck-results/flakiness.json` and
 * prioritizes extracting test targets for functions that have previously
 * failed. This ensures that known-bad code paths get retested on every commit.
 *
 * Regression tests are like unit tests but with extra focus on:
 *   - The exact input that caused the previous failure
 *   - Boundary conditions around the failure
 *   - The specific error message that was thrown
 *
 * Functions with no failure history are still tested but deprioritized.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { extractTargets } from '@codecheck/core'
import type { CodeCheckConfig, ScopePlugin, TestTarget, TestType } from '@codecheck/core'

// ─── Flakiness store shape (mirrors output-dashboard) ────────────────────────

interface FlakinessEntry {
  targetName: string
  filePath: string
  testType: string
  passCount: number
  failCount: number
  totalRuns: number
  isFlaky: boolean
  lastStatus: 'passed' | 'failed'
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export class RegressionScopePlugin implements ScopePlugin {
  readonly name: TestType = 'regression'
  readonly testTypes: TestType[] = ['regression']

  async extractTargets(files: string[], config: CodeCheckConfig): Promise<TestTarget[]> {
    const cwd = process.cwd()
    const failureSet = await loadFailureSet(cwd)

    const groups = await Promise.allSettled(files.map((f) => extractTargets(f)))
    const allTargets: TestTarget[] = []

    for (const result of groups) {
      if (result.status === 'fulfilled') {
        allTargets.push(...result.value)
      }
    }

    if (failureSet.size === 0) {
      // No failure history — run on all targets (first-time regression pass)
      return allTargets
    }

    // Sort: previously-failed functions first, then the rest
    const failed: TestTarget[] = []
    const others: TestTarget[] = []

    for (const target of allTargets) {
      const key = `${target.filePath}::${target.name}`
      if (failureSet.has(key)) {
        failed.push(target)
      } else {
        others.push(target)
      }
    }

    // Return failed first — engine will process them in order
    return [...failed, ...others]
  }

  buildPrompt(target: TestTarget, _testType: TestType): string {
    return buildRegressionPrompt(target)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Load the set of (filePath::functionName) keys that have at least one failure
 * in the flakiness store.
 */
async function loadFailureSet(cwd: string): Promise<Set<string>> {
  const flakinessPath = path.join(cwd, '.codecheck-results', 'flakiness.json')
  try {
    const raw = await fs.readFile(flakinessPath, 'utf8')
    const store = JSON.parse(raw) as Record<string, FlakinessEntry>
    const set = new Set<string>()
    for (const entry of Object.values(store)) {
      if (entry.failCount > 0) {
        set.add(`${entry.filePath}::${entry.targetName}`)
      }
    }
    return set
  } catch {
    return new Set()
  }
}

function buildRegressionPrompt(target: TestTarget): string {
  return REGRESSION_PROMPT_SUFFIX
}

const REGRESSION_PROMPT_SUFFIX = `## Regression Test Instructions

Generate regression tests for this function. These tests specifically target scenarios that are likely to have caused failures in the past.

Regression tests answer: "Do previously-broken behaviors stay fixed?"

Focus on:
1. **Failure-prone inputs** — inputs that are commonly mishandled: empty strings, zero, negative numbers, null-like values, malformed objects, empty arrays
2. **Off-by-one errors** — boundary values: max - 1, max, max + 1, 0, 1, -1
3. **Type coercion traps** — inputs where JavaScript silently converts types: "0", false, NaN, undefined vs null
4. **Previously-observed error patterns** — if the function mutates state, test that state is clean after errors
5. **Re-entry correctness** — calling the function twice with the same input should produce the same output

Rules:
- Generate 3–5 test cases, all specifically targeting inputs that are likely to trigger edge-case failures
- Prefer inputs that are ALMOST valid (e.g., one field missing from an object) over obviously invalid ones
- Do NOT test happy-path scenarios that clearly work — focus on the grey zone
- All testType values must be "regression"
- If the function has thrown errors before, test the exact error condition with shouldThrow: true`

export default RegressionScopePlugin

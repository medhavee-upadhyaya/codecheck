/**
 * @codecheck/scope-smoke — Smoke test scope plugin.
 *
 * Generates smoke tests focused on:
 *   - Critical happy path — does the function work at all?
 *   - Return value shape — is the output the right type/structure?
 *   - No crash — does the function run without throwing on valid input?
 *
 * Deliberately minimal: 1–3 tests per function. Fast, low noise.
 * Smoke tests catch regressions and wiring issues, not logic bugs.
 */

import { extractTargets } from '@codecheck/core'
import type { CodeCheckConfig, ScopePlugin, TestTarget, TestType } from '@codecheck/core'

export class SmokeScopePlugin implements ScopePlugin {
  readonly name: TestType = 'smoke'
  readonly testTypes: TestType[] = ['smoke']

  async extractTargets(files: string[], _config: CodeCheckConfig): Promise<TestTarget[]> {
    const groups = await Promise.allSettled(files.map((f) => extractTargets(f)))
    const targets: TestTarget[] = []
    for (const result of groups) {
      if (result.status === 'fulfilled') {
        targets.push(...result.value)
      }
    }
    return targets
  }

  buildPrompt(_target: TestTarget, _testType: TestType): string {
    return SMOKE_PROMPT_SUFFIX
  }
}

const SMOKE_PROMPT_SUFFIX = `## Smoke Test Instructions

Generate smoke tests that answer one question: "Does this function basically work?"

Focus on:
1. **Critical happy path** — 1 test with the most typical, representative input that produces the expected output
2. **Return value sanity** — the function returns the right type (number, string, object, etc.) — not null when it shouldn't be
3. **No crash on valid input** — the function runs without throwing an exception

Rules:
- Generate exactly 2–3 test cases maximum. No more.
- Choose inputs that a real user would most likely pass
- Do NOT test edge cases — that is what unit tests are for
- Do NOT generate tests with shouldThrow: true (smoke tests assume valid usage)
- Descriptions must be clear: "add returns correct sum for two numbers" not "basic test"
- All testType values must be "smoke"
- Keep it simple: if the function works for the typical case, the smoke test passes`

export default SmokeScopePlugin

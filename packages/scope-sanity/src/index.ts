/**
 * @codecheck/scope-sanity — Sanity test scope plugin.
 *
 * Generates sanity tests focused on:
 *   - Module/function is importable and callable
 *   - Returns a value of the correct type (not undefined/null when it shouldn't)
 *   - Does not throw on the most basic valid input
 *   - Basic output shape: if it returns an object, key fields exist
 *
 * Sanity tests are the first line of defence. They catch:
 *   - Wiring errors (function exported but not implemented)
 *   - Refactor accidents (return type changed silently)
 *   - Build errors that produce undefined exports
 *
 * Deliberately minimal: exactly 1–2 tests per function. Even faster than smoke.
 */

import { extractTargets } from '@codecheck/core'
import type { CodeCheckConfig, ScopePlugin, TestTarget, TestType } from '@codecheck/core'

export class SanityScopePlugin implements ScopePlugin {
  readonly name: TestType = 'sanity'
  readonly testTypes: TestType[] = ['sanity']

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
    return SANITY_PROMPT_SUFFIX
  }
}

const SANITY_PROMPT_SUFFIX = `## Sanity Test Instructions

Generate sanity tests that answer one question: "Is this function alive and basically wired up?"

Sanity tests are the absolute minimum verification — they catch broken exports, undefined returns, and complete wiring failures.

Focus on:
1. **Callable** — the function can be called without throwing an exception on the simplest valid input
2. **Returns a value** — the return value is not undefined (unless the function is explicitly void)
3. **Correct type** — the return value is the right type (use typeof or Array.isArray checks in expectedOutput)

Rules:
- Generate EXACTLY 1–2 test cases. No more.
- Use the absolute simplest valid input — the most obvious default values
- Do NOT test logic, edge cases, or correctness — only that it runs and returns something
- Do NOT generate shouldThrow tests
- Descriptions should be direct: "add is callable and returns a number" not "basic test"
- All testType values must be "sanity"
- If the function is async, the test should still work (the generator handles await automatically)`

export default SanityScopePlugin

/**
 * @codecheck/scope-unit — Unit test scope plugin.
 *
 * Generates unit tests focused on:
 *   - Happy path with typical inputs
 *   - Edge cases: empty, zero, negative, large values
 *   - Boundary conditions: min/max, off-by-one
 *   - Null / undefined inputs
 *   - Type edge cases
 *   - Error conditions (functions that should throw)
 *
 * Produces 4–8 test cases per function, covering all critical paths.
 */

import { extractTargets } from '@codecheck/core'
import type { CodeCheckConfig, ScopePlugin, TestTarget, TestType } from '@codecheck/core'

export class UnitScopePlugin implements ScopePlugin {
  readonly name: TestType = 'unit'
  readonly testTypes: TestType[] = ['unit']

  async extractTargets(files: string[], _config: CodeCheckConfig): Promise<TestTarget[]> {
    const groups = await Promise.allSettled(files.map((f) => extractTargets(f)))
    const targets: TestTarget[] = []
    for (const result of groups) {
      if (result.status === 'fulfilled') {
        // Unit tests apply to functions and classes — not endpoints
        targets.push(...result.value.filter((t) => t.targetType !== 'endpoint'))
      }
    }
    return targets
  }

  buildPrompt(_target: TestTarget, _testType: TestType): string {
    return UNIT_PROMPT_SUFFIX
  }
}

const UNIT_PROMPT_SUFFIX = `## Unit Test Instructions

Generate unit tests that exhaustively verify the function's correctness in isolation. Focus on:

1. **Happy path** — 1–2 tests with typical, valid inputs that produce correct output
2. **Edge cases** — empty strings, zero, negative numbers, empty arrays, single-element arrays, very large numbers
3. **Boundary conditions** — off-by-one values, min/max boundaries (e.g. 0 vs 1, array[-1] vs array[0])
4. **Null / undefined** — what happens when null or undefined is passed as an argument
5. **Type edge cases** — NaN, Infinity, wrong types (cast with \`as any\` in the test)
6. **Error conditions** — inputs that should cause the function to throw (set shouldThrow: true)

Rules:
- Generate at least 4 test cases, aiming for 6–8
- Every test must have a specific, verifiable expectedOutput
- Descriptions must be concrete: "returns -1 for empty array" not "handles edge case"
- For shouldThrow tests, always provide expectedError with the error message
- Do NOT generate tests that simply verify the function "exists" or "is defined"
- All testType values must be "unit"`

export default UnitScopePlugin

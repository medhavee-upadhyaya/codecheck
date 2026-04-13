/**
 * @codecheck/scope-functional — Functional test scope plugin.
 *
 * Generates functional tests focused on:
 *   - Input/output behavior verification without mocking
 *   - Correct transformation of data through the function
 *   - Real logic verification with representative inputs
 *   - Purity and determinism (same input → same output)
 *   - Composition: does the function work within a realistic pipeline?
 *
 * Unlike unit tests, functional tests do NOT mock dependencies —
 * they test the actual behaviour end-to-end within the function's scope.
 * Unlike integration tests, they stay within a single module boundary.
 *
 * Produces 3–6 test cases per function.
 */

import { extractTargets } from '@codecheck/core'
import type { CodeCheckConfig, ScopePlugin, TestTarget, TestType } from '@codecheck/core'

export class FunctionalScopePlugin implements ScopePlugin {
  readonly name: TestType = 'functional'
  readonly testTypes: TestType[] = ['functional']

  async extractTargets(files: string[], _config: CodeCheckConfig): Promise<TestTarget[]> {
    const groups = await Promise.allSettled(files.map((f) => extractTargets(f)))
    const targets: TestTarget[] = []
    for (const result of groups) {
      if (result.status === 'fulfilled') {
        // Functional tests apply to functions and classes — not endpoints
        targets.push(...result.value.filter((t) => t.targetType !== 'endpoint'))
      }
    }
    return targets
  }

  buildPrompt(_target: TestTarget, _testType: TestType): string {
    return FUNCTIONAL_PROMPT_SUFFIX
  }
}

const FUNCTIONAL_PROMPT_SUFFIX = `## Functional Test Instructions

Generate functional tests that verify the function's input/output behaviour without any mocking.

Functional tests answer: "Given this real input, does the function produce the correct real output?"

Focus on:
1. **Data transformation** — verify that the function correctly transforms its inputs into the expected output
2. **Realistic inputs** — use inputs that reflect real-world usage, not toy values
3. **Determinism** — the same input should always produce the same output; test this with 2+ calls implicitly by using concrete values
4. **Composition correctness** — if the function is typically chained or used with other functions, test a representative pipeline scenario
5. **Contract verification** — the function does what its name and signature promise, no more, no less

Rules:
- Generate 3–6 test cases
- Do NOT mock dependencies — test real behaviour
- Do NOT test implementation details, only observable output
- Use realistic domain values (e.g., actual user IDs, realistic strings, real-world numbers)
- Descriptions must state the exact transformation: "maps array of users to their IDs" not "works correctly"
- All testType values must be "functional"
- shouldThrow tests are allowed if the function has documented error conditions`

export default FunctionalScopePlugin

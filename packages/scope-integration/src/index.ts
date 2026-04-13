/**
 * @codecheck/scope-integration — Integration test scope plugin.
 *
 * Generates integration tests focused on:
 *   - Multi-function or multi-module flows (function A feeds into function B)
 *   - Real dependency interactions (no mocking at module boundaries)
 *   - Data flow across a realistic usage pipeline
 *   - Side effects that span module boundaries (e.g., state persisted via another module)
 *
 * Integration tests sit between unit and E2E:
 *   - Wider than unit: crosses function/module boundaries
 *   - Narrower than E2E: no browser, no network calls (unless the module explicitly does them)
 *
 * Produces 2–4 test cases per target, each describing a cross-boundary scenario.
 */

import { extractTargets } from '@codecheck/core'
import type { CodeCheckConfig, ScopePlugin, TestTarget, TestType } from '@codecheck/core'

export class IntegrationScopePlugin implements ScopePlugin {
  readonly name: TestType = 'integration'
  readonly testTypes: TestType[] = ['integration']

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
    return INTEGRATION_PROMPT_SUFFIX
  }
}

const INTEGRATION_PROMPT_SUFFIX = `## Integration Test Instructions

Generate integration tests that verify how this function works within a larger flow or alongside other functions from the same module.

Integration tests answer: "Does this function work correctly when used as part of a real multi-step pipeline?"

Focus on:
1. **Pipeline flows** — show the function receiving output from another function, or its output being passed to another
2. **Real usage patterns** — model a realistic sequence of calls a developer would actually make
3. **Cross-boundary correctness** — verify that data flows correctly across the function boundary without data loss or mutation
4. **Stateful scenarios** — if relevant, show that the function handles state from a previous operation correctly

Rules:
- Generate 2–4 test cases
- Each test should involve at least 2 operations or function calls in the test body — not just a single call
- Use realistic, domain-appropriate values
- Do NOT mock other functions from the same module — call them for real
- Descriptions must name the flow: "chunk then flatten returns original elements" not "integration works"
- All testType values must be "integration"
- If no meaningful cross-boundary flow exists, test the function in a loop or repeated-call scenario`

export default IntegrationScopePlugin

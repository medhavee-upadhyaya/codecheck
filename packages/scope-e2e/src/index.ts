/**
 * @codecheck/scope-e2e — Playwright E2E test scope plugin.
 *
 * Generates end-to-end tests that simulate full user flows in a real browser
 * using Playwright. Tests cover complete journeys: navigation, interactions,
 * form submissions, and observable UI outcomes.
 *
 * Unlike unit or integration tests, E2E tests treat the application as a
 * black box — they drive it through a real browser and assert on what the
 * user actually sees.
 *
 * Produces 2–4 test cases per endpoint/handler function.
 */

import { extractTargets } from '@codecheck/core'
import type { CodeCheckConfig, ScopePlugin, TestTarget, TestType } from '@codecheck/core'

const E2E_HANDLER_PATTERNS = /handler|controller|route|endpoint|middleware|page|screen/i

export class E2EScopePlugin implements ScopePlugin {
  readonly name: TestType = 'e2e'
  readonly testTypes: TestType[] = ['e2e']

  async extractTargets(files: string[], _config: CodeCheckConfig): Promise<TestTarget[]> {
    const groups = await Promise.allSettled(files.map((f) => extractTargets(f)))
    const targets: TestTarget[] = []
    for (const result of groups) {
      if (result.status === 'fulfilled') {
        // E2E tests apply to endpoints and handler functions
        targets.push(
          ...result.value.filter(
            (t) => t.targetType === 'endpoint' || E2E_HANDLER_PATTERNS.test(t.name),
          ),
        )
      }
    }
    return targets
  }

  buildPrompt(_target: TestTarget, _testType: TestType): string {
    return E2E_PROMPT_SUFFIX
  }
}

const E2E_PROMPT_SUFFIX = `## E2E Test Instructions

Generate Playwright end-to-end tests that simulate full user flows in a real browser.

E2E tests answer: "When a real user navigates to this feature and performs these actions, does the application behave correctly?"

Each test must describe a complete user journey — from opening a page to observing the final outcome.

Focus on:
1. **Critical user paths** — the most important flows that users actually perform (login, checkout, form submit, navigation)
2. **Observable outcomes** — assert on what the user sees: page titles, visible text, element states, URL changes, success/error messages
3. **Full interactions** — include page.goto(), page.click(), page.fill(), page.waitForSelector() as appropriate
4. **Error flows** — what happens when the user provides invalid input or hits a broken state
5. **Browser-realistic behaviour** — test with real HTTP, real DOM, real navigation; no mocks

Test structure:
- \`input\` must be a plain object describing the user scenario: \`{ url, actions: [...], expectedOutcome }\`
- \`expectedOutput\` must be: \`{ visible: string[], url?: string, title?: string }\`
- Use descriptions like: "user submits login form with valid credentials and sees dashboard"
- testType must be "e2e"

Rules:
- Generate 2–4 test cases per function/endpoint
- Every test must involve at least one navigation and one assertion
- Include at least one failure/error flow (invalid input, 404, unauthorized)
- Do NOT mock the browser, network, or DOM
- Descriptions must be specific user-facing actions, not implementation details`

export default E2EScopePlugin

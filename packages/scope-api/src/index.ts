/**
 * @codecheck/scope-api — API test scope plugin.
 *
 * Generates API tests focused on:
 *   - HTTP endpoints: correct status codes, response shapes, error codes
 *   - Request validation: missing fields, invalid types, auth failures
 *   - Success and error response bodies
 *   - Content-Type headers and body encoding
 *
 * Applies to functions/classes with targetType 'endpoint' OR functions
 * whose name/signature suggests HTTP handling (handler, controller, route, etc.).
 *
 * Produces 3–6 test cases per endpoint covering success and error paths.
 */

import { extractTargets } from '@codecheck/core'
import type { CodeCheckConfig, ScopePlugin, TestTarget, TestType } from '@codecheck/core'

export class ApiScopePlugin implements ScopePlugin {
  readonly name: TestType = 'api'
  readonly testTypes: TestType[] = ['api']

  async extractTargets(files: string[], _config: CodeCheckConfig): Promise<TestTarget[]> {
    const groups = await Promise.allSettled(files.map((f) => extractTargets(f)))
    const targets: TestTarget[] = []
    for (const result of groups) {
      if (result.status === 'fulfilled') {
        // API tests target endpoints AND functions that look like HTTP handlers
        const all = result.value
        const apiTargets = all.filter((t) => {
          if (t.targetType === 'endpoint') return true
          // Also pick up handler/controller/route functions by naming convention
          const n = t.name.toLowerCase()
          return (
            n.includes('handler') ||
            n.includes('controller') ||
            n.includes('route') ||
            n.includes('endpoint') ||
            n.includes('middleware') ||
            n.includes('resolver')
          )
        })
        // If no API-specific targets found, fall back to all targets
        // so the plugin still produces output for non-API codebases
        targets.push(...(apiTargets.length > 0 ? apiTargets : all))
      }
    }
    return targets
  }

  buildPrompt(_target: TestTarget, _testType: TestType): string {
    return API_PROMPT_SUFFIX
  }
}

const API_PROMPT_SUFFIX = `## API Test Instructions

Generate API tests that verify HTTP request/response behaviour for this function or endpoint.

API tests answer: "Given this HTTP request, does the function return the correct status code, headers, and body?"

Focus on:
1. **Happy path** — a valid request returns the expected 2xx status and correct response body shape
2. **Validation errors** — missing required fields or invalid values return 400 with a descriptive error message
3. **Auth failures** — unauthenticated or unauthorized requests return 401/403
4. **Not found** — requests for non-existent resources return 404
5. **Error handling** — server-side errors return 500 with an error body (not a stack trace)

Rules:
- Generate 3–6 test cases covering the paths above
- For input, use an object that represents the HTTP request: { method, path, body, headers, query }
- For expectedOutput, use an object: { status, body } — include the status code and key body fields
- Descriptions must name the scenario: "POST /users with valid body returns 201 and user ID" not "success case"
- All testType values must be "api"
- If the function is not an HTTP handler, adapt: treat its primary argument as the "request" and return value as the "response"`

export default ApiScopePlugin

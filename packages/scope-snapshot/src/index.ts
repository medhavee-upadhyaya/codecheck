/**
 * @codecheck/scope-snapshot — React component snapshot test scope plugin.
 *
 * Generates React component snapshot tests using Jest + React Testing Library.
 * Tests render components with representative prop combinations and assert
 * that the rendered output matches a stored snapshot.
 *
 * Snapshots catch unintended UI regressions — if a component's render output
 * changes unexpectedly, the test fails and the developer must review and
 * explicitly approve the change.
 *
 * Produces 2–4 test cases per React component.
 */

import { extractTargets } from '@codecheck/core'
import type { CodeCheckConfig, ScopePlugin, TestTarget, TestType } from '@codecheck/core'

// React components: PascalCase names, likely return JSX
const COMPONENT_PATTERNS = /^[A-Z][a-zA-Z0-9]*$/

export class SnapshotScopePlugin implements ScopePlugin {
  readonly name: TestType = 'snapshot'
  readonly testTypes: TestType[] = ['snapshot']

  async extractTargets(files: string[], _config: CodeCheckConfig): Promise<TestTarget[]> {
    const groups = await Promise.allSettled(files.map((f) => extractTargets(f)))
    const targets: TestTarget[] = []
    for (const result of groups) {
      if (result.status === 'fulfilled') {
        // Snapshot tests apply to React components (PascalCase functions/classes)
        targets.push(
          ...result.value.filter(
            (t) =>
              (t.targetType === 'function' || t.targetType === 'class') &&
              COMPONENT_PATTERNS.test(t.name),
          ),
        )
      }
    }
    return targets
  }

  buildPrompt(_target: TestTarget, _testType: TestType): string {
    return SNAPSHOT_PROMPT_SUFFIX
  }
}

const SNAPSHOT_PROMPT_SUFFIX = `## Snapshot Test Instructions

Generate React component snapshot tests using React Testing Library and Jest's toMatchSnapshot().

Snapshot tests answer: "Given these props, does this component render the correct UI structure?"

Each test renders the component with a specific set of props and captures the rendered output as a snapshot.
If the component's render output ever changes, the test will fail until the snapshot is explicitly updated.

Focus on:
1. **Default props** — render with minimal/default props and snapshot the result
2. **Key prop variations** — render with each significant prop variation that changes the visual output
3. **Edge case props** — empty arrays, long strings, null/undefined optional props
4. **State-driven UI** — if the component has loading/error/empty states, snapshot each one
5. **Accessibility** — rendered HTML should include ARIA attributes; snapshot will catch regressions

Test structure:
- \`input\` must be a plain object representing the props passed to the component: \`{ propName: value, ... }\`
- \`expectedOutput\` must be null — snapshots are captured on first run and compared automatically
- Use descriptions like: "renders Button with primary variant and label text" not "works correctly"
- testType must be "snapshot"

Generated test code pattern:
\`\`\`
import { render } from '@testing-library/react'
it('description', () => {
  const { container } = render(<ComponentName {...props} />)
  expect(container).toMatchSnapshot()
})
\`\`\`

Rules:
- Generate 2–4 test cases per component
- Each test must use a distinct prop combination that produces meaningfully different output
- Do NOT assert on specific text or DOM nodes — let the snapshot do that
- Do NOT test event handlers in snapshot tests (use unit tests for that)
- \`expectedOutput\` is always null (snapshot comparison is automatic)
- testType must be "snapshot"`

export default SnapshotScopePlugin

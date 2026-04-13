# Plugin Reference

CodeCheck is built around a three-layer plugin system. Each layer is independently installable.

```
Layer 1 — Trigger    When does CodeCheck run?
Layer 2 — Scope      What tests does it generate?
Layer 3 — Output     Where does it report results?
```

---

## Layer 1 — Trigger Plugins

### `@codecheck/trigger-oncommit`

Runs CodeCheck as a git pre-commit hook. Tests only the files staged for commit.

**Install:**
```bash
npm install -D @codecheck/trigger-oncommit
npx husky init
echo "npx codecheck" > .husky/pre-commit
```

**Flags:**
```bash
npx codecheck --dry-run    # show staged files without testing
npx codecheck --dry        # alias for --dry-run
```

**Config key:** `"trigger": "oncommit"`

---

### `@codecheck/trigger-onsave`

Watches your source files and runs CodeCheck whenever you save. Uses [chokidar](https://github.com/paulmillr/chokidar) with a 300ms debounce.

**Install:**
```bash
npm install -D @codecheck/trigger-onsave
```

**Usage:**
```bash
ANTHROPIC_API_KEY=sk-ant-... npx codecheck-watch
npx codecheck-watch ./src          # watch specific directory
npx codecheck-watch --dry-run      # watch without calling LLM
```

**Config key:** `"trigger": "onsave"`

---

## Layer 2 — Scope Plugins

Scope plugins control what gets tested and what prompt suffix guides the LLM.

### `@codecheck/scope-unit`

Generates edge case, boundary, and null-check tests. The most thorough type.

```json
{ "testTypes": ["unit"] }
```

Covers: happy path, empty inputs, null/undefined, boundary values, type errors, error conditions.

---

### `@codecheck/scope-smoke`

Generates 1–2 sanity checks: "does the function run without throwing, and does it return the right type?"

```json
{ "testTypes": ["smoke"] }
```

Best used alongside `unit`.

---

### `@codecheck/scope-functional`

Generates input/output behavior tests without any mocking. Tests real logic with realistic data.

```json
{ "testTypes": ["functional"] }
```

Best for: pure functions, data transformers, string/array utilities.

---

### `@codecheck/scope-sanity`

Generates 1–2 ultra-minimal tests: "can I call this and get something back?"

```json
{ "testTypes": ["sanity"] }
```

Best for: checking that new functions are wired up correctly before adding full tests.

---

### `@codecheck/scope-integration`

Generates tests that exercise 2+ functions together in a real pipeline.

```json
{ "testTypes": ["integration"] }
```

Best for: service layers, orchestrators, functions that call other functions from the same module.

---

### `@codecheck/scope-api`

Generates HTTP request/response tests. Expects functions with a `Request`-like input and `Response`-like output.

```json
{ "testTypes": ["api"] }
```

Covers: happy path, validation errors, auth failures, 404s, server errors.

Auto-detects functions with names matching: `handler`, `controller`, `route`, `endpoint`, `middleware`, `resolver`.

---

### `@codecheck/scope-snapshot`

Generates React component snapshot tests using React Testing Library.

```json
{ "testTypes": ["snapshot"] }
```

Auto-detects components by PascalCase function/class names.

Generated tests use `render()` + `toMatchSnapshot()`. Snapshots are captured on first run and compared automatically thereafter.

---

### `@codecheck/scope-e2e`

Generates Playwright end-to-end tests that simulate full user flows in a browser.

```json
{ "testTypes": ["e2e"] }
```

Auto-detects endpoint handlers and functions named with `handler`, `controller`, `page`, `screen`, etc.

---

### `@codecheck/scope-regression`

Generates tests specifically targeting functions that have previously failed. Reads the flakiness store from `.codecheck-results/flakiness.json` and prioritizes those functions.

```json
{ "testTypes": ["regression"] }
```

Focuses on: failure-prone inputs, off-by-one errors, type coercion traps, and re-entry correctness.

---

## Layer 3 — Output Plugins

### `@codecheck/output-terminal`

Prints colored, formatted results to the console. Always included by default.

```json
{ "output": ["terminal"] }
```

Example output:
```
  src/utils.ts
    ✓ add returns sum of two positive numbers   8ms
    ✓ add handles negative numbers              6ms
    ✗ add throws on NaN input                  11ms
      AssertionError: expected undefined to equal NaN

  2 passed · 1 failed · 67%
```

---

### `@codecheck/output-github`

Posts a summary comment on GitHub pull requests. Creates a new comment on first run; updates the same comment on subsequent runs (identified by an HTML marker).

```json
{ "output": ["github"] }
```

**Required environment variables:**
```bash
GITHUB_TOKEN=ghp_...        # personal access token with repo scope
GITHUB_REPO=owner/repo      # e.g. medhavee/codecheck
GITHUB_PR=123               # pull request number
```

In GitHub Actions, these are typically set automatically.

---

### `@codecheck/output-dashboard`

Writes structured JSON results to `.codecheck-results/` and serves a web dashboard.

```json
{ "output": ["dashboard"] }
```

**Files written:**
- `.codecheck-results/latest.json` — full results of the most recent run
- `.codecheck-results/history.json` — last 50 run summaries
- `.codecheck-results/flakiness.json` — per-test pass/fail history

**Serve the dashboard:**
```bash
npx codecheck-serve            # http://localhost:3333
npx codecheck-serve --port 8080
```

**Dashboard features:**
- Pass rate card with progress bar
- Run history trend (color-coded bars)
- Results table grouped by file, with error messages
- Flakiness tab — shows tests that flip between pass/fail
- Auto-refreshes every 5 seconds

**Flakiness detection:**  
A test is marked flaky when it has both passed and failed across 3+ runs.

---

## Building a custom plugin

### Custom scope plugin

```typescript
import type { ScopePlugin, TestTarget, TestType, CodeCheckConfig } from '@codecheck/core'
import { extractTargets } from '@codecheck/core'

export class MyCustomScope implements ScopePlugin {
  readonly name: TestType = 'unit' // or a custom string
  readonly testTypes: TestType[] = ['unit']

  async extractTargets(files: string[], config: CodeCheckConfig): Promise<TestTarget[]> {
    // Return the functions/classes to test
    const results = await Promise.allSettled(files.map(f => extractTargets(f)))
    return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  }

  buildPrompt(target: TestTarget, testType: TestType): string {
    // Return the prompt suffix that guides the LLM
    return `Generate ${testType} tests for this function.`
  }
}
```

### Custom output plugin

```typescript
import type { OutputPlugin, TestResult, CodeCheckConfig } from '@codecheck/core'

export class MyOutput implements OutputPlugin {
  readonly name = 'my-output'

  async report(results: TestResult[], config: CodeCheckConfig): Promise<void> {
    const passed = results.filter(r => r.passed).length
    console.log(`${passed}/${results.length} tests passed`)
  }
}
```

# CodeCheck

**AI-powered, zero-config self-testing for developers.**

One install. One config block. CodeCheck reads your code, generates tests with Claude AI, runs them automatically on every commit, and reports results — no test files to write.

```bash
npm install -D @codecheck/trigger-oncommit @codecheck/scope-unit @codecheck/scope-smoke @codecheck/output-terminal
npx codecheck-init
```

```
git commit -m "feat: add user auth"

  ◆ CodeCheck  claude-sonnet-4-6 · unit + smoke

  src/auth.ts
    ✓ validateToken returns true for valid JWT        12ms
    ✓ validateToken throws on expired token           8ms
    ✓ validateToken returns false for tampered token  9ms
    ✓ hashPassword produces consistent output         14ms
    ✗ hashPassword handles empty string               6ms

  4 passed · 1 failed · 80% pass rate
```

---

## Why CodeCheck?

| Before | After |
|---|---|
| Write tests manually for every function | Tests generated and run automatically |
| Miss edge cases and null checks | AI finds boundary conditions you'd skip |
| Test coverage depends on discipline | Coverage is a side effect of committing |
| Context-switch to write tests | Stay in flow — tests happen in the background |

---

## Install

```bash
npm install -D \
  @codecheck/trigger-oncommit \
  @codecheck/scope-unit \
  @codecheck/scope-smoke \
  @codecheck/output-terminal

npx codecheck-init
```

Or pick individual packages:

```bash
# More test types
npm install -D @codecheck/scope-functional    # I/O behavior, no mocks
npm install -D @codecheck/scope-integration   # multi-function flows
npm install -D @codecheck/scope-api           # HTTP request/response
npm install -D @codecheck/scope-e2e           # Playwright browser flows
npm install -D @codecheck/scope-snapshot      # React component snapshots
npm install -D @codecheck/scope-regression    # re-tests previously-failed functions

# Triggers
npm install -D @codecheck/trigger-onsave      # watches files while you code

# Outputs
npm install -D @codecheck/output-github       # PR comments
npm install -D @codecheck/output-dashboard    # web dashboard + flakiness tracking
```

---

## Setup

### Option A — Init wizard (recommended)

```bash
npx codecheck-init
```

Asks 8 questions and writes your config in under 60 seconds.

### Option B — Manual config

Add to `package.json`:

```json
{
  "codecheck": {
    "trigger": "oncommit",
    "testTypes": ["unit", "smoke"],
    "output": ["terminal"],
    "model": "claude-sonnet-4-6",
    "language": "typescript",
    "framework": "jest",
    "threshold": 0.8,
    "failOnError": false
  }
}
```

Set your API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Set up the git hook:

```bash
npx husky init
echo "npx codecheck" > .husky/pre-commit
```

---

## Configuration Reference

| Key | Type | Default | Description |
|---|---|---|---|
| `trigger` | `oncommit\|onsave\|ci` | `oncommit` | When to run tests |
| `testTypes` | `string[]` | `["unit","smoke"]` | Which test types to generate |
| `output` | `string[]` | `["terminal"]` | Where to report results |
| `model` | `string` | `claude-sonnet-4-6` | AI model to use |
| `language` | `typescript\|javascript\|python` | `typescript` | Project language |
| `framework` | `jest\|vitest\|pytest` | `jest` | Test runner |
| `threshold` | `number` | `0.8` | Min pass rate (0–1) |
| `failOnError` | `boolean` | `false` | Block commit if below threshold |
| `exclude` | `string[]` | `["node_modules","dist"]` | Files/patterns to skip |
| `concurrency` | `number` | `3` | Max parallel LLM calls |
| `cacheTtlDays` | `number` | `7` | Cache LLM responses for N days |
| `keepGeneratedTests` | `boolean` | `false` | Keep generated test files |

---

## Test Types

| Type | Package | What it generates |
|---|---|---|
| `unit` | `@codecheck/scope-unit` | Edge cases, boundary conditions, null checks |
| `smoke` | `@codecheck/scope-smoke` | Happy path, does-it-run checks |
| `functional` | `@codecheck/scope-functional` | I/O behavior, no mocks, real logic |
| `sanity` | `@codecheck/scope-sanity` | 1–2 basic callable/returns-something tests |
| `integration` | `@codecheck/scope-integration` | Multi-function pipeline flows |
| `api` | `@codecheck/scope-api` | HTTP request/response, status codes |
| `snapshot` | `@codecheck/scope-snapshot` | React component snapshots |
| `e2e` | `@codecheck/scope-e2e` | Playwright full browser user flows |
| `regression` | `@codecheck/scope-regression` | Targets previously-failed functions |

---

## Triggers

### `oncommit` — git pre-commit hook

```bash
# Preview without calling the LLM
npx codecheck --dry-run
```

### `onsave` — file watcher

```bash
ANTHROPIC_API_KEY=sk-ant-... npx codecheck-watch
npx codecheck-watch --dry-run   # watch without testing
```

---

## Web Dashboard

```bash
npm install -D @codecheck/output-dashboard
npx codecheck-serve
# → http://localhost:3333
```

Shows pass rates, run history trend, and flakiness detection. Refreshes automatically.

---

## Python support

```json
{
  "codecheck": {
    "language": "python",
    "framework": "pytest"
  }
}
```

```bash
pip install pytest pytest-asyncio
```

---

## Packages

| Package | Description |
|---|---|
| `@codecheck/core` | AI engine — extract, generate, run |
| `@codecheck/scope-unit` | Unit test generator |
| `@codecheck/scope-smoke` | Smoke test generator |
| `@codecheck/scope-functional` | Functional test generator |
| `@codecheck/scope-sanity` | Sanity test generator |
| `@codecheck/scope-integration` | Integration test generator |
| `@codecheck/scope-api` | API test generator |
| `@codecheck/scope-e2e` | Playwright E2E generator |
| `@codecheck/scope-snapshot` | React snapshot generator |
| `@codecheck/scope-regression` | Regression test generator |
| `@codecheck/output-terminal` | Terminal reporter |
| `@codecheck/output-github` | GitHub PR comment reporter |
| `@codecheck/output-dashboard` | Web dashboard + flakiness tracker |
| `@codecheck/trigger-oncommit` | Git pre-commit trigger |
| `@codecheck/trigger-onsave` | File watcher trigger |
| `@codecheck/init` | Interactive setup wizard |

---

## FAQ

**Does CodeCheck block my commits?**
No, by default (`failOnError: false`). Set `failOnError: true` to block on low pass rates.

**Is my code sent to Anthropic?**
Only the functions being tested — not your entire codebase. Each LLM call contains a single function's source code.

**Does it work on large repos?**
Yes. Only staged files are tested per commit. Unchanged functions are cached and never re-sent.

**What if generated tests are wrong?**
Generated tests go to `.codecheck-tmp/` and are deleted after each run. They never touch your source tree.

---

## Contributing

```bash
git clone https://github.com/medhavee/codecheck
cd codecheck
npm install
npm run build
npm test
```

---

## License

MIT © [Medhavee Upadhyaya](https://github.com/medhavee)

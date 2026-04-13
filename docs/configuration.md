# Configuration Reference

CodeCheck is configured via a `codecheck` key in `package.json` or a standalone `codecheck.config.json` file. It uses [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) for discovery.

## Config file locations (searched in order)

1. `package.json` → `"codecheck"` key
2. `codecheck.config.json`
3. `.codecheckrc`
4. `.codecheckrc.json`

## Full schema

```json
{
  "codecheck": {
    "trigger":            "oncommit",
    "testTypes":          ["unit", "smoke"],
    "output":             ["terminal"],
    "model":              "claude-sonnet-4-6",
    "provider":           "anthropic",
    "language":           "typescript",
    "framework":          "jest",
    "threshold":          0.8,
    "exclude":            ["node_modules", "dist", "*.test.ts"],
    "concurrency":        3,
    "failOnError":        false,
    "keepGeneratedTests": false,
    "cacheTtlDays":       7
  }
}
```

---

## Field Reference

### `trigger`

When CodeCheck runs.

| Value | Description |
|---|---|
| `oncommit` | Runs on `git commit` via a husky pre-commit hook |
| `onsave` | Runs when you save a file (via `codecheck-watch`) |
| `ci` | Runs in CI — no hook needed, call `npx codecheck` directly |

### `testTypes`

Which kinds of tests to generate. An array — you can mix and match.

| Value | Generates | Use when |
|---|---|---|
| `unit` | Edge cases, boundary conditions, null checks | Always — the most valuable type |
| `smoke` | Happy path, basic sanity | Always — catches regressions instantly |
| `functional` | Real input/output behavior, no mocks | Pure functions with clear contracts |
| `sanity` | 1–2 "can I call it?" checks | New APIs, unfamiliar code |
| `integration` | Multi-function flows, real deps | Service layers, orchestrators |
| `api` | HTTP request/response, status codes | Express/Fastify handlers |
| `snapshot` | React component snapshots | UI components |
| `e2e` | Full browser flows (Playwright) | Critical user journeys |
| `regression` | Targets previously-failed functions | After fixing bugs |

### `output`

Where to send results. An array — can report to multiple places simultaneously.

| Value | Description |
|---|---|
| `terminal` | Colored output in the console |
| `github` | PR comment via GitHub API |
| `dashboard` | Write results to `.codecheck-results/` for `codecheck-serve` |

### `model`

The Claude model to use for test generation.

| Value | Speed | Cost | Best for |
|---|---|---|---|
| `claude-sonnet-4-6` | Fast | Medium | Most projects (recommended) |
| `claude-opus-4-6` | Slow | High | Complex code, maximum quality |
| `claude-haiku-4-5-20251001` | Fastest | Low | Large repos, cost-sensitive |

### `language`

The language of your source files.

| Value | Generates | Test runner |
|---|---|---|
| `typescript` | `.test.ts` files | Jest or Vitest |
| `javascript` | `.test.js` files | Jest or Vitest |
| `python` | `test_*.py` files | pytest |

### `framework`

The test runner CodeCheck generates files for.

| Value | Language | Notes |
|---|---|---|
| `jest` | TypeScript/JavaScript | Default for TS/JS projects |
| `vitest` | TypeScript/JavaScript | API-compatible with Jest |
| `pytest` | Python | Requires `pip install pytest pytest-asyncio` |

### `threshold`

Minimum pass rate to consider a run successful. A float from 0 to 1.

- `0.8` = 80% of generated tests must pass
- `1.0` = all tests must pass
- `0.0` = never block (log-only mode)

Only relevant when `failOnError: true`.

### `failOnError`

If `true`, the git commit (or CI run) will be blocked when the pass rate is below `threshold`.

**Default: `false`** — CodeCheck reports results but never blocks.

### `exclude`

Glob patterns for files to skip. Matched against the file path.

```json
{
  "exclude": [
    "node_modules",
    "dist",
    "*.test.ts",
    "*.spec.ts",
    "src/generated/**"
  ]
}
```

### `concurrency`

Maximum number of parallel LLM calls per run. Higher = faster but more API usage.

Default: `3`

### `cacheTtlDays`

How long to cache LLM responses. If a function's content hasn't changed since the last commit, CodeCheck uses the cached test cases instead of calling the LLM.

Cache is stored in `.codecheck-cache/` in your project root. Add it to `.gitignore`.

Default: `7` (days)

### `keepGeneratedTests`

If `true`, generated test files are kept in `.codecheck-tmp/` after the run instead of being deleted.

Useful for debugging or understanding what CodeCheck generates.

Default: `false`

---

## Python

```json
{
  "codecheck": {
    "language": "python",
    "framework": "pytest",
    "testTypes": ["unit", "smoke"]
  }
}
```

Add to `.gitignore`:

```
.codecheck-cache/
.codecheck-tmp/
.codecheck-results/
__pycache__/
```

Add a `pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = [".codecheck-tmp"]
asyncio_mode = "auto"
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `GITHUB_TOKEN` | For `output: github` | GitHub personal access token |
| `GITHUB_REPO` | For `output: github` | `owner/repo` format |
| `GITHUB_PR` | For `output: github` | PR number |

---

## `.gitignore` additions

```
.codecheck-cache/
.codecheck-tmp/
.codecheck-results/
```

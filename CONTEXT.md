# CONTEXT.md — CodeCheck Build State

> This file is auto-updated at the end of every session. Read this first.

## Current Phase: SESSION 12 COMPLETE ✅ — All Missing Packages Built

**Last updated:** 2026-05-20  
**Status:** 22 packages, 352 tests, all passing.

---

## What Has Been Built

### Sessions 1–4 ✅ — Phase 1 MVP
Core engine + scope-unit + scope-smoke + output-terminal + trigger-oncommit + examples/typescript-jest

### Session 5 ✅ — Phase 2 scope plugins
scope-functional, scope-sanity, scope-integration, scope-api, output-github, trigger-onsave

### Session 6 ✅ — Phase 2 remaining
scope-e2e, scope-snapshot, codecheck-init, stateful/dynamic prompt improvements

### Session 7 ✅ — Python support + dry-run
pytest generator + runner, examples/python-pytest, --dry-run for trigger-oncommit

### Session 8 ✅ — Dashboard + publish prep
output-dashboard, codecheck-serve, publish metadata, scripts/publish.sh

### Session 12 (2026-05-20) ✅ COMPLETE — All Missing Packages Built

**New packages (6):**
- `packages/trigger-onpush/` — pre-push hook via husky; `codecheck-push` bin; gets files changed since origin/HEAD
- `packages/trigger-ci/` — GitHub Actions native; `codecheck-ci` bin; reads GITHUB_BASE_REF/GITHUB_BEFORE/GITHUB_SHA; writes step summary; posts GitHub PR comment + terminal + dashboard
- `packages/scope-everything/` — full codebase sweep; discovers ALL source files; prioritizes changed files first, then sorted by recency
- `packages/output-report/` — writes `.codecheck-results/report.json` (machine-readable) + `report.html` (human-readable) after every run
- `packages/output-slack/` — posts to Slack via `SLACK_WEBHOOK_URL` webhook; skips silently if env not set
- `packages/output-inline/` — VS Code extension; reads `latest.json` and shows red underline diagnostics on failing functions; pure parsing logic is separately unit-tested

**Updated packages:**
- `trigger-oncommit/bin.ts` — now uses `createLLMClient(config)` instead of hardcoded `AnthropicLLMClient`; provider-aware API key check
- `trigger-onsave/bin.ts` — same update
- `scripts/publish.sh` — added all 6 new packages in correct dependency order

**VS Code extension note:** `output-inline` is scaffolded as a proper VS Code extension. Publishing goes to VS Code Marketplace via `vsce`, not npm. Run `npm install -g @vscode/vsce && vsce package` to produce a `.vsix` file.

**Error safety guarantees (all triggers):**
- Any unexpected error exits 0 (never blocks commit/push/CI) unless `failOnError: true`
- API key missing → silent skip, not an error
- Ollama provider → no key required

**Total tests:** 352 (was 313)

### Session 11 (2026-05-20) ✅ COMPLETE — All 4 LLM Providers

**New files:**
- `packages/core/src/llm/openai.ts` — `OpenAILLMClient implements LLMClient`
- `packages/core/src/llm/gemini.ts` — `GeminiLLMClient implements LLMClient` (uses `@google/generative-ai`)
- `packages/core/src/llm/ollama.ts` — `OllamaLLMClient implements LLMClient` (reuses `openai` package with custom baseURL pointing at localhost:11434)

**Updated files:**
- `packages/core/src/llm/client.ts` — added `createLLMClient(config)` factory, re-exports all 3 new clients
- `packages/core/src/engine.ts` — uses `createLLMClient(config)` instead of hardcoded `AnthropicLLMClient`
- `packages/core/src/index.ts` — exports `OpenAILLMClient`, `GeminiLLMClient`, `OllamaLLMClient`, `createLLMClient`
- `packages/core/package.json` — added `openai` and `@google/generative-ai` dependencies

**New tests:** `packages/core/src/__tests__/llm-providers.test.ts` — 16 new tests
- 4 tests per provider (happy path, API error, empty response, parse error)
- 5 factory tests (one per provider + unknown-defaults-to-anthropic)

**Provider env vars:**
- `ANTHROPIC_API_KEY` (existing)
- `OPENAI_API_KEY` (new)
- `GEMINI_API_KEY` (new)
- `OLLAMA_BASE_URL` (new, defaults to `http://localhost:11434/v1`)

**Total tests:** 313 (was 297)

### Session 10 (2026-04-13) ✅ COMPLETE — Adaptive Learning + Plain-English Output

**New module: `packages/core/src/learning/`**
- `profile.ts` — `ProjectProfile` type, `loadProfile()`, `saveProfile()`, `emptyProfile()`
  - Stored in `.codecheck-results/project-profile.json` per project
  - Tracks: totalRuns, passRateByTestType, passRateByCategory, topFailureReasons, successfulExamples
- `analyzer.ts` — `updateProfile(profile, results)`, `humanizeError(error)`
  - Updates running pass/fail counts, collects failure patterns, successful examples
  - `humanizeError()` translates raw assertion errors to plain English
- `injector.ts` — `buildProfileContext(profile)` → string appended to LLM prompt
  - Returns null if < 3 runs (not enough signal yet)
  - Tells the LLM: pass rates by type/category, what to generate more of, what to avoid, proven examples

**Engine changes (engine.ts):**
- Loads project profile at start of every `run()` call
- Appends `profileContext` to the scope plugin's `promptSuffix` before each LLM call
- After all tests complete, updates and saves the profile (best-effort, never blocks)
- Works for both `trigger-oncommit` and `trigger-onsave` — any trigger that calls `engine.run()`

**Terminal output changes (formatter.ts):**
- `humanizeError()` exported — translates technical errors to one-line plain English
- Failed test output now shows TWO layers:
  1. `→ Crashed on null or undefined input — the function needs a null check` (yellow, plain English)
  2. `AssertionError: expected undefined to equal...` (dimmed technical detail)

**Tests:** 22 new tests in `packages/core/src/learning/__tests__/`
- `analyzer.test.ts` — 14 tests for humanizeError + updateProfile
- `injector.test.ts` — 8 tests for buildProfileContext

### Session 9 (2026-04-13) ✅ COMPLETE

**New packages:**
- [x] `@codecheck/scope-regression` — Regression test generator
  - `RegressionScopePlugin` — reads `.codecheck-results/flakiness.json`, sorts previously-failed targets to front
  - buildPrompt focuses on: failure-prone inputs, off-by-one errors, type coercion traps, re-entry correctness
  - Registered in `trigger-oncommit/bin.ts` as `regression: () => new RegressionScopePlugin()`

**New CI/CD:**
- [x] `.github/workflows/ci.yml`
  - `build-and-test` job: Node 18/20/22 matrix, `npm ci` → build all workspaces → test all workspaces → typecheck
  - `publish-dry-run` job: runs on `main` after tests pass, dry-run of `scripts/publish.sh`
  - `publish` job: runs only when commit message starts with `release:`, uses `NPM_TOKEN` secret

**New documentation:**
- [x] `README.md` — Comprehensive root README (install, setup, config table, test types, outputs, FAQ)
- [x] `docs/quickstart.md` — 5-minute QuickStart guide
- [x] `docs/configuration.md` — Full config reference with all fields, Python section, env vars
- [x] `docs/plugins.md` — All 3 plugin layers + custom plugin authoring guide

---

## Total Test Coverage

| Package | Tests | Status |
|---|---|---|
| @codecheck/core | 153 | ✅ (+22 learning tests) |
| @codecheck/init | 15 | ✅ |
| @codecheck/output-dashboard | 14 | ✅ |
| @codecheck/output-github | 12 | ✅ |
| @codecheck/output-terminal | 17 | ✅ |
| @codecheck/scope-api | 7 | ✅ |
| @codecheck/scope-e2e | 8 | ✅ |
| @codecheck/scope-functional | 7 | ✅ |
| @codecheck/scope-integration | 6 | ✅ |
| @codecheck/scope-regression | 9 | ✅ NEW |
| @codecheck/scope-sanity | 6 | ✅ |
| @codecheck/scope-smoke | 6 | ✅ |
| @codecheck/scope-snapshot | 9 | ✅ |
| @codecheck/scope-unit | 6 | ✅ |
| @codecheck/trigger-oncommit | 13 | ✅ |
| @codecheck/trigger-onsave | 9 | ✅ |
| **Total** | **297** | **✅ all passing** |

---

## Repository Structure (final)

```
codecheck/
├── CODECHECK_SPEC.md            ✅
├── CLAUDE.md                    ✅
├── CONTEXT.md                   ✅ (this file)
├── README.md                    ✅ comprehensive root README
├── package.json                 ✅
├── tsconfig.base.json           ✅
├── tsconfig.json                ✅
├── .github/
│   └── workflows/
│       └── ci.yml               ✅ Node 18/20/22 matrix CI + publish on release:
├── scripts/
│   └── publish.sh               ✅ npm publish in dependency order
├── docs/
│   ├── quickstart.md            ✅
│   ├── configuration.md         ✅
│   └── plugins.md               ✅
│
├── packages/
│   ├── core/                    ✅ + learning/ (profile, analyzer, injector)
│   ├── scope-unit/              ✅
│   ├── scope-smoke/             ✅
│   ├── scope-functional/        ✅
│   ├── scope-sanity/            ✅
│   ├── scope-integration/       ✅
│   ├── scope-api/               ✅
│   ├── scope-e2e/               ✅
│   ├── scope-snapshot/          ✅
│   ├── scope-regression/        ✅ NEW — reads flakiness.json, sorts failed targets first
│   ├── output-terminal/         ✅
│   ├── output-github/           ✅
│   ├── output-dashboard/        ✅ web dashboard + codecheck-serve
│   ├── trigger-oncommit/        ✅ all 9 test types registered
│   ├── trigger-onsave/          ✅ --dry-run flag
│   └── codecheck-init/          ✅ interactive setup wizard
│
└── examples/
    ├── typescript-jest/         ✅
    └── python-pytest/           ✅
```

---

## Known Behaviors / Edge Cases

1. **Dashboard auto-refresh** — HTML dashboard polls `/api/results` every 5 seconds.
2. **Flakiness threshold** — A test is marked flaky only after 3+ runs with mixed results.
3. **Dashboard plugin never blocks** — Each output plugin isolated in try/catch.
4. **--dry-run for onsave** — Watches files but never calls LLM.
5. **publish.sh** — Builds + tests before publishing. Supports `--dry-run`.
6. **All packages have `publishConfig: { access: 'public' }`** — Required for scoped packages.
7. **scope-regression with no flakiness data** — Returns all targets (no history = test everything).
8. **scope-regression with failed targets** — Sorts them to the front; LLM focuses on failure-prone paths.
9. **Adaptive learning cold start** — `buildProfileContext` returns null for the first 2 runs. Prompt stays clean until there's real signal.
10. **Profile save is best-effort** — wrapped in try/catch; a disk write failure never blocks a commit or save trigger.
11. **Profile is per-project** — stored in that project's `.codecheck-results/project-profile.json`. Two different repos never share learning data.
12. **humanizeError fallback** — if the error doesn't match any known pattern, shows the first line truncated to 100 chars.

---

## Key Decisions Made (cumulative)

| Decision | Choice | Reason |
|---|---|---|
| Dashboard server | Node `http` (no Express) | Zero extra dependencies |
| Dashboard HTML | Embedded template string | No build step, single deployable |
| Flakiness detection | 3+ runs, both pass and fail | Avoids false positives |
| Dashboard data store | `.codecheck-results/*.json` | Persistent, readable, no DB |
| History cap | 50 runs | Reasonable trend window, small file |
| Output plugins | Array — terminal + dashboard always | Dashboard writes don't block terminal |
| publish.sh order | core → scopes → outputs → triggers → init | Dependency order |
| CI publish trigger | commit message prefix `release:` | Simple, no extra tooling |
| regression sorting | failCount > 0 → front | Most important to retest |
| Adaptive learning signal threshold | 3+ runs before injecting context | Avoids noisy signal from 1–2 runs |
| Profile context placement | Appended to user prompt (not system) | System prompt stays static for caching |
| humanizeError location | output-terminal/formatter.ts | Also exported from @codecheck/core |

---

## Verification Commands

```bash
# From /Users/medha/Documents/Projects/codecheck
npm test           # 297 tests, all passing
npm run build      # all 16 packages

# Start dashboard
npx codecheck-serve
npx codecheck-serve --port 8080

# Dry-run watch mode
npx codecheck-watch --dry-run

# Publish (requires npm login)
./scripts/publish.sh --dry-run   # preview
./scripts/publish.sh             # publish for real
```

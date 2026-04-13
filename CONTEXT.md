# CONTEXT.md — CodeCheck Build State

> This file is auto-updated at the end of every session. Read this first.

## Current Phase: Phase 2 — SESSION 6 COMPLETE

**Last updated:** 2026-04-13  
**Next:** Session 7 — examples/python-pytest, output-dashboard (Phase 3 start), or npm publish prep

---

## What Has Been Built

### Sessions 1–4 ✅ — Phase 1 MVP (complete)
Core engine + scope-unit + scope-smoke + output-terminal + trigger-oncommit + examples/typescript-jest

### Session 5 ✅ COMPLETE
scope-functional, scope-sanity, scope-integration, scope-api, output-github, trigger-onsave  
trigger-oncommit dynamic plugin loading. 192 tests passing.

### Session 6 (2026-04-13) ✅ COMPLETE

**New packages:**
- [x] `@codecheck/scope-e2e` — E2EScopePlugin (2–4 Playwright E2E tests, endpoint/handler targets, full browser user flows)
- [x] `@codecheck/scope-snapshot` — SnapshotScopePlugin (2–4 React snapshot tests, PascalCase component targets, toMatchSnapshot)
- [x] `@codecheck/init` — Interactive codecheck-init wizard (inquirer CLI, detects PM + project name, writes config to package.json or codecheck.config.json, optional husky setup)

**Updated packages:**
- [x] `@codecheck/trigger-oncommit/src/bin.ts` — Added `e2e` and `snapshot` to ALL_SCOPE_PLUGINS registry
- [x] `@codecheck/trigger-oncommit/package.json` — Added scope-e2e and scope-snapshot as dependencies
- [x] `@codecheck/core/src/llm/prompts.ts` — Added rule 9 (dynamic outputs → `"__dynamic__"` sentinel) and rule 10 (stateful functions → `"before-each"` category)
- [x] `@codecheck/core/src/generator/jest.ts` — Handles `"__dynamic__"` expectedOutput (emits `toBeDefined()` + `not.toBeNull()`), handles `"before-each"` category (emits `beforeEach` block)

**Test counts (Session 6):**
- @codecheck/scope-e2e: 8 tests ✅ NEW
- @codecheck/scope-snapshot: 9 tests ✅ NEW
- @codecheck/init: 15 tests ✅ NEW

---

## Total Test Coverage

| Package | Tests | Status |
|---|---|---|
| @codecheck/core | 103 | ✅ |
| @codecheck/init | 15 | ✅ NEW |
| @codecheck/output-github | 12 | ✅ |
| @codecheck/output-terminal | 17 | ✅ |
| @codecheck/scope-api | 7 | ✅ |
| @codecheck/scope-e2e | 8 | ✅ NEW |
| @codecheck/scope-functional | 7 | ✅ |
| @codecheck/scope-integration | 6 | ✅ |
| @codecheck/scope-sanity | 6 | ✅ |
| @codecheck/scope-smoke | 6 | ✅ |
| @codecheck/scope-snapshot | 9 | ✅ NEW |
| @codecheck/scope-unit | 6 | ✅ |
| @codecheck/trigger-oncommit | 13 | ✅ |
| @codecheck/trigger-onsave | 9 | ✅ |
| **Total** | **224** | **✅ all passing** |

---

## Repository Structure (as of Session 6)

```
codecheck/
├── CODECHECK_SPEC.md            ✅
├── CLAUDE.md                    ✅
├── CONTEXT.md                   ✅ (this file)
├── package.json                 ✅
├── tsconfig.base.json           ✅
├── tsconfig.json                ✅
│
├── packages/
│   ├── core/                    ✅ COMPLETE + Session 6 improvements
│   ├── scope-unit/              ✅ COMPLETE
│   ├── scope-smoke/             ✅ COMPLETE
│   ├── scope-functional/        ✅ Session 5
│   ├── scope-sanity/            ✅ Session 5
│   ├── scope-integration/       ✅ Session 5
│   ├── scope-api/               ✅ Session 5
│   ├── scope-e2e/               ✅ NEW — Session 6 (Playwright user flows)
│   ├── scope-snapshot/          ✅ NEW — Session 6 (React component snapshots)
│   ├── output-terminal/         ✅ COMPLETE
│   ├── output-github/           ✅ Session 5
│   ├── trigger-oncommit/        ✅ UPDATED — now includes e2e + snapshot
│   ├── trigger-onsave/          ✅ Session 5
│   └── codecheck-init/          ✅ NEW — Session 6 (interactive wizard)
│
└── examples/
    └── typescript-jest/         ✅ Session 5
        ├── src/utils.ts         ✅ (19 utility functions)
        ├── src/api.ts           ✅ (5 HTTP handler functions)
        ├── jest.config.js       ✅
        ├── tsconfig.json        ✅
        ├── package.json         ✅ (testTypes: unit, smoke, functional, sanity, integration)
        └── .husky/pre-commit    ✅
```

---

## Known Behaviors / Edge Cases

1. **NaN/Infinity inputs**: preprocessed to null in parseLLMResponse.
2. **Cache on second run**: functions unchanged since last commit skip LLM entirely.
3. **npm workspace jest hoisting**: findJestBin walks up directory tree.
4. **husky v9 setup**: `git config core.hooksPath .husky` in the project git repo.
5. **Stateful API functions**: LLM now emits `"before-each"` category test case → generator wraps in `beforeEach`. Should improve pass rate on stateful handlers.
6. **Dynamic return values (timestamp, random)**: LLM now uses `"__dynamic__"` sentinel → generator emits `toBeDefined()` + `not.toBeNull()`. No more false failures on timestamps.
7. **scope-e2e** targets endpoint targetType OR functions matching `/handler|controller|route|endpoint|middleware|page|screen/i`
8. **scope-snapshot** targets PascalCase function/class names (React component convention)
9. **codecheck-init** writes to `package.json` "codecheck" key if package.json exists, else writes `codecheck.config.json`

---

## Key Decisions Made (cumulative)

| Decision | Choice | Reason |
|---|---|---|
| Language (Phase 1) | TypeScript only | Python in Phase 2 |
| Test types (Phase 1) | unit + smoke | Most useful combination |
| Test types (Phase 2) | functional, sanity, integration, api, e2e, snapshot | Sessions 5–6 |
| LLM caching | SHA-256 keyed, 7-day TTL | Session 3 |
| ESM throughout | Yes | chalk@5 + ora@9 are ESM-only |
| Zod version | v3 | Stable, known API |
| Testing framework | vitest (packages), jest (generated tests) | ESM-native |
| `// @ts-nocheck` | Added to all generated test files | LLM may produce null inputs |
| JSON preprocessing | Replace bare NaN/Infinity → null | Not valid JSON tokens |
| Dynamic plugin loading | bin.ts maps testTypes → plugin factories | Extensible without code changes |
| trigger-onsave debounce | 300ms default | Coalesces rapid saves |
| output-github marker | `<!-- codecheck-result -->` in comment | Enables update-not-create on re-run |
| Dynamic outputs | `"__dynamic__"` sentinel → `toBeDefined()` | Session 6: timestamps/random can't be predicted |
| Stateful functions | `"before-each"` category → `beforeEach` block | Session 6: prevents test interference |
| codecheck-init config | Inject into package.json or write codecheck.config.json | Session 6: least friction |

---

## What To Build Next (Session 7)

| Priority | Item | Notes |
|---|---|---|
| High | `examples/python-pytest/` | Python example showing pytest generation |
| Medium | Phase 3: `output-dashboard` | Web UI (React + Vite, serves test results) |
| Medium | npm publish all packages | Need to set up npm org, build CI |
| Low | `--dry-run` flag | Shows generated tests without running |
| Low | Flakiness tracking | Record pass/fail history per test |

---

## Verification Commands

```bash
# From /Users/medha/Documents/Projects/codecheck
npm test           # 224 tests, all passing
npm run build      # All 14 packages built
npm run typecheck --workspace=packages/core  # 0 TypeScript errors

# Init wizard (from any project directory)
npx codecheck-init

# Watch mode
ANTHROPIC_API_KEY=<key> npx codecheck-watch

# End-to-end (from examples/typescript-jest, ANTHROPIC_API_KEY set)
echo "export function sq(n: number) { return n * n }" >> src/utils.ts
git add src/utils.ts
git commit -m "test: verify codecheck"
```

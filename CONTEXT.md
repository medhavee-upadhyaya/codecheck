# CONTEXT.md — CodeCheck Build State

> This file is auto-updated at the end of every session. Read this first.

## Current Phase: Phase 2 — SESSION 5 COMPLETE

**Last updated:** 2026-04-13  
**Next:** Session 6 — scope-e2e (Playwright), scope-snapshot (React), `codecheck init` wizard, improve prompt quality for stateful/dynamic functions

---

## What Has Been Built

### Sessions 1–4 ✅ — Phase 1 MVP (complete)
Core engine + scope-unit + scope-smoke + output-terminal + trigger-oncommit + examples/typescript-jest

### Session 5 (2026-04-13) ✅ COMPLETE

**New packages:**
- [x] `@codecheck/scope-functional` — FunctionalScopePlugin (3–6 tests, I/O behavior, no mocks, real logic)
- [x] `@codecheck/scope-sanity` — SanityScopePlugin (1–2 tests, basic callable/returns-something checks)
- [x] `@codecheck/scope-integration` — IntegrationScopePlugin (2–4 tests, multi-function pipeline flows)
- [x] `@codecheck/scope-api` — ApiScopePlugin (3–6 tests, HTTP request/response, status codes)
- [x] `@codecheck/output-github` — GithubOutputPlugin (PR comment via Octokit, create or update comment)
- [x] `@codecheck/trigger-onsave` — OnSaveTrigger (chokidar file watcher, debounced, + codecheck-watch bin)

**Updated packages:**
- [x] `@codecheck/trigger-oncommit/src/bin.ts` — dynamic plugin loading from config.testTypes
  - All 6 scope plugins registered: unit, smoke, functional, sanity, integration, api
  - Falls back to unit+smoke if no testType matches
- [x] `examples/typescript-jest/` — added `src/api.ts` (createUserHandler, getUserHandler, listUsersHandler, deleteUserHandler, healthHandler)
- [x] `examples/typescript-jest/package.json` — testTypes updated to `["unit", "smoke", "functional", "sanity", "integration"]`

**End-to-end verification (2026-04-13):**
```
git commit -m "feat: add healthHandler"
→ CodeCheck fires on api.ts
→ All 5 test types generated: unit, smoke, functional, sanity, integration
→ 48 passed · 69 failed · 41% pass rate
→ commit proceeds (failOnError: false) ✅
```

Lower pass rate on API handlers is expected — stateful in-memory store + dynamic timestamp make exact assertions fail. Pure utility functions (utils.ts) consistently hit 84%.

---

## Total Test Coverage

| Package | Tests | Status |
|---|---|---|
| @codecheck/core | 103 | ✅ |
| @codecheck/output-github | 12 | ✅ |
| @codecheck/output-terminal | 17 | ✅ |
| @codecheck/scope-api | 7 | ✅ |
| @codecheck/scope-functional | 7 | ✅ |
| @codecheck/scope-integration | 6 | ✅ |
| @codecheck/scope-sanity | 6 | ✅ |
| @codecheck/scope-smoke | 6 | ✅ |
| @codecheck/scope-unit | 6 | ✅ |
| @codecheck/trigger-oncommit | 13 | ✅ |
| @codecheck/trigger-onsave | 9 | ✅ |
| **Total** | **192** | **✅ all passing** |

---

## Repository Structure (as of Session 5)

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
│   ├── core/                    ✅ COMPLETE
│   ├── scope-unit/              ✅ COMPLETE
│   ├── scope-smoke/             ✅ COMPLETE
│   ├── scope-functional/        ✅ NEW — Session 5
│   ├── scope-sanity/            ✅ NEW — Session 5
│   ├── scope-integration/       ✅ NEW — Session 5
│   ├── scope-api/               ✅ NEW — Session 5
│   ├── output-terminal/         ✅ COMPLETE
│   ├── output-github/           ✅ NEW — Session 5 (Octokit PR comments)
│   ├── trigger-oncommit/        ✅ UPDATED — dynamic plugin loading
│   └── trigger-onsave/          ✅ NEW — Session 5 (chokidar + codecheck-watch bin)
│
└── examples/
    └── typescript-jest/         ✅ UPDATED — api.ts, all Phase 2 test types
        ├── src/utils.ts         ✅ (19 utility functions)
        ├── src/api.ts           ✅ NEW — 5 HTTP handler functions
        ├── jest.config.js       ✅
        ├── tsconfig.json        ✅
        ├── package.json         ✅ (testTypes: unit, smoke, functional, sanity, integration)
        └── .husky/pre-commit    ✅
```

---

## Known Behaviors / Edge Cases

1. **NaN/Infinity inputs**: preprocessed to null in parseLLMResponse. Test file gets `fn(null as any)` with `// @ts-nocheck`.
2. **Cache on second run**: functions unchanged since last commit skip LLM entirely.
3. **npm workspace jest hoisting**: findJestBin walks up directory tree.
4. **husky v9 setup**: `git config core.hooksPath .husky` in the project git repo.
5. **Stateful API functions**: when functions share module-level state (Map, counter), tests from different functions interfere. LLM doesn't add `beforeEach` reset calls. Pass rate is lower on these.
6. **Dynamic return values (timestamp, random)**: LLM can't predict these. It stores `null` as expectedOutput, causing assertion failures. Acceptable for v0.1.

---

## Key Decisions Made (cumulative)

| Decision | Choice | Reason |
|---|---|---|
| Language (Phase 1) | TypeScript only | Python in Phase 2 |
| Test types (Phase 1) | unit + smoke | Most useful combination |
| Test types (Phase 2) | functional, sanity, integration, api | Session 5 |
| LLM caching | SHA-256 keyed, 7-day TTL | Built Session 3 |
| ESM throughout | Yes | chalk@5 + ora@9 are ESM-only |
| Zod version | v3 | Stable, known API |
| Testing framework | vitest (packages), jest (generated tests) | ESM-native |
| `// @ts-nocheck` | Added to all generated test files | LLM may produce null inputs |
| JSON preprocessing | Replace bare NaN/Infinity → null | Not valid JSON tokens |
| Dynamic plugin loading | bin.ts maps testTypes → plugin factories | Extensible without code changes |
| trigger-onsave debounce | 300ms default | Coalesces rapid saves |
| output-github marker | `<!-- codecheck-result -->` in comment | Enables update-not-create on re-run |

---

## What To Build Next (Session 6)

| Priority | Item | Notes |
|---|---|---|
| High | `@codecheck/scope-e2e` | Playwright full user flows |
| High | `@codecheck/scope-snapshot` | React component snapshots |
| High | `codecheck init` wizard | Interactive CLI for first-time setup |
| Medium | Improve stateful function prompts | Instruct LLM to add beforeEach/afterEach resets |
| Medium | `examples/python-pytest/` | Python example |
| Low | Phase 3: output-dashboard | Web UI |

---

## Verification Commands

```bash
# From /Users/medha/Documents/Projects/codecheck
npm test           # 192 tests, all passing
npm run build      # All 11 packages built
npm run typecheck  # 0 TypeScript errors

# Watch mode (from any project)
ANTHROPIC_API_KEY=<key> npx codecheck-watch

# End-to-end (from examples/typescript-jest, ANTHROPIC_API_KEY set)
echo "export function sq(n: number) { return n * n }" >> src/utils.ts
git add src/utils.ts
git commit -m "test: verify codecheck"
```

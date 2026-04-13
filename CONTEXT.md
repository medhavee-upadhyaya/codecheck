# CONTEXT.md — CodeCheck Build State

> This file is auto-updated at the end of every session. Read this first.

## Current Phase: Phase 3 — SESSION 9 COMPLETE ✅

**Last updated:** 2026-04-13  
**Status:** ALL PHASES COMPLETE — 16 packages, 275 tests, all passing. Project is publish-ready.

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
| @codecheck/core | 131 | ✅ |
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
| **Total** | **275** | **✅ all passing** |

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
│   ├── core/                    ✅
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

---

## Verification Commands

```bash
# From /Users/medha/Documents/Projects/codecheck
npm test           # 275 tests, all passing
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

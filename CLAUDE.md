# CLAUDE.md — CodeCheck Session Instructions

This file is read by Claude at the start of every session. Follow these instructions automatically without being asked.

## What This Project Is

CodeCheck is an AI-powered, modular, zero-config self-testing ecosystem for developers.
- Spec: `CODECHECK_SPEC.md`
- Build plan: `/Users/medha/.claude/plans/shiny-humming-hamming.md`
- Current state: `CONTEXT.md` (read this first every session)

## Standing Instructions (apply every session)

1. **Read `CONTEXT.md` first** — it contains the current build state, what was done last session, and what to do next. Never ask Medhavee to re-explain the project state.

2. **Update `CONTEXT.md` at the end of every session** — record exactly what was built, what tests pass, what's next, and any decisions made. Keep it current so the next session can start immediately.

3. **Test as you build** — every file written must have a corresponding test or be verified by running it. Do not write code and move on without verifying it works.

4. **Zero errors policy** — the project must always be in a working state at the end of each session. `tsc --noEmit` must pass. All tests must pass. Never leave broken code.

5. **Monorepo is ESM throughout** — all packages use `"type": "module"`. No CommonJS patterns. `tsup` handles builds.

6. **Zod v4 syntax** — not v3. Use `z.object()`, `z.string()`, etc. as normal, but be aware v4 has different error shapes and `z.interface()` for interfaces.

7. **Prompt caching** — always apply `cache_control: { type: 'ephemeral' }` to the system message block in Anthropic SDK calls.

8. **Never break the hook** — the pre-commit hook must never block a commit due to CodeCheck's own failure. Wrap all trigger logic in try/catch that exits 0 on unexpected errors.

## Key File Paths

- Project root: `/Users/medha/Documents/Projects/codecheck/`
- Core package: `packages/core/`
- Scope plugins: `packages/scope-*/`
- Trigger plugins: `packages/trigger-*/`
- Output plugins: `packages/output-*/`
- Examples: `examples/`

## Tech Stack Quick Reference

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24.x | ESM native |
| TypeScript | 6.x | Strict mode |
| Anthropic SDK | ^0.88.0 | With prompt caching |
| Zod | ^4.x | LLM response validation |
| tsup | ^8.x | Per-package builds |
| Jest | ^30.x | With ts-jest, ESM mode |
| chalk | ^5.x | ESM only |
| ora | ^9.x | ESM only |
| husky | ^9.x | Pre-commit hooks |
| cosmiconfig | ^9.x | Config file loading |

## Build Phase Reference

- **Phase 1 (MVP):** core + scope-unit + scope-smoke + trigger-oncommit + output-terminal
- **Phase 2:** scope-integration, scope-e2e, scope-api, scope-functional, scope-sanity, scope-snapshot, output-github, trigger-onsave
- **Phase 3:** output-dashboard, flakiness tracking, --dry-run, npm publish

## How to Verify the Build Works

After Phase 1 is complete, run this in `examples/typescript-jest/`:
```bash
git add src/utils.ts
git commit -m "test: codecheck verification"
# Expected: spinner → tests generated → colored pass/fail → commit proceeds
```

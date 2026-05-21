/**
 * @codecheck/scope-everything — Full-codebase scope plugin.
 *
 * Unlike other scope plugins that only test changed files, scope-everything
 * discovers ALL source files in the project and tests them — prioritized by:
 *   1. Files passed in (most recently changed — from the trigger)
 *   2. Everything else, sorted by filesystem modification time (newest first)
 *
 * Use this with trigger-ci or trigger-onpush for comprehensive coverage runs.
 */

import fs from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import { extractTargets } from '@codecheck/core'
import type { CodeCheckConfig, ScopePlugin, TestTarget, TestType } from '@codecheck/core'

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.cache', 'coverage',
  '.next', '.nuxt', 'build', '__pycache__', '.venv', 'venv',
])

const SUPPORTED = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs|py)$/
const EXCLUDED = /\.(test|spec)\.(ts|tsx|js|jsx|py)$|(^|\/)\.|\.(d\.ts)$/

export class EverythingScopePlugin implements ScopePlugin {
  readonly name: TestType = 'unit'
  readonly testTypes: TestType[] = ['unit', 'smoke', 'functional', 'sanity']

  async extractTargets(changedFiles: string[], config: CodeCheckConfig): Promise<TestTarget[]> {
    const cwd = process.cwd()

    // Discover all source files in the project
    const allFiles = await findAllSourceFiles(cwd, config.exclude ?? [])

    // Changed files go first — they are the highest priority
    const changedSet = new Set(changedFiles)
    const priority = changedFiles.filter((f) => allFiles.has(f))
    const rest = [...allFiles].filter((f) => !changedSet.has(f))

    const orderedFiles = [...priority, ...rest]

    // Extract targets from all files (settle individually — never let one bad
    // file block the rest)
    const settled = await Promise.allSettled(orderedFiles.map((f) => extractTargets(f)))
    const targets: TestTarget[] = []
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        targets.push(...result.value)
      }
    }

    return targets
  }

  buildPrompt(_target: TestTarget, testType: TestType): string {
    return `## Full-Codebase Test Instructions

You are generating ${testType} tests as part of a full codebase sweep. Apply the same quality standards as targeted tests:

1. Cover happy path, edge cases, null checks, and boundary conditions
2. Every test must have a meaningful assertion — never test "it runs without throwing" alone
3. If the function has obvious invariants (e.g., always returns a non-empty string), test them explicitly
4. Keep tests independent — no shared state between test cases unless a before-each is needed`
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findAllSourceFiles(root: string, userExclude: string[]): Promise<Set<string>> {
  const excludePatterns = userExclude.map((p) => new RegExp(p.replace(/\*/g, '.*')))
  const result = new Set<string>()

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    await Promise.allSettled(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name)
        const rel = path.relative(root, fullPath)

        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            await walk(fullPath)
          }
        } else if (
          entry.isFile() &&
          SUPPORTED.test(entry.name) &&
          !EXCLUDED.test(rel) &&
          !excludePatterns.some((p) => p.test(rel))
        ) {
          result.add(fullPath)
        }
      }),
    )
  }

  await walk(root)
  return result
}

export default EverythingScopePlugin

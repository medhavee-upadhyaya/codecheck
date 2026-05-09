/**
 * getStagedFiles.ts — Retrieve the list of staged TypeScript/JavaScript files
 * from git using simple-git. Returns absolute paths to files that are staged
 * and modified (added, modified, renamed — not deleted).
 */

import { simpleGit } from 'simple-git'
import { resolve } from 'node:path'

export async function getStagedFiles(cwd: string): Promise<string[]> {
  const git = simpleGit({ baseDir: cwd })
  const status = await git.status()

  // simple-git returns paths relative to the git repo root, not baseDir,
  // so we resolve from the repo root.
  const gitRoot = (await git.revparse(['--show-toplevel'])).trim()

  // staged: tracked files modified in the index
  // created: new files added to the index (only appear here, not in staged)
  // renamed: files renamed in the index — use the new path
  const all = new Set([
    ...status.staged,
    ...status.created,
    ...status.renamed.map((r) => r.to),
  ])

  // Filter to TypeScript / JavaScript source files; exclude test files and dist
  const supported = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/
  const excluded = /\.(test|spec)\.(ts|tsx|js|jsx)$|(^|\/)dist\/|(^|\/)node_modules\//

  // When invoked from a subdirectory, only test files inside that subdirectory.
  // This matches user intent: `cd examples/foo && git commit` should test files
  // in examples/foo, not unrelated staged files elsewhere in the repo.
  const cwdAbs = resolve(cwd)

  const result: string[] = []
  for (const rel of all) {
    if (supported.test(rel) && !excluded.test(rel)) {
      const absolute = resolve(gitRoot, rel)
      if (absolute === cwdAbs || absolute.startsWith(cwdAbs + '/')) {
        result.push(absolute)
      }
    }
  }

  return result
}

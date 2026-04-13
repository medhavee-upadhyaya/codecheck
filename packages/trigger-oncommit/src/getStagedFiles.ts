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

  // Collect staged files that are added (A), modified (M), or renamed (R)
  const staged = [
    ...status.staged, // Modified or added (git adds to 'staged' on index status)
  ]

  // simpleGit's status.staged gives index-modified files
  // We also grab created + renamed explicitly in case simple-git splits them
  const all = new Set([
    ...staged,
    ...status.created.filter((f) => status.staged.includes(f)),
    ...status.renamed.map((r) => r.to),
  ])

  // Filter to TypeScript / JavaScript source files; exclude test files and dist
  const supported = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/
  const excluded = /\.(test|spec)\.(ts|tsx|js|jsx)$|(^|\/)dist\/|(^|\/)node_modules\//

  const result: string[] = []
  for (const rel of all) {
    if (supported.test(rel) && !excluded.test(rel)) {
      result.push(resolve(cwd, rel))
    }
  }

  return result
}

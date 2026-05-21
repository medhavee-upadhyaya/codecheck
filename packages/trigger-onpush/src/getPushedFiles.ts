import { simpleGit } from 'simple-git'
import { resolve } from 'node:path'

/**
 * Returns absolute paths to TS/JS files changed in commits that are ahead
 * of the remote — i.e., what will be sent in this push.
 *
 * Falls back to the last commit if no remote tracking branch exists yet
 * (new branch being pushed for the first time).
 */
export async function getPushedFiles(cwd: string): Promise<string[]> {
  const git = simpleGit({ baseDir: cwd })
  const gitRoot = (await git.revparse(['--show-toplevel'])).trim()

  let diffOutput: string
  try {
    diffOutput = await git.raw(['diff', '--name-only', 'origin/HEAD', 'HEAD'])
  } catch {
    try {
      diffOutput = await git.raw(['diff', '--name-only', 'HEAD~1', 'HEAD'])
    } catch {
      return []
    }
  }

  const files = diffOutput.trim().split('\n').filter(Boolean)
  const supported = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs|py)$/
  const excluded = /\.(test|spec)\.(ts|tsx|js|jsx|py)$|(^|\/)dist\/|(^|\/)node_modules\//
  const cwdAbs = resolve(cwd)

  return files
    .filter((f) => supported.test(f) && !excluded.test(f))
    .map((f) => resolve(gitRoot, f))
    .filter((f) => f === cwdAbs || f.startsWith(cwdAbs + '/'))
}

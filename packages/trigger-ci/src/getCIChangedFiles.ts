import { simpleGit } from 'simple-git'
import { resolve } from 'node:path'

/**
 * Returns absolute paths to TS/JS/Python files changed in this CI run.
 *
 * Detection order:
 *  1. Pull request: diff against GITHUB_BASE_REF (origin/<base>)
 *  2. Push event:   diff between GITHUB_BEFORE_SHA and GITHUB_SHA
 *  3. Fallback:     last commit (HEAD~1..HEAD)
 */
export async function getCIChangedFiles(cwd: string): Promise<string[]> {
  const headSha = process.env['GITHUB_SHA'] ?? 'HEAD'
  const baseRef = process.env['GITHUB_BASE_REF'] ?? ''
  const beforeSha = process.env['GITHUB_BEFORE'] ?? process.env['GITHUB_BASE_SHA'] ?? ''

  const git = simpleGit({ baseDir: cwd })
  const gitRoot = (await git.revparse(['--show-toplevel'])).trim()

  let diffOutput = ''
  try {
    if (baseRef) {
      await git.raw(['fetch', '--depth=1', 'origin', baseRef]).catch(() => null)
      diffOutput = await git.raw(['diff', '--name-only', `origin/${baseRef}`, headSha])
    } else if (beforeSha && beforeSha !== '0000000000000000000000000000000000000000') {
      diffOutput = await git.raw(['diff', '--name-only', beforeSha, headSha])
    } else {
      diffOutput = await git.raw(['diff', '--name-only', 'HEAD~1', 'HEAD'])
    }
  } catch {
    return []
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

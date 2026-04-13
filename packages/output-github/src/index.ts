/**
 * @codecheck/output-github — GitHub PR comment output plugin.
 *
 * Posts CodeCheck test results as a comment on the open GitHub PR
 * associated with the current branch.
 *
 * Required environment variables:
 *   GITHUB_TOKEN   — Personal access token or Actions GITHUB_TOKEN
 *   GITHUB_REPO    — owner/repo (e.g. "medhavee/myproject")
 *   GITHUB_PR      — PR number (set automatically in GitHub Actions via
 *                    github.event.pull_request.number)
 *
 * If any variable is missing, the plugin skips silently (never throws).
 */

import { Octokit } from '@octokit/rest'
import type { OutputPlugin, TestResult, CodeCheckConfig } from '@codecheck/core'
import { buildCommentBody } from './formatter.js'

/** Marker embedded in every comment so we can find + update it on re-runs. */
const COMMENT_MARKER = '<!-- codecheck-result -->'

export class GithubOutputPlugin implements OutputPlugin {
  readonly name = 'github'

  async report(results: TestResult[], config: CodeCheckConfig): Promise<void> {
    const token = process.env['GITHUB_TOKEN']
    const repoEnv = process.env['GITHUB_REPO']
    const prEnv = process.env['GITHUB_PR'] ?? process.env['GITHUB_PR_NUMBER']

    if (!token || !repoEnv || !prEnv) {
      // Missing env — skip silently. Don't break the pipeline.
      return
    }

    const prNumber = parseInt(prEnv, 10)
    if (isNaN(prNumber)) return

    const [owner, repo] = repoEnv.split('/')
    if (!owner || !repo) return

    const octokit = new Octokit({ auth: token })

    const body = `${COMMENT_MARKER}\n${buildCommentBody(results, config)}`

    try {
      // Try to find an existing CodeCheck comment and update it
      const { data: comments } = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 100,
      })

      const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER))

      if (existing) {
        await octokit.issues.updateComment({
          owner,
          repo,
          comment_id: existing.id,
          body,
        })
      } else {
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body,
        })
      }
    } catch {
      // Never let GitHub API failures block the pipeline
    }
  }
}

export { buildCommentBody } from './formatter.js'
export default GithubOutputPlugin

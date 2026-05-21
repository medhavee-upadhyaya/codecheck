/**
 * @codecheck/output-slack — Slack webhook output plugin.
 *
 * Posts a CodeCheck summary message to a Slack channel after each run.
 *
 * Required env var:
 *   SLACK_WEBHOOK_URL — Incoming Webhook URL from https://api.slack.com/apps
 *
 * Optional env vars:
 *   SLACK_CHANNEL   — override the channel set in the webhook (e.g. #testing)
 *   SLACK_USERNAME  — bot display name (default: CodeCheck)
 *
 * Silently skips if SLACK_WEBHOOK_URL is not set.
 * Never throws — a Slack failure must never block a commit or CI job.
 */

import type { OutputPlugin, TestResult, CodeCheckConfig } from '@codecheck/core'

export class SlackOutputPlugin implements OutputPlugin {
  readonly name = 'slack'

  async report(results: TestResult[], config: CodeCheckConfig): Promise<void> {
    const webhookUrl = process.env['SLACK_WEBHOOK_URL']
    if (!webhookUrl) return

    try {
      const payload = buildPayload(results, config)
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      // Never let Slack failures surface — the developer's workflow comes first
    }
  }
}

// ─── Payload builder ──────────────────────────────────────────────────────────

function buildPayload(results: TestResult[], config: CodeCheckConfig): SlackPayload {
  const passed = results.filter((r) => r.passed).length
  const failed = results.length - passed
  const rate = results.length > 0 ? Math.round((passed / results.length) * 100) : 100
  const belowThreshold = rate < Math.round(config.threshold * 100)

  const emoji = rate >= 90 ? ':white_check_mark:' : rate >= 70 ? ':warning:' : ':x:'
  const color = rate >= 90 ? '#22c55e' : rate >= 70 ? '#f59e0b' : '#ef4444'

  const failedFiles = [
    ...new Set(results.filter((r) => !r.passed).map((r) => r.target.filePath)),
  ]
    .slice(0, 5)
    .map((f) => f.split('/').slice(-2).join('/'))

  const fields: SlackField[] = [
    { title: 'Pass Rate', value: `${rate}%`, short: true },
    { title: 'Tests', value: `${passed} passed / ${failed} failed`, short: true },
    { title: 'Provider', value: `${config.provider} / ${config.model}`, short: true },
  ]

  if (failedFiles.length > 0) {
    fields.push({ title: 'Failing Files', value: failedFiles.join('\n'), short: false })
  }

  const channel = process.env['SLACK_CHANNEL']
  const username = process.env['SLACK_USERNAME'] ?? 'CodeCheck'

  const payload: SlackPayload = {
    username,
    icon_emoji: ':robot_face:',
    attachments: [
      {
        color,
        title: `${emoji} CodeCheck — ${belowThreshold ? 'Below threshold' : 'All good'}`,
        fields,
        footer: `codecheck · threshold ${Math.round(config.threshold * 100)}%`,
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  }

  if (channel) payload.channel = channel

  return payload
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlackField {
  title: string
  value: string
  short: boolean
}

interface SlackAttachment {
  color: string
  title: string
  fields: SlackField[]
  footer: string
  ts: number
}

interface SlackPayload {
  username: string
  icon_emoji: string
  channel?: string
  attachments: SlackAttachment[]
}

export default SlackOutputPlugin

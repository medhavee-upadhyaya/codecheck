/**
 * @codecheck/output-report — File report output plugin.
 *
 * Writes test results to disk after every CodeCheck run:
 *   .codecheck-results/report.json  — machine-readable full results
 *   .codecheck-results/report.html  — human-readable summary page
 *
 * Never throws — a write failure is logged and silently ignored so it
 * never blocks a commit, push, or CI job.
 *
 * Output directory is configurable via CODECHECK_REPORT_DIR env var
 * (defaults to .codecheck-results/ in process.cwd()).
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { OutputPlugin, TestResult, CodeCheckConfig } from '@codecheck/core'

export class ReportOutputPlugin implements OutputPlugin {
  readonly name = 'report'

  async report(results: TestResult[], config: CodeCheckConfig): Promise<void> {
    const dir =
      process.env['CODECHECK_REPORT_DIR'] ??
      path.join(process.cwd(), '.codecheck-results')

    try {
      await fs.mkdir(dir, { recursive: true })
      await Promise.all([
        writeJson(dir, results, config),
        writeHtml(dir, results, config),
      ])
    } catch {
      // Never block the pipeline — report write failures are best-effort
    }
  }
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

async function writeJson(
  dir: string,
  results: TestResult[],
  config: CodeCheckConfig,
): Promise<void> {
  const passed = results.filter((r) => r.passed).length
  const payload = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed: results.length - passed,
      passRate: results.length > 0 ? passed / results.length : 1,
      threshold: config.threshold,
    },
    config: {
      provider: config.provider,
      model: config.model,
      testTypes: config.testTypes,
      threshold: config.threshold,
    },
    results: results.map((r) => ({
      file: r.target.filePath,
      function: r.target.name,
      testType: r.testCase.testType,
      description: r.testCase.description,
      passed: r.passed,
      duration: r.duration,
      error: r.error ?? null,
    })),
  }
  await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify(payload, null, 2), 'utf8')
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

async function writeHtml(
  dir: string,
  results: TestResult[],
  _config: CodeCheckConfig,
): Promise<void> {
  const passed = results.filter((r) => r.passed).length
  const failed = results.length - passed
  const rate = results.length > 0 ? Math.round((passed / results.length) * 100) : 100
  const ts = new Date().toLocaleString()
  const rateColor = rate >= 90 ? '#22c55e' : rate >= 70 ? '#f59e0b' : '#ef4444'

  const rows = results
    .map((r) => {
      const status = r.passed
        ? '<span style="color:#22c55e;font-weight:600">PASS</span>'
        : '<span style="color:#ef4444;font-weight:600">FAIL</span>'
      const err = !r.passed && r.error
        ? `<div style="color:#ef4444;font-size:0.8em;margin-top:4px;font-family:monospace">${esc(r.error.slice(0, 200))}</div>`
        : ''
      return `<tr>
        <td>${status}</td>
        <td style="font-family:monospace;font-size:0.85em">${esc(r.target.name)}</td>
        <td>${esc(r.testCase.description)}${err}</td>
        <td><span style="background:#1e293b;padding:2px 8px;border-radius:4px;font-size:0.75em">${esc(r.testCase.testType)}</span></td>
        <td style="color:#718096">${r.duration}ms</td>
      </tr>`
    })
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CodeCheck Report</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0f1117;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5;padding:2rem}
    h1{font-size:1.4rem;color:#6366f1;margin-bottom:0.25rem}
    .meta{color:#718096;font-size:0.8rem;margin-bottom:1.5rem}
    .cards{display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap}
    .card{background:#1a1d2e;border:1px solid #2d3148;border-radius:8px;padding:1rem 1.5rem;min-width:140px}
    .card .label{font-size:0.7rem;text-transform:uppercase;letter-spacing:.05em;color:#718096;margin-bottom:.25rem}
    .card .value{font-size:1.75rem;font-weight:700}
    table{width:100%;border-collapse:collapse}
    th{text-align:left;padding:.5rem .75rem;font-size:.7rem;text-transform:uppercase;color:#718096;border-bottom:1px solid #2d3148}
    td{padding:.5rem .75rem;border-bottom:1px solid #1a1d2e;vertical-align:top}
    tr:hover td{background:#1a1d2e}
  </style>
</head>
<body>
  <h1>&#9670; CodeCheck Report</h1>
  <div class="meta">Generated ${esc(ts)}</div>
  <div class="cards">
    <div class="card"><div class="label">Pass Rate</div><div class="value" style="color:${rateColor}">${rate}%</div></div>
    <div class="card"><div class="label">Passed</div><div class="value" style="color:#22c55e">${passed}</div></div>
    <div class="card"><div class="label">Failed</div><div class="value" style="color:${failed > 0 ? '#ef4444' : '#22c55e'}">${failed}</div></div>
    <div class="card"><div class="label">Total</div><div class="value">${results.length}</div></div>
  </div>
  ${results.length > 0 ? `
  <table>
    <thead><tr><th>Status</th><th>Function</th><th>Description</th><th>Type</th><th>Time</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>` : '<p style="color:#718096;text-align:center;padding:3rem">No results yet.</p>'}
</body>
</html>`

  await fs.writeFile(path.join(dir, 'report.html'), html, 'utf8')
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default ReportOutputPlugin

/**
 * @codecheck/output-dashboard — Dashboard output plugin.
 *
 * Writes structured test results to `.codecheck-results/` in the project root:
 *   - latest.json  — the most recent run (full TestResult[])
 *   - history.json — last 50 runs (summary only, for trend charts)
 *   - flakiness.json — per-test pass/fail counts derived from history
 *
 * A companion `codecheck-serve` CLI reads these files and serves a web dashboard
 * at http://localhost:3333 with auto-refresh every 5 seconds.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type { CodeCheckConfig, OutputPlugin, TestResult } from '@codecheck/core'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RunSummary {
  timestamp: string
  totalTests: number
  passedTests: number
  passRate: number
  testTypes: string[]
  files: string[]
  durationMs: number
}

export interface RunRecord {
  summary: RunSummary
  results: SerializedResult[]
}

export interface SerializedResult {
  description: string
  testType: string
  targetName: string
  filePath: string
  passed: boolean
  error?: string
  duration: number
}

export interface FlakinessEntry {
  targetName: string
  filePath: string
  testType: string
  passCount: number
  failCount: number
  totalRuns: number
  isFlaky: boolean
  lastStatus: 'passed' | 'failed'
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export class DashboardOutputPlugin implements OutputPlugin {
  readonly name = 'dashboard'

  async report(results: TestResult[], config: CodeCheckConfig): Promise<void> {
    const cwd = process.cwd()
    const resultsDir = path.join(cwd, '.codecheck-results')

    await fs.mkdir(resultsDir, { recursive: true })

    const serialized = serializeResults(results)
    const summary = buildSummary(results, config)

    const record: RunRecord = { summary, results: serialized }

    // Write latest results
    await fs.writeFile(
      path.join(resultsDir, 'latest.json'),
      JSON.stringify(record, null, 2),
      'utf8',
    )

    // Update history (last 50 runs, summary only)
    const historyPath = path.join(resultsDir, 'history.json')
    const history = await loadJson<RunSummary[]>(historyPath, [])
    history.unshift(summary)
    if (history.length > 50) history.length = 50
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf8')

    // Update flakiness
    await updateFlakiness(resultsDir, serialized)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeResults(results: TestResult[]): SerializedResult[] {
  return results.map((r) => {
    const s: SerializedResult = {
      description: r.testCase.description,
      testType: r.testCase.testType,
      targetName: r.target.name,
      filePath: r.target.filePath,
      passed: r.passed,
      duration: r.duration,
    }
    if (r.error !== undefined) s.error = r.error
    return s
  })
}

function buildSummary(results: TestResult[], config: CodeCheckConfig): RunSummary {
  const passed = results.filter((r) => r.passed).length
  const testTypes = [...new Set(results.map((r) => r.testCase.testType))]
  const files = [...new Set(results.map((r) => r.target.filePath))]
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)

  return {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    passedTests: passed,
    passRate: results.length > 0 ? passed / results.length : 0,
    testTypes,
    files,
    durationMs: totalDuration,
  }
}

async function updateFlakiness(
  resultsDir: string,
  results: SerializedResult[],
): Promise<void> {
  const flakinessPath = path.join(resultsDir, 'flakiness.json')
  const store = await loadJson<Record<string, FlakinessEntry>>(flakinessPath, {})

  for (const r of results) {
    const key = `${r.filePath}::${r.targetName}::${r.testType}::${r.description}`
    const existing = store[key] ?? {
      targetName: r.targetName,
      filePath: r.filePath,
      testType: r.testType,
      passCount: 0,
      failCount: 0,
      totalRuns: 0,
      isFlaky: false,
      lastStatus: r.passed ? ('passed' as const) : ('failed' as const),
    }

    existing.totalRuns++
    if (r.passed) {
      existing.passCount++
    } else {
      existing.failCount++
    }
    existing.lastStatus = r.passed ? 'passed' : 'failed'
    // Flaky = has both passes and fails across at least 3 runs
    existing.isFlaky =
      existing.totalRuns >= 3 && existing.passCount > 0 && existing.failCount > 0

    store[key] = existing
  }

  await fs.writeFile(flakinessPath, JSON.stringify(store, null, 2), 'utf8')
}

async function loadJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content) as T
  } catch {
    return defaultValue
  }
}

export { loadJson }

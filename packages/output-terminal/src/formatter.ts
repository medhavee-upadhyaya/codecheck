/**
 * formatter.ts — Pure functions for formatting test results as terminal strings.
 * No side effects. All chalk usage is here, not in the plugin class.
 */

import chalk from 'chalk'
import type { TestResult, CodeCheckConfig } from '@codecheck/core'

const PASS = chalk.green('✓')
const FAIL = chalk.red('✗')
const WARN = chalk.yellow('⚠')

// ─── Individual Result Line ───────────────────────────────────────────────────

export function formatResult(result: TestResult): string {
  const icon = result.passed ? PASS : FAIL
  const label = result.passed ? chalk.green(result.testCase.description) : chalk.red(result.testCase.description)
  const duration = chalk.dim(`(${result.duration}ms)`)
  const cache = result.fromCache ? chalk.dim(' [cached]') : ''
  const testType = chalk.dim(`[${result.testCase.testType}]`)

  let line = `  ${icon} ${testType} ${label} ${duration}${cache}`

  if (!result.passed && result.error) {
    const errorLines = result.error
      .split('\n')
      .slice(0, 6)
      .map((l) => `       ${chalk.red(l)}`)
      .join('\n')
    line += `\n${errorLines}`
  }

  return line
}

// ─── Target Group Header ─────────────────────────────────────────────────────

export function formatTargetHeader(targetName: string, filePath: string): string {
  const shortPath = filePath.replace(process.cwd(), '').replace(/^\//, '')
  return `\n${chalk.bold.cyan(targetName)} ${chalk.dim(shortPath)}`
}

// ─── Summary Footer ───────────────────────────────────────────────────────────

export function formatSummary(results: TestResult[], config: CodeCheckConfig): string {
  const total = results.length
  const passed = results.filter((r) => r.passed).length
  const failed = total - passed
  const cached = results.filter((r) => r.fromCache).length
  const rate = total === 0 ? 0 : Math.round((passed / total) * 100)

  const passStr = chalk.green(`${passed} passed`)
  const failStr = failed > 0 ? chalk.red(`${failed} failed`) : chalk.dim('0 failed')
  const rateStr = rate >= config.threshold * 100 ? chalk.green(`${rate}%`) : chalk.red(`${rate}%`)
  const cachedStr = cached > 0 ? chalk.dim(` · ${cached} from cache`) : ''

  let summary = `\n${chalk.bold('Results:')} ${passStr} · ${failStr} · ${rateStr} pass rate${cachedStr}`

  if (total === 0) {
    summary = `\n${chalk.yellow('No tests generated.')}`
  } else if (rate < config.threshold * 100) {
    summary += `\n${WARN} ${chalk.yellow(`Below threshold (${Math.round(config.threshold * 100)}%). Failing the commit.`)}`
  }

  return summary
}

// ─── Banner Header ────────────────────────────────────────────────────────────

export function formatHeader(fileCount: number): string {
  return `\n${chalk.bold.blue('CodeCheck')} ${chalk.dim(`· running on ${fileCount} file${fileCount === 1 ? '' : 's'}`)}`
}

// ─── No-Results Message ───────────────────────────────────────────────────────

export function formatNoTargets(): string {
  return chalk.dim('\n  No testable targets found in changed files.')
}

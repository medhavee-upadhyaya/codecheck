/**
 * formatter.ts — Pure functions for formatting test results as terminal strings.
 * No side effects. All chalk usage is here, not in the plugin class.
 */

import chalk from 'chalk'
import type { TestResult, CodeCheckConfig } from '@codecheck/core'

const PASS = chalk.green('✓')
const FAIL = chalk.red('✗')
const WARN = chalk.yellow('⚠')

// ─── Human-readable error translator ─────────────────────────────────────────

/**
 * Translate a raw Jest/pytest error into a plain-English one-liner.
 * Any developer — not just the one who wrote the function — should understand it.
 */
export function humanizeError(error: string): string {
  // "expected X to equal Y" / "expected X to deeply equal Y"
  const equalMatch = error.match(/expected (.*?) to (?:deeply )?equal (.*)/)
  if (equalMatch != null) {
    const got = equalMatch[1]?.trim() ?? '?'
    const want = equalMatch[2]?.trim().split('\n')[0] ?? '?'
    return `Returned ${got} but expected ${want}`
  }

  if (/Cannot read propert(?:y|ies) of (?:null|undefined)/.test(error)) {
    return 'Crashed on null or undefined input — the function needs a null check'
  }

  if (/is not a function/.test(error)) {
    return 'Function not found or not exported — check the import or spelling'
  }

  if (/(?:expected.*to be defined|received undefined)/i.test(error)) {
    return 'Function returned undefined — it may be missing a return statement'
  }

  if (/(?:did not throw|expected.*to throw)/i.test(error)) {
    return 'Expected the function to throw an error, but it completed normally'
  }

  if (/(?:Timeout|timed out)/i.test(error)) {
    return 'Test timed out — the function may be stuck or missing an await'
  }

  if (/SyntaxError/.test(error)) {
    return 'Generated test has a syntax error — set keepGeneratedTests: true to inspect'
  }

  if (/ReferenceError/.test(error)) {
    return 'A variable or import was used before being defined'
  }

  if (/TypeError/.test(error)) {
    return 'Type mismatch — the input or return type may not match the function'
  }

  if (/AssertionError/.test(error)) {
    return 'The value did not match what was expected'
  }

  return error.split('\n')[0]?.slice(0, 100) ?? error.slice(0, 100)
}

// ─── Individual Result Line ───────────────────────────────────────────────────

export function formatResult(result: TestResult): string {
  const icon = result.passed ? PASS : FAIL
  const label = result.passed
    ? chalk.green(result.testCase.description)
    : chalk.red(result.testCase.description)
  const duration = chalk.dim(`(${result.duration}ms)`)
  const cache = result.fromCache ? chalk.dim(' [cached]') : ''
  const testType = chalk.dim(`[${result.testCase.testType}]`)

  let line = `  ${icon} ${testType} ${label} ${duration}${cache}`

  if (!result.passed && result.error) {
    // Plain-English summary — what went wrong in one sentence
    const plain = humanizeError(result.error)
    line += `\n       ${chalk.yellow('→')} ${chalk.yellow(plain)}`

    // Technical details below, dimmed — for developers who want to dig in
    const technicalLines = result.error
      .split('\n')
      .slice(0, 4)
      .map((l) => `         ${chalk.dim(l)}`)
      .join('\n')
    line += `\n${technicalLines}`
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

/**
 * @codecheck/output-terminal — Terminal output plugin.
 *
 * Renders test results in the terminal with:
 *   - Colored pass/fail indicators per test
 *   - Per-target grouping
 *   - Summary footer with pass rate and threshold warning
 *   - Cache hit indicators
 */

import type { OutputPlugin, TestResult, CodeCheckConfig } from '@codecheck/core'
import {
  formatHeader,
  formatTargetHeader,
  formatResult,
  formatSummary,
  formatNoTargets,
} from './formatter.js'

export class TerminalOutputPlugin implements OutputPlugin {
  readonly name = 'terminal'

  async report(results: TestResult[], config: CodeCheckConfig): Promise<void> {
    // Group by target file + name
    const byTarget = new Map<string, TestResult[]>()
    for (const result of results) {
      const key = `${result.target.filePath}::${result.target.name}`
      const existing = byTarget.get(key)
      if (existing) {
        existing.push(result)
      } else {
        byTarget.set(key, [result])
      }
    }

    // Count unique files
    const fileSet = new Set(results.map((r) => r.target.filePath))
    console.log(formatHeader(fileSet.size))

    if (results.length === 0) {
      console.log(formatNoTargets())
      return
    }

    // Print results grouped by target
    for (const [key, targetResults] of byTarget) {
      const first = targetResults[0]
      if (!first) continue
      console.log(formatTargetHeader(first.target.name, first.target.filePath))
      for (const result of targetResults) {
        console.log(formatResult(result))
      }
    }

    // Summary
    console.log(formatSummary(results, config))
    console.log()
  }
}

export { formatHeader, formatTargetHeader, formatResult, formatSummary, formatNoTargets } from './formatter.js'

export default TerminalOutputPlugin

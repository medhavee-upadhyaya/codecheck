#!/usr/bin/env node
/**
 * bin.ts — CodeCheck CI entry point.
 *
 * Runs in GitHub Actions, GitLab CI, or any CI environment.
 * Detects changed files from the CI environment, generates tests,
 * and exits 0 (pass) or 1 (fail) based on results.
 *
 * Unlike commit/push hooks, CI is an appropriate place to fail hard
 * when tests don't pass — this is a gate, not a safety net.
 * Defaults still exit 0 on CodeCheck's own errors to avoid false negatives.
 *
 * GitHub Actions example:
 *   - name: Run CodeCheck
 *     run: npx codecheck-ci
 *     env:
 *       ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
 */

import { loadConfig, CodeCheckEngine, createLLMClient } from '@codecheck/core'
import type { ScopePlugin, TestType } from '@codecheck/core'
import { UnitScopePlugin } from '@codecheck/scope-unit'
import { SmokeScopePlugin } from '@codecheck/scope-smoke'
import { FunctionalScopePlugin } from '@codecheck/scope-functional'
import { SanityScopePlugin } from '@codecheck/scope-sanity'
import { IntegrationScopePlugin } from '@codecheck/scope-integration'
import { ApiScopePlugin } from '@codecheck/scope-api'
import { E2EScopePlugin } from '@codecheck/scope-e2e'
import { SnapshotScopePlugin } from '@codecheck/scope-snapshot'
import { RegressionScopePlugin } from '@codecheck/scope-regression'
import { TerminalOutputPlugin } from '@codecheck/output-terminal'
import { GithubOutputPlugin } from '@codecheck/output-github'
import { DashboardOutputPlugin } from '@codecheck/output-dashboard'
import { getCIChangedFiles } from './getCIChangedFiles.js'
import chalk from 'chalk'

const ALL_SCOPE_PLUGINS: Record<string, () => ScopePlugin> = {
  unit: () => new UnitScopePlugin(),
  smoke: () => new SmokeScopePlugin(),
  functional: () => new FunctionalScopePlugin(),
  sanity: () => new SanityScopePlugin(),
  integration: () => new IntegrationScopePlugin(),
  api: () => new ApiScopePlugin(),
  e2e: () => new E2EScopePlugin(),
  snapshot: () => new SnapshotScopePlugin(),
  regression: () => new RegressionScopePlugin(),
}

function buildScopePlugins(testTypes: TestType[]): ScopePlugin[] {
  const plugins: ScopePlugin[] = []
  for (const type of testTypes) {
    const factory = ALL_SCOPE_PLUGINS[type]
    if (factory) plugins.push(factory())
  }
  if (plugins.length === 0) {
    plugins.push(new UnitScopePlugin(), new SmokeScopePlugin())
  }
  return plugins
}

function hasRequiredApiKey(provider: string): boolean {
  if (provider === 'ollama') return true
  const key = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY' }[provider] ?? 'ANTHROPIC_API_KEY'
  return !!process.env[key]
}

function getKeyName(provider: string): string {
  return { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', ollama: '(none required)' }[provider] ?? 'ANTHROPIC_API_KEY'
}

function isGitHubActions(): boolean {
  return process.env['GITHUB_ACTIONS'] === 'true'
}

function ghaAnnotation(level: 'warning' | 'error', message: string, file?: string): void {
  const loc = file ? `file=${file},` : ''
  console.log(`::${level} ${loc}title=CodeCheck::${message}`)
}

async function main(): Promise<void> {
  const cwd = process.env['GITHUB_WORKSPACE'] ?? process.cwd()
  const isGHA = isGitHubActions()

  let config
  try {
    config = await loadConfig(cwd)
  } catch (err) {
    if (isGHA) ghaAnnotation('warning', 'Could not load CodeCheck config — skipping.')
    else console.error(chalk.yellow('[CodeCheck] Could not load config — skipping.'))
    console.error(chalk.dim(String(err)))
    process.exit(0)
  }

  if (!hasRequiredApiKey(config.provider)) {
    const keyName = getKeyName(config.provider)
    if (isGHA) ghaAnnotation('warning', `${keyName} not set — skipping CodeCheck.`)
    else console.error(chalk.yellow(`[CodeCheck] ${keyName} not set — skipping.`))
    process.exit(0)
  }

  let changedFiles: string[]
  try {
    changedFiles = await getCIChangedFiles(cwd)
  } catch (err) {
    if (isGHA) ghaAnnotation('warning', 'Could not determine changed files — skipping.')
    console.error(chalk.dim(String(err)))
    process.exit(0)
  }

  if (changedFiles.length === 0) {
    console.log(chalk.dim('[CodeCheck] No changed files detected — nothing to test.'))
    process.exit(0)
  }

  console.log(chalk.cyan(`\n[CodeCheck] Testing ${changedFiles.length} changed file(s)…`))

  const scopePlugins = buildScopePlugins(config.testTypes)
  const outputPlugins = [
    new TerminalOutputPlugin(),
    new GithubOutputPlugin(),
    new DashboardOutputPlugin(),
  ]
  const llmClient = createLLMClient(config)

  let results
  try {
    const engine = new CodeCheckEngine(config, scopePlugins, { cwd, llmClient })
    results = await engine.run(changedFiles)
  } catch (err) {
    if (isGHA) ghaAnnotation('warning', `CodeCheck encountered an error: ${String(err)}`)
    else console.error(chalk.yellow('[CodeCheck] Unexpected error — skipping.'), String(err))
    if (config.failOnError) process.exit(1)
    process.exit(0)
  }

  for (const plugin of outputPlugins) {
    try {
      await plugin.report(results, config)
    } catch {
      // Never let output plugin failures fail the CI job
    }
  }

  // GitHub Actions step summary
  if (isGHA && process.env['GITHUB_STEP_SUMMARY']) {
    try {
      const passed = results.filter((r) => r.passed).length
      const rate = results.length > 0 ? Math.round((passed / results.length) * 100) : 100
      const summary = `## CodeCheck Results\n\n**Pass rate:** ${rate}% (${passed}/${results.length})\n`
      await import('node:fs').then((fs) =>
        fs.appendFileSync(process.env['GITHUB_STEP_SUMMARY']!, summary),
      )
    } catch {
      // Step summary is optional
    }
  }

  if (results.length === 0) process.exit(0)

  const passed = results.filter((r) => r.passed).length
  const rate = passed / results.length

  if (rate < config.threshold && config.failOnError) {
    process.exit(1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(chalk.yellow('[CodeCheck] Fatal error — skipping to avoid blocking CI.'))
  console.error(chalk.dim(String(err)))
  process.exit(0)
})

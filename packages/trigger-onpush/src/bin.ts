#!/usr/bin/env node
/**
 * bin.ts — CodeCheck pre-push entry point.
 *
 * Invoked by the husky pre-push hook. Tests all files changed between
 * the local branch and the remote before the push goes through.
 *
 * CRITICAL: Any unexpected error exits 0 (never blocks a push) unless
 * failOnError is explicitly set to true in the project config.
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
import { DashboardOutputPlugin } from '@codecheck/output-dashboard'
import { getPushedFiles } from './getPushedFiles.js'
import ora from 'ora'
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

async function main(): Promise<void> {
  const cwd = process.cwd()
  const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('--dry')

  let config
  try {
    config = await loadConfig(cwd)
  } catch (err) {
    console.error(chalk.yellow('\n[CodeCheck] Could not load config — skipping push check.'))
    console.error(chalk.dim(String(err)))
    process.exit(0)
  }

  let pushedFiles: string[]
  try {
    pushedFiles = await getPushedFiles(cwd)
  } catch (err) {
    console.error(chalk.yellow('\n[CodeCheck] Could not read pushed files — skipping.'))
    console.error(chalk.dim(String(err)))
    process.exit(0)
  }

  if (pushedFiles.length === 0) {
    process.exit(0)
  }

  if (isDryRun) {
    console.log(chalk.bold.cyan('\n[CodeCheck] Dry-run mode — no tests will be generated.\n'))
    console.log(chalk.dim('Files in this push that would be tested:'))
    for (const f of pushedFiles) console.log(chalk.white(`  • ${f}`))
    process.exit(0)
  }

  if (!hasRequiredApiKey(config.provider)) {
    console.error(chalk.yellow(`\n[CodeCheck] ${getKeyName(config.provider)} not set — skipping push check.`))
    process.exit(0)
  }

  const scopePlugins = buildScopePlugins(config.testTypes)
  const outputPlugins = [new TerminalOutputPlugin(), new DashboardOutputPlugin()]
  const llmClient = createLLMClient(config)

  const spinner = ora({ text: chalk.cyan('CodeCheck: generating tests…'), color: 'cyan' }).start()

  let results
  try {
    const engine = new CodeCheckEngine(config, scopePlugins, { cwd, llmClient })
    results = await engine.run(pushedFiles)
    spinner.stop()
  } catch (err) {
    spinner.stop()
    console.error(chalk.yellow('\n[CodeCheck] Unexpected error — skipping push check.'))
    console.error(chalk.dim(String(err)))
    if (config.failOnError) process.exit(1)
    process.exit(0)
  }

  for (const plugin of outputPlugins) {
    try {
      await plugin.report(results, config)
    } catch (err) {
      console.error(chalk.yellow(`[CodeCheck] Could not render results (${plugin.name}).`))
      console.error(chalk.dim(String(err)))
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
  console.error(chalk.yellow('\n[CodeCheck] Fatal error — skipping to avoid blocking push.'))
  console.error(chalk.dim(String(err)))
  process.exit(0)
})

#!/usr/bin/env node
/**
 * bin.ts — CodeCheck pre-commit entry point.
 *
 * This script is invoked by the husky pre-commit hook. It:
 *   1. Loads the project config
 *   2. Gets staged TypeScript/JavaScript files
 *   3. Runs the CodeCheck engine (extract → LLM → generate → run)
 *   4. Renders results via the terminal output plugin
 *   5. Exits 0 (pass) or 1 (fail) based on threshold + failOnError config
 *
 * CRITICAL: Any unexpected error exits 0 (never blocks a commit) unless
 * failOnError is explicitly set to true in the project config.
 */

import { loadConfig, CodeCheckEngine, AnthropicLLMClient } from '@codecheck/core'
import type { ScopePlugin, TestType } from '@codecheck/core'
import { UnitScopePlugin } from '@codecheck/scope-unit'
import { SmokeScopePlugin } from '@codecheck/scope-smoke'
import { FunctionalScopePlugin } from '@codecheck/scope-functional'
import { SanityScopePlugin } from '@codecheck/scope-sanity'
import { IntegrationScopePlugin } from '@codecheck/scope-integration'
import { ApiScopePlugin } from '@codecheck/scope-api'
import { TerminalOutputPlugin } from '@codecheck/output-terminal'
import { getStagedFiles } from './getStagedFiles.js'
import ora from 'ora'
import chalk from 'chalk'

/** All available scope plugins, keyed by test type. */
const ALL_SCOPE_PLUGINS: Record<string, () => ScopePlugin> = {
  unit: () => new UnitScopePlugin(),
  smoke: () => new SmokeScopePlugin(),
  functional: () => new FunctionalScopePlugin(),
  sanity: () => new SanityScopePlugin(),
  integration: () => new IntegrationScopePlugin(),
  api: () => new ApiScopePlugin(),
}

function buildScopePlugins(testTypes: TestType[]): ScopePlugin[] {
  const plugins: ScopePlugin[] = []
  for (const type of testTypes) {
    const factory = ALL_SCOPE_PLUGINS[type]
    if (factory) plugins.push(factory())
  }
  // Always include unit + smoke as fallback if nothing matched
  if (plugins.length === 0) {
    plugins.push(new UnitScopePlugin(), new SmokeScopePlugin())
  }
  return plugins
}

async function main(): Promise<void> {
  const cwd = process.cwd()

  // ─── Load Config ───────────────────────────────────────────────────────────
  let config
  try {
    config = await loadConfig(cwd)
  } catch (err) {
    console.error(chalk.yellow('\n[CodeCheck] Could not load config — skipping.'))
    console.error(chalk.dim(String(err)))
    process.exit(0)
  }

  // ─── Get Staged Files ─────────────────────────────────────────────────────
  let stagedFiles: string[]
  try {
    stagedFiles = await getStagedFiles(cwd)
  } catch (err) {
    console.error(chalk.yellow('\n[CodeCheck] Could not read staged files — skipping.'))
    console.error(chalk.dim(String(err)))
    process.exit(0)
  }

  if (stagedFiles.length === 0) {
    process.exit(0)
  }

  // ─── Build Plugins ────────────────────────────────────────────────────────
  const scopePlugins = buildScopePlugins(config.testTypes)
  const outputPlugin = new TerminalOutputPlugin()

  // ─── LLM Client ───────────────────────────────────────────────────────────
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    console.error(chalk.yellow('\n[CodeCheck] ANTHROPIC_API_KEY not set — skipping.'))
    process.exit(0)
  }

  const llmClient = new AnthropicLLMClient(apiKey)

  // ─── Spinner ──────────────────────────────────────────────────────────────
  const spinner = ora({
    text: chalk.cyan('CodeCheck: generating tests…'),
    color: 'cyan',
  }).start()

  // ─── Run Engine ───────────────────────────────────────────────────────────
  let results
  try {
    const engine = new CodeCheckEngine(config, scopePlugins, { cwd, llmClient })
    results = await engine.run(stagedFiles)
    spinner.stop()
  } catch (err) {
    spinner.stop()
    console.error(chalk.yellow('\n[CodeCheck] Unexpected error — skipping.'))
    console.error(chalk.dim(String(err)))
    if (config.failOnError) {
      process.exit(1)
    }
    process.exit(0)
  }

  // ─── Report Results ───────────────────────────────────────────────────────
  try {
    await outputPlugin.report(results, config)
  } catch (err) {
    console.error(chalk.yellow('[CodeCheck] Could not render results.'))
    console.error(chalk.dim(String(err)))
  }

  // ─── Exit Code ────────────────────────────────────────────────────────────
  if (results.length === 0) {
    process.exit(0)
  }

  const passed = results.filter((r) => r.passed).length
  const rate = passed / results.length
  const belowThreshold = rate < config.threshold

  if (belowThreshold && config.failOnError) {
    process.exit(1)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(chalk.yellow('\n[CodeCheck] Fatal error — skipping to avoid blocking commit.'))
  console.error(chalk.dim(String(err)))
  process.exit(0)
})

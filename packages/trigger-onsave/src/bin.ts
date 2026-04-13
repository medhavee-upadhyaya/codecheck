#!/usr/bin/env node
/**
 * bin.ts — codecheck-watch CLI entry point.
 *
 * Usage:
 *   npx codecheck-watch             # watch current directory
 *   npx codecheck-watch ./src       # watch specific directory
 *
 * Requires ANTHROPIC_API_KEY in environment.
 */

import { loadConfig, CodeCheckEngine, AnthropicLLMClient } from '@codecheck/core'
import { UnitScopePlugin } from '@codecheck/scope-unit'
import { SmokeScopePlugin } from '@codecheck/scope-smoke'
import { TerminalOutputPlugin } from '@codecheck/output-terminal'
import { OnSaveTrigger } from './index.js'
import chalk from 'chalk'

async function main(): Promise<void> {
  const cwd = process.cwd()
  const watchDir = process.argv[2] ? new URL(process.argv[2], `file://${cwd}/`).pathname : cwd

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    console.error(chalk.red('[codecheck-watch] ANTHROPIC_API_KEY is not set. Exiting.'))
    process.exit(1)
  }

  let config
  try {
    config = await loadConfig(cwd)
  } catch (err) {
    console.error(chalk.red('[codecheck-watch] Could not load config.'), String(err))
    process.exit(1)
  }

  const scopePlugins = [new UnitScopePlugin(), new SmokeScopePlugin()]
  const outputPlugin = new TerminalOutputPlugin()
  const llmClient = new AnthropicLLMClient(apiKey)

  const trigger = new OnSaveTrigger({ cwd: watchDir })

  trigger.onTrigger(async (changedFiles) => {
    console.log(chalk.dim(`\n[codecheck-watch] ${changedFiles.length} file(s) changed — running…`))
    try {
      const engine = new CodeCheckEngine(config, scopePlugins, { cwd, llmClient })
      const results = await engine.run(changedFiles)
      await outputPlugin.report(results, config)
    } catch (err) {
      console.error(chalk.yellow('[codecheck-watch] Error during run:'), String(err))
    }
  })

  await trigger.start()
  console.log(chalk.cyan(`[codecheck-watch] Watching ${watchDir} for changes…`))
  console.log(chalk.dim('Press Ctrl+C to stop.'))

  // Keep process alive — chokidar persistent mode handles this,
  // but we also listen for graceful shutdown signals.
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, async () => {
      console.log(chalk.dim('\n[codecheck-watch] Stopping…'))
      await trigger.stop()
      process.exit(0)
    })
  }
}

main().catch((err) => {
  console.error(chalk.red('[codecheck-watch] Fatal error:'), String(err))
  process.exit(1)
})

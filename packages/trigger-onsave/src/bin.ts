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

import { loadConfig, CodeCheckEngine, createLLMClient } from '@codecheck/core'
import { UnitScopePlugin } from '@codecheck/scope-unit'
import { SmokeScopePlugin } from '@codecheck/scope-smoke'
import { TerminalOutputPlugin } from '@codecheck/output-terminal'
import { OnSaveTrigger } from './index.js'
import chalk from 'chalk'

async function main(): Promise<void> {
  const cwd = process.cwd()
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run') || args.includes('--dry')
  const watchArg = args.find((a) => !a.startsWith('--'))
  const watchDir = watchArg ? new URL(watchArg, `file://${cwd}/`).pathname : cwd

  if (isDryRun) {
    console.log(chalk.bold.cyan('\n[codecheck-watch] Dry-run mode — watching but not generating tests.\n'))
    console.log(chalk.dim(`  Watch dir: ${watchDir}`))
    console.log(chalk.dim('  Files will be reported but CodeCheck will not call the LLM.\n'))
    const { OnSaveTrigger } = await import('./index.js')
    const trigger = new OnSaveTrigger({ cwd: watchDir })
    trigger.onTrigger(async (changedFiles) => {
      console.log(chalk.dim(`\n[codecheck-watch] [dry-run] ${changedFiles.length} file(s) would be tested:`))
      for (const f of changedFiles) console.log(chalk.white(`  • ${f}`))
    })
    await trigger.start()
    console.log(chalk.dim('Press Ctrl+C to stop.'))
    process.on('SIGINT', async () => { await trigger.stop(); process.exit(0) })
    return
  }

  let config
  try {
    config = await loadConfig(cwd)
  } catch (err) {
    console.error(chalk.red('[codecheck-watch] Could not load config.'), String(err))
    process.exit(1)
  }

  const providerKeyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
  }
  const requiredKey = providerKeyMap[config.provider] ?? 'ANTHROPIC_API_KEY'
  if (config.provider !== 'ollama' && !process.env[requiredKey]) {
    console.error(chalk.red(`[codecheck-watch] ${requiredKey} is not set. Exiting.`))
    process.exit(1)
  }

  const scopePlugins = [new UnitScopePlugin(), new SmokeScopePlugin()]
  const outputPlugin = new TerminalOutputPlugin()
  const llmClient = createLLMClient(config)

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

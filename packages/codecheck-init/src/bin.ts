#!/usr/bin/env node
/**
 * bin.ts — codecheck-init interactive wizard.
 *
 * Asks the user a series of questions and sets up CodeCheck in their project
 * in under 60 seconds. Writes codecheck config to package.json or
 * codecheck.config.json, and optionally sets up husky.
 */

import chalk from 'chalk'
import { select, checkbox, input, confirm } from '@inquirer/prompts'
import { runInit, detectPackageManager, detectProjectName } from './index.js'
import type { InitAnswers } from './index.js'

async function main(): Promise<void> {
  const cwd = process.cwd()

  // ─── Welcome banner ───────────────────────────────────────────────────────
  console.log()
  console.log(chalk.bold.cyan('  ╔══════════════════════════════════╗'))
  console.log(chalk.bold.cyan('  ║   CodeCheck Init Wizard  v0.1.0  ║'))
  console.log(chalk.bold.cyan('  ╚══════════════════════════════════╝'))
  console.log()
  console.log(chalk.dim('  Set up CodeCheck in your project in under 60 seconds.'))
  console.log()

  // ─── Detect project context ───────────────────────────────────────────────
  const projectName = await detectProjectName(cwd)
  const pm = await detectPackageManager(cwd)
  console.log(chalk.dim(`  Project: ${chalk.white(projectName)}`))
  console.log(chalk.dim(`  Package manager: ${chalk.white(pm)}`))
  console.log()

  // ─── Interactive prompts ──────────────────────────────────────────────────
  let answers: InitAnswers

  try {
    const trigger = await select<InitAnswers['trigger']>({
      message: 'When should CodeCheck run?',
      choices: [
        { name: 'On commit  (pre-commit hook, recommended)', value: 'oncommit' },
        { name: 'On save    (watches files while you work)', value: 'onsave' },
        { name: 'On CI      (runs in your CI pipeline)', value: 'ci' },
      ],
      default: 'oncommit',
    })

    const testTypes = await checkbox<string>({
      message: 'Which test types should CodeCheck generate?',
      choices: [
        { name: 'unit        — edge cases, boundary conditions, mocked deps', value: 'unit', checked: true },
        { name: 'smoke       — happy path, does-it-run sanity checks', value: 'smoke', checked: true },
        { name: 'functional  — input/output behavior, no mocks', value: 'functional', checked: false },
        { name: 'sanity      — 1-2 basic callable/returns-something tests', value: 'sanity', checked: false },
        { name: 'integration — multi-function pipeline flows', value: 'integration', checked: false },
        { name: 'api         — HTTP request/response, status codes', value: 'api', checked: false },
        { name: 'snapshot    — React component snapshots', value: 'snapshot', checked: false },
        { name: 'e2e         — Playwright full user flows', value: 'e2e', checked: false },
      ],
      validate: (choices) => choices.length > 0 || 'Select at least one test type.',
    })

    const output = await checkbox<string>({
      message: 'Where should results be reported?',
      choices: [
        { name: 'terminal  — colored output in the console', value: 'terminal', checked: true },
        { name: 'github    — PR comment via GitHub Actions', value: 'github', checked: false },
      ],
      validate: (choices) => choices.length > 0 || 'Select at least one output.',
    })

    const language = await select<InitAnswers['language']>({
      message: 'What language does your project use?',
      choices: [
        { name: 'TypeScript', value: 'typescript' },
        { name: 'JavaScript', value: 'javascript' },
        { name: 'Python', value: 'python' },
      ],
      default: 'typescript',
    })

    const framework = await select<InitAnswers['framework']>({
      message: 'Which test framework should CodeCheck generate tests for?',
      choices:
        language === 'python'
          ? [{ name: 'pytest', value: 'pytest' as const }]
          : [
              { name: 'Jest', value: 'jest' as const },
              { name: 'Vitest', value: 'vitest' as const },
            ],
      default: language === 'python' ? 'pytest' : 'jest',
    })

    const model = await select<string>({
      message: 'Which AI model should generate tests?',
      choices: [
        { name: 'claude-sonnet-4-6  (recommended — fast, accurate)', value: 'claude-sonnet-4-6' },
        { name: 'claude-opus-4-6    (most capable, slower)', value: 'claude-opus-4-6' },
        { name: 'claude-haiku-4-5   (fastest, cheapest)', value: 'claude-haiku-4-5-20251001' },
      ],
      default: 'claude-sonnet-4-6',
    })

    const thresholdStr = await input({
      message: 'Minimum pass rate to consider a run successful (0–1):',
      default: '0.8',
      validate: (val) => {
        const n = parseFloat(val)
        return (!isNaN(n) && n >= 0 && n <= 1) || 'Enter a number between 0 and 1 (e.g. 0.8)'
      },
    })

    const failOnError = await confirm({
      message: 'Block the commit/CI if tests fail below threshold?',
      default: false,
    })

    let setupHusky = false
    if (trigger === 'oncommit') {
      setupHusky = await confirm({
        message: 'Set up husky pre-commit hook automatically?',
        default: true,
      })
    }

    answers = {
      trigger,
      testTypes,
      output,
      language,
      framework,
      model,
      threshold: parseFloat(thresholdStr),
      failOnError,
      setupHusky,
    }
  } catch (err: unknown) {
    // User cancelled with Ctrl+C
    if (err instanceof Error && err.message.includes('canceled')) {
      console.log(chalk.dim('\n  Setup cancelled.'))
      process.exit(0)
    }
    throw err
  }

  // ─── Run init ─────────────────────────────────────────────────────────────
  console.log()
  console.log(chalk.dim('  Writing config…'))

  const result = await runInit(cwd, answers)

  // ─── Success output ───────────────────────────────────────────────────────
  console.log()
  console.log(chalk.green('  ✓ CodeCheck configured successfully!'))
  console.log()
  console.log(chalk.dim('  Config written to:'), chalk.white(result.configPath))

  if (result.huskySetup) {
    console.log(chalk.dim('  Husky hook:      '), chalk.white('.husky/pre-commit'))
  }

  if (result.warnings.length > 0) {
    console.log()
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  ⚠ ${warning}`))
    }
  }

  // ─── Next steps ───────────────────────────────────────────────────────────
  console.log()
  console.log(chalk.bold('  Next steps:'))
  console.log()

  if (!process.env['ANTHROPIC_API_KEY']) {
    console.log(
      chalk.white('  1. Set your API key:'),
      chalk.cyan('export ANTHROPIC_API_KEY=sk-ant-…'),
    )
  }

  if (answers.trigger === 'oncommit' && !result.huskySetup) {
    console.log(
      chalk.white(`  ${process.env['ANTHROPIC_API_KEY'] ? '1' : '2'}. Install husky:`),
      chalk.cyan(`${pm} install --save-dev husky && npx husky init`),
    )
    console.log(
      chalk.white('     Then add to .husky/pre-commit:'),
      chalk.cyan('npx codecheck-run'),
    )
  }

  if (answers.trigger === 'onsave') {
    console.log(chalk.white('  Start watching:'), chalk.cyan('npx codecheck-watch'))
  }

  console.log()
  console.log(chalk.dim('  Docs: https://github.com/medhavee/codecheck'))
  console.log()
}

main().catch((err) => {
  console.error(chalk.red('\n  Error during init:'), String(err))
  process.exit(1)
})

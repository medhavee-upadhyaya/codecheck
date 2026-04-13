/**
 * @codecheck/init — CodeCheck init wizard.
 *
 * Core logic for generating a CodeCheck configuration and setting up
 * husky pre-commit hooks. Used by the interactive CLI (bin.ts) and
 * testable independently of the interactive prompt.
 */

import { writeFile, readFile, access } from 'node:fs/promises'
import { resolve, basename } from 'node:path'
import { execSync } from 'node:child_process'
import type { CodeCheckConfig } from '@codecheck/core'

export interface InitAnswers {
  trigger: 'oncommit' | 'onsave' | 'ci'
  testTypes: string[]
  output: string[]
  model: string
  language: 'typescript' | 'javascript' | 'python'
  framework: 'jest' | 'vitest' | 'pytest'
  threshold: number
  failOnError: boolean
  setupHusky: boolean
}

export interface InitResult {
  configPath: string
  huskySetup: boolean
  warnings: string[]
}

/**
 * Build a CodeCheckConfig object from init wizard answers.
 */
export function buildConfig(answers: InitAnswers): Partial<CodeCheckConfig> {
  return {
    trigger: answers.trigger,
    testTypes: answers.testTypes as CodeCheckConfig['testTypes'],
    output: answers.output,
    model: answers.model,
    language: answers.language,
    framework: answers.framework,
    threshold: answers.threshold,
    exclude: ['node_modules', 'dist', '*.test.ts', '*.spec.ts', '*.test.js', '*.spec.js'],
    concurrency: 3,
    failOnError: answers.failOnError,
    keepGeneratedTests: false,
    cacheTtlDays: 7,
  }
}

/**
 * Write the config to the project. Tries package.json first ("codecheck" key),
 * falls back to writing codecheck.config.json if package.json doesn't exist.
 */
export async function writeConfig(
  cwd: string,
  config: Partial<CodeCheckConfig>,
): Promise<{ configPath: string; method: 'package.json' | 'codecheck.config.json' }> {
  const pkgPath = resolve(cwd, 'package.json')

  try {
    await access(pkgPath)
    // package.json exists — inject "codecheck" key
    const raw = await readFile(pkgPath, 'utf8')
    const pkg = JSON.parse(raw) as Record<string, unknown>
    pkg['codecheck'] = config
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
    return { configPath: pkgPath, method: 'package.json' }
  } catch {
    // No package.json — write standalone config file
    const configPath = resolve(cwd, 'codecheck.config.json')
    await writeFile(configPath, JSON.stringify({ codecheck: config }, null, 2) + '\n', 'utf8')
    return { configPath, method: 'codecheck.config.json' }
  }
}

/**
 * Set up husky v9 pre-commit hook for codecheck-run.
 * Returns true if successful, false if husky isn't installed.
 */
export async function setupHusky(cwd: string): Promise<{ success: boolean; warning?: string }> {
  // Check if husky is available
  try {
    execSync('npx husky --version', { cwd, stdio: 'pipe' })
  } catch {
    return {
      success: false,
      warning: 'husky not found — install it with: npm install --save-dev husky',
    }
  }

  try {
    // Initialize husky (creates .husky/ directory)
    execSync('npx husky init', { cwd, stdio: 'pipe' })

    // Write the pre-commit hook
    const hookContent = `#!/bin/sh\nnpx codecheck-run\n`
    await writeFile(resolve(cwd, '.husky', 'pre-commit'), hookContent, { mode: 0o755 })

    return { success: true }
  } catch (err) {
    return {
      success: false,
      warning: `husky setup failed: ${String(err)}`,
    }
  }
}

/**
 * Detect the project's package manager by looking for lock files.
 */
export async function detectPackageManager(
  cwd: string,
): Promise<'npm' | 'pnpm' | 'yarn' | 'bun'> {
  const checks: Array<[string, 'npm' | 'pnpm' | 'yarn' | 'bun']> = [
    ['bun.lockb', 'bun'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
  ]
  for (const [file, pm] of checks) {
    try {
      await access(resolve(cwd, file))
      return pm
    } catch {
      // not found, try next
    }
  }
  return 'npm'
}

/**
 * Detect the project name from package.json, or fall back to directory name.
 */
export async function detectProjectName(cwd: string): Promise<string> {
  try {
    const raw = await readFile(resolve(cwd, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { name?: string }
    if (pkg.name) return pkg.name
  } catch {
    // no package.json
  }
  return basename(cwd)
}

/**
 * Full init flow — writes config, optionally sets up husky.
 */
export async function runInit(cwd: string, answers: InitAnswers): Promise<InitResult> {
  const warnings: string[] = []

  const config = buildConfig(answers)
  const { configPath } = await writeConfig(cwd, config)

  let huskySetup = false
  if (answers.setupHusky && answers.trigger === 'oncommit') {
    const result = await setupHusky(cwd)
    huskySetup = result.success
    if (result.warning) {
      warnings.push(result.warning)
    }
  }

  return { configPath, huskySetup, warnings }
}

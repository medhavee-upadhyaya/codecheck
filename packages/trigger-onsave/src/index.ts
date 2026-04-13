/**
 * @codecheck/trigger-onsave — File watcher trigger plugin.
 *
 * Watches TypeScript/JavaScript source files for changes using chokidar.
 * When a file is saved, runs the CodeCheck engine on that file only.
 *
 * Usage:
 *   npx codecheck-watch [directory]    (defaults to cwd)
 *
 * Or programmatically:
 *   import { OnSaveTrigger } from '@codecheck/trigger-onsave'
 *   const trigger = new OnSaveTrigger({ cwd: '/my/project' })
 *   trigger.onTrigger(async (files) => { await engine.run(files) })
 *   await trigger.start()
 */

import { watch } from 'chokidar'
import { resolve } from 'node:path'
import type { TriggerPlugin } from '@codecheck/core'

export interface OnSaveTriggerOptions {
  /** Root directory to watch. Defaults to process.cwd(). */
  cwd?: string
  /**
   * Glob patterns to watch (relative to cwd).
   * Defaults to TypeScript and JavaScript source files.
   */
  include?: string[]
  /**
   * Glob patterns to exclude.
   * Defaults to node_modules, dist, and test files.
   */
  exclude?: string[]
  /** Debounce delay in ms — multiple rapid saves coalesce into one run. */
  debounceMs?: number
}

const DEFAULT_INCLUDE = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mts', '**/*.cts']
const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*', '**/.codecheck-*/**']

export class OnSaveTrigger implements TriggerPlugin {
  readonly name = 'onsave'

  private readonly cwd: string
  private readonly include: string[]
  private readonly exclude: string[]
  private readonly debounceMs: number
  private handler: ((files: string[]) => Promise<void>) | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingFiles = new Set<string>()
  private watcher: ReturnType<typeof watch> | null = null

  constructor(options: OnSaveTriggerOptions = {}) {
    this.cwd = options.cwd ?? process.cwd()
    this.include = options.include ?? DEFAULT_INCLUDE
    this.exclude = options.exclude ?? DEFAULT_EXCLUDE
    this.debounceMs = options.debounceMs ?? 300
  }

  onTrigger(handler: (changedFiles: string[]) => Promise<void>): void {
    this.handler = handler
  }

  /** Start the file watcher. Resolves once the watcher is ready. */
  async start(): Promise<void> {
    const patterns = this.include.map((p) => resolve(this.cwd, p))

    this.watcher = watch(patterns, {
      cwd: this.cwd,
      ignored: this.exclude,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    })

    this.watcher.on('change', (filePath: string) => {
      this.scheduleRun(resolve(this.cwd, filePath))
    })

    this.watcher.on('add', (filePath: string) => {
      this.scheduleRun(resolve(this.cwd, filePath))
    })

    return new Promise<void>((resolve) => {
      this.watcher!.on('ready', () => resolve())
    })
  }

  /** Stop the file watcher. */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
  }

  private scheduleRun(absolutePath: string): void {
    this.pendingFiles.add(absolutePath)

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      const files = Array.from(this.pendingFiles)
      this.pendingFiles.clear()
      this.debounceTimer = null

      if (this.handler && files.length > 0) {
        this.handler(files).catch(() => {
          // Swallow errors — never crash the watcher
        })
      }
    }, this.debounceMs)
  }
}

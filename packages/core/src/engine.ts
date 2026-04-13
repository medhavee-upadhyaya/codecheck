/**
 * engine.ts — CodeCheckEngine: the main orchestrator.
 *
 * Takes changed files → extracts targets → gets test cases (cache or LLM)
 * → generates test files → runs them → returns structured results.
 *
 * Designed for testability: LLM client and runner function are injectable.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { extractTargets } from './extractor/index.js'
import { computeCacheKey, getCached, setCached } from './cache/index.js'
import { generateTestFile } from './generator/index.js'
import { AnthropicLLMClient } from './llm/client.js'
import { runTests } from './runner/index.js'
import type {
  CodeCheckConfig,
  GeneratedTestFile,
  LLMClient,
  ScopePlugin,
  TestCase,
  TestResult,
  TestTarget,
  TestType,
} from './types.js'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Injectable runner function — defaults to the real Jest runner */
export type RunnerFn = (
  file: GeneratedTestFile,
  config: CodeCheckConfig,
  cwd: string
) => Promise<TestResult[]>

export interface EngineOptions {
  /** Working directory — used for cache dir, temp dir, and jest resolution */
  cwd?: string
  /** Override the LLM client (e.g. MockLLMClient in tests) */
  llmClient?: LLMClient
  /** Override the test runner (e.g. a mock runner in tests) */
  runnerFn?: RunnerFn
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class CodeCheckEngine {
  private readonly config: CodeCheckConfig
  private readonly scopePlugins: ScopePlugin[]
  private readonly llmClient: LLMClient
  private readonly runner: RunnerFn
  private readonly cwd: string

  constructor(
    config: CodeCheckConfig,
    scopePlugins: ScopePlugin[],
    options: EngineOptions = {}
  ) {
    this.config = config
    this.scopePlugins = scopePlugins
    this.cwd = options.cwd ?? process.cwd()

    this.llmClient =
      options.llmClient ??
      new AnthropicLLMClient(process.env['ANTHROPIC_API_KEY'] ?? '')

    this.runner = options.runnerFn ?? runTests
  }

  /**
   * Main entry point.
   *
   * @param changedFiles - Absolute paths to files that changed (e.g. from git diff)
   * @returns All test results — passed and failed
   */
  async run(changedFiles: string[]): Promise<TestResult[]> {
    // 1. Filter out excluded paths
    const files = filterFiles(changedFiles, this.config)
    if (files.length === 0) return []

    // 2. Extract testable targets from all files (in parallel)
    const allTargets = await this.extractAllTargets(files)
    if (allTargets.length === 0) return []

    // 3. For each target, generate test cases (with cache) and run them
    const semaphore = new Semaphore(this.config.concurrency)
    const resultGroups = await Promise.all(
      allTargets.map((target) =>
        semaphore.run(() => this.processTarget(target))
      )
    )

    return resultGroups.flat()
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private async extractAllTargets(files: string[]): Promise<TestTarget[]> {
    const groups = await Promise.allSettled(
      files.map((f) => extractTargets(f))
    )

    const targets: TestTarget[] = []
    for (const result of groups) {
      if (result.status === 'fulfilled') {
        targets.push(...result.value)
      }
      // Silently skip files that fail to parse — don't abort the whole run
    }
    return targets
  }

  private async processTarget(target: TestTarget): Promise<TestResult[]> {
    try {
      // Find which scope plugins apply to this target
      const activeScopePlugin = this.scopePlugins[0]
      const promptSuffix =
        activeScopePlugin != null
          ? activeScopePlugin.buildPrompt(target, this.config.testTypes[0] ?? 'unit')
          : 'Generate thorough tests covering happy path, edge cases, and error conditions.'

      // Gather test cases for each requested test type (with per-type caching)
      const allTestCases = await this.gatherTestCases(target, promptSuffix)
      if (allTestCases.length === 0) return []

      // Generate the test file
      const generatedFile = generateTestFile(target, allTestCases, this.config, this.cwd)

      // Run the tests
      const results = await this.runner(generatedFile, this.config, this.cwd)
      return results
    } catch (err) {
      // Individual target failure must never abort the full run
      const errorMsg = err instanceof Error ? err.message : String(err)
      return this.config.testTypes.map((testType) => ({
        testCase: {
          description: `${target.name} — ${testType} test generation failed`,
          input: null,
          expectedOutput: null,
          category: 'error',
          testType,
        },
        target,
        passed: false,
        error: errorMsg,
        duration: 0,
      }))
    }
  }

  private async gatherTestCases(
    target: TestTarget,
    promptSuffix: string
  ): Promise<TestCase[]> {
    const allCases: TestCase[] = []

    // Request all test types in a single LLM call for efficiency
    const cacheKey = computeCacheKey(
      target.code,
      this.config.testTypes,
      this.config.model
    )

    const cached = await getCached(cacheKey, this.cwd, this.config.cacheTtlDays)
    if (cached != null) {
      return cached
    }

    const cases = await this.llmClient.generateTestCases(
      target,
      this.config.testTypes,
      promptSuffix,
      this.config
    )
    allCases.push(...cases)

    // Cache the result for future runs
    await setCached(cacheKey, allCases, this.config.model, this.cwd)

    return allCases
  }
}

// ─── File Filter ──────────────────────────────────────────────────────────────

function filterFiles(files: string[], config: CodeCheckConfig): string[] {
  const patterns = config.exclude.map((p) => globToRegex(p))
  return files.filter((f) => {
    const normalized = f.replace(/\\/g, '/')
    return !patterns.some((re) => re.test(normalized))
  })
}

/** Convert a simple glob pattern to a RegExp (supports * and ?) */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials except * and ?
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(escaped)
}

// ─── Semaphore ────────────────────────────────────────────────────────────────

/** Limits concurrent async operations to `max` at a time */
class Semaphore {
  private queue: Array<() => void> = []
  private running = 0

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  private release(): void {
    const next = this.queue.shift()
    if (next != null) {
      next()
    } else {
      this.running--
    }
  }
}

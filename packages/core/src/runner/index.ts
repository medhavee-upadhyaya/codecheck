/**
 * runner/index.ts — Executes generated test files via Jest and maps results back to TestResult[].
 *
 * Spawns `npx jest <file> --json --no-coverage` with CI=true env.
 * Jest writes its JSON report to stdout; all other output goes to stderr.
 *
 * Exit codes:
 *   0  = all tests passed
 *   1  = some tests failed (normal — not an error)
 *   2+ = jest crashed (throws TestRunnerError)
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { TestRunnerError } from '../errors.js'
import type { CodeCheckConfig, GeneratedTestFile, TestCase, TestResult } from '../types.js'

const RUNNER_TIMEOUT_MS = 30_000

// ─── Jest JSON output shapes ──────────────────────────────────────────────────

interface JestAssertionResult {
  title: string
  status: 'passed' | 'failed' | 'pending' | 'todo'
  duration: number | null
  failureMessages: string[]
}

interface JestTestResult {
  assertionResults: JestAssertionResult[]
}

interface JestOutput {
  testResults: JestTestResult[]
  success: boolean
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a generated test file with Jest and return structured results.
 *
 * @param generatedFile - The test file to run (must already be written to disk)
 * @param config        - CodeCheck config (for timeout, etc.)
 * @param cwd           - Working directory where Jest is installed
 */
export async function runTests(
  generatedFile: GeneratedTestFile,
  config: CodeCheckConfig,
  cwd: string
): Promise<TestResult[]> {
  const startTime = Date.now()

  // Ensure the temp directory exists before writing
  await fs.mkdir(path.dirname(generatedFile.filePath), { recursive: true })
  // Write the test file to disk
  await fs.writeFile(generatedFile.filePath, generatedFile.content, 'utf-8')

  try {
    const jestOutput = await spawnJest(generatedFile.filePath, cwd)
    return mapResults(jestOutput, generatedFile, startTime)
  } finally {
    // Always clean up, unless keepGeneratedTests is set
    if (!config.keepGeneratedTests) {
      await fs.unlink(generatedFile.filePath).catch(() => undefined)
    }
  }
}

// ─── Jest Spawner ─────────────────────────────────────────────────────────────

async function spawnJest(testFilePath: string, cwd: string): Promise<JestOutput> {
  return new Promise<JestOutput>((resolve, reject) => {
    const jestBin = findJestBin(cwd)

    // Escape the file path for use as a jest testPathPattern (regex)
    const escapedPath = testFilePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const child = spawn(
      jestBin,
      [
        '--testPathPattern', escapedPath,
        '--roots', cwd,
        '--json',
        '--no-coverage',
        '--passWithNoTests',
        '--forceExit',
        '--testTimeout=10000',
      ],
      {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CI: 'true',
          FORCE_COLOR: '0',
          NODE_ENV: 'test',
        },
      }
    )

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new TestRunnerError(`Jest timed out after ${RUNNER_TIMEOUT_MS}ms`, -1))
    }, RUNNER_TIMEOUT_MS)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new TestRunnerError(`Failed to spawn Jest: ${err.message}`, -1))
    })

    child.on('close', (code) => {
      clearTimeout(timer)

      // Exit code 0 = all passed, 1 = some failed — both are valid outcomes
      if (code !== null && code > 1) {
        reject(
          new TestRunnerError(
            `Jest exited with code ${code}. stderr: ${stderr.slice(0, 500)}`,
            code
          )
        )
        return
      }

      // Extract JSON from stdout — jest sometimes emits other lines before the JSON blob
      const jsonStart = stdout.indexOf('{')
      const jsonEnd = stdout.lastIndexOf('}')
      if (jsonStart === -1 || jsonEnd === -1) {
        reject(
          new TestRunnerError(
            `Jest produced no JSON output. stdout: ${stdout.slice(0, 300)}, stderr: ${stderr.slice(0, 300)}`,
            code ?? 1
          )
        )
        return
      }

      try {
        const raw = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1)) as JestOutput
        resolve(raw)
      } catch (err) {
        reject(
          new TestRunnerError(
            `Failed to parse Jest JSON: ${err instanceof Error ? err.message : String(err)}`,
            code ?? 1
          )
        )
      }
    })
  })
}

// ─── Result Mapper ────────────────────────────────────────────────────────────

function mapResults(
  jestOutput: JestOutput,
  generatedFile: GeneratedTestFile,
  startTime: number
): TestResult[] {
  const results: TestResult[] = []

  // Build a lookup from test title → TestCase
  const caseByTitle = new Map<string, TestCase>()
  for (const tc of generatedFile.testCases) {
    caseByTitle.set(tc.description, tc)
  }

  for (const suite of jestOutput.testResults) {
    for (const assertion of suite.assertionResults) {
      const tc = caseByTitle.get(assertion.title)

      // If we can't match by title, create a synthetic TestCase from the jest result
      const testCase: TestCase = tc ?? {
        description: assertion.title,
        input: null,
        expectedOutput: null,
        category: 'unknown',
        testType: 'unit',
      }

      const result: TestResult = {
        testCase,
        target: generatedFile.target,
        passed: assertion.status === 'passed',
        duration: assertion.duration ?? Date.now() - startTime,
      }
      if (assertion.status === 'failed' && assertion.failureMessages.length > 0) {
        result.error = cleanFailureMessage(assertion.failureMessages[0] ?? '')
      }
      results.push(result)
    }
  }

  // If jest reported no test results at all, synthesize failed results for each test case
  if (results.length === 0) {
    for (const tc of generatedFile.testCases) {
      results.push({
        testCase: tc,
        target: generatedFile.target,
        passed: false,
        duration: Date.now() - startTime,
        error: 'No test results returned by Jest',
      })
    }
  }

  return results
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the jest binary by walking up the directory tree from cwd.
 * This handles npm workspaces where jest is hoisted to the workspace root.
 * Falls back to 'npx' if not found anywhere.
 */
function findJestBin(cwd: string): string {
  let dir = cwd
  while (true) {
    const candidate = path.join(dir, 'node_modules', '.bin', 'jest')
    if (existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break // reached filesystem root
    dir = parent
  }
  return 'npx'
}

/**
 * Strip ANSI colour codes and trim Jest's verbose failure prefix to a clean message.
 */
function cleanFailureMessage(msg: string): string {
  return msg
    .replace(/\x1B\[[0-9;]*m/g, '') // strip ANSI
    .split('\n')
    .filter((line) => line.trim() !== '')
    .slice(0, 8) // keep first 8 non-empty lines
    .join('\n')
    .trim()
}

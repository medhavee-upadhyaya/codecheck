/**
 * runner/index.ts — Executes generated test files via Jest (TS/JS) or pytest (Python).
 *
 * Jest: Spawns `npx jest <file> --json --no-coverage`
 * Pytest: Spawns `python -m pytest <file> -v --tb=short --no-header`
 *
 * Routes based on the generated file's framework field.
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
    if (generatedFile.framework === 'pytest') {
      return await runPytestFile(generatedFile, cwd, startTime)
    }
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

// ─── Pytest Runner ────────────────────────────────────────────────────────────

/**
 * Run a pytest file and map results back to TestResult[].
 *
 * Pytest output format (with -v --tb=short --no-header):
 *   .codecheck-tmp/test_foo_abc.py::test_0_adds_two_numbers PASSED
 *   .codecheck-tmp/test_foo_abc.py::test_1_handles_error FAILED
 *
 * We parse PASSED/FAILED lines and match by the test index in the function name.
 */
async function runPytestFile(
  generatedFile: GeneratedTestFile,
  cwd: string,
  startTime: number,
): Promise<TestResult[]> {
  const output = await spawnPytest(generatedFile.filePath, cwd)
  return mapPytestResults(output, generatedFile, startTime)
}

async function spawnPytest(testFilePath: string, cwd: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const pythonBin = findPythonBin(cwd)

    const child = spawn(
      pythonBin,
      ['-m', 'pytest', testFilePath, '-v', '--tb=short', '--no-header', '-rN'],
      {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: '1',
          PYTHONPATH: cwd,
        },
      },
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
      reject(new TestRunnerError(`pytest timed out after ${RUNNER_TIMEOUT_MS}ms`, -1))
    }, RUNNER_TIMEOUT_MS)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new TestRunnerError(`Failed to spawn pytest: ${err.message}`, -1))
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      // pytest exits 0 (all pass), 1 (some fail), 2 (error), 5 (no tests collected)
      if (code !== null && code > 1 && code !== 5) {
        reject(
          new TestRunnerError(
            `pytest exited with code ${code}. stderr: ${stderr.slice(0, 500)}`,
            code,
          ),
        )
        return
      }
      resolve(stdout + '\n' + stderr)
    })
  })
}

/**
 * Parse pytest -v output into TestResult[].
 *
 * Looks for lines matching:
 *   ::test_{N}_{name} PASSED
 *   ::test_{N}_{name} FAILED
 */
function mapPytestResults(
  output: string,
  generatedFile: GeneratedTestFile,
  startTime: number,
): TestResult[] {
  const results: TestResult[] = []
  const lines = output.split('\n')

  // Parse results: map index → pass/fail
  const resultByIndex = new Map<number, { passed: boolean; error?: string }>()

  // Collect failure details from short traceback blocks
  const failureDetails = new Map<number, string>()
  let inFailure = false
  let currentFailIdx = -1
  let failureLines: string[] = []

  for (const line of lines) {
    const stripped = line.replace(/\x1B\[[0-9;]*m/g, '') // strip ANSI

    // Detect test result lines: "::test_0_description PASSED" or "FAILED"
    const resultMatch = /::test_(\d+)_\S+\s+(PASSED|FAILED)/.exec(stripped)
    if (resultMatch != null) {
      const idx = parseInt(resultMatch[1] ?? '0', 10)
      const passed = resultMatch[2] === 'PASSED'
      resultByIndex.set(idx, { passed })
      if (!passed) {
        currentFailIdx = idx
        inFailure = false
        failureLines = []
      }
      continue
    }

    // Collect failure details from FAILED lines in summary
    const summaryMatch = /FAILED\s+\S+::test_(\d+)_\S+\s+-\s+(.+)/.exec(stripped)
    if (summaryMatch != null) {
      const idx = parseInt(summaryMatch[1] ?? '0', 10)
      failureDetails.set(idx, (summaryMatch[2] ?? '').trim())
    }
  }

  // Map back to TestCase[]
  const regularCases = generatedFile.testCases.filter((tc) => tc.category !== 'before-each')

  for (let idx = 0; idx < regularCases.length; idx++) {
    const tc = regularCases[idx]
    if (tc === undefined) continue

    const result = resultByIndex.get(idx)
    if (result !== undefined) {
      const testResult: TestResult = {
        testCase: tc,
        target: generatedFile.target,
        passed: result.passed,
        duration: Date.now() - startTime,
      }
      const detail = failureDetails.get(idx)
      if (!result.passed && detail != null) {
        testResult.error = detail
      }
      results.push(testResult)
    } else {
      // pytest didn't report this test — synthesize a failed result
      results.push({
        testCase: tc,
        target: generatedFile.target,
        passed: false,
        duration: Date.now() - startTime,
        error: 'pytest did not report a result for this test',
      })
    }
  }

  // Fallback: if pytest reported no results at all (import error, syntax error)
  if (resultByIndex.size === 0 && regularCases.length > 0) {
    const errorLine = output
      .split('\n')
      .find((l) => l.includes('Error') || l.includes('error') || l.includes('FAILED'))
    for (const tc of regularCases) {
      results.push({
        testCase: tc,
        target: generatedFile.target,
        passed: false,
        duration: Date.now() - startTime,
        error: errorLine?.trim() ?? 'pytest produced no test results',
      })
    }
  }

  return results
}

/**
 * Find the Python binary. Checks for a virtualenv in the cwd first,
 * then falls back to system python3/python.
 */
function findPythonBin(cwd: string): string {
  // Check for virtual environment
  const venvPaths = [
    path.join(cwd, '.venv', 'bin', 'python'),
    path.join(cwd, 'venv', 'bin', 'python'),
    path.join(cwd, 'env', 'bin', 'python'),
  ]
  for (const p of venvPaths) {
    if (existsSync(p)) return p
  }
  // Fall back to system python3
  return 'python3'
}

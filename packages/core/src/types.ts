/**
 * types.ts — All shared interfaces and types for CodeCheck.
 * Every other module imports from here. Write this first.
 */

// ─── Test Types ──────────────────────────────────────────────────────────────

export type TestType =
  | 'unit'
  | 'smoke'
  | 'functional'
  | 'sanity'
  | 'integration'
  | 'e2e'
  | 'api'
  | 'snapshot'
  | 'regression'

export type Language = 'typescript' | 'javascript' | 'python'

export type Framework = 'jest' | 'vitest' | 'pytest' | 'mocha'

export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama'

// ─── Configuration ───────────────────────────────────────────────────────────

export interface CodeCheckConfig {
  trigger: 'oncommit' | 'onsave' | 'onpush' | 'ci' | 'watch'
  testTypes: TestType[]
  output: string[]
  model: string
  provider: LLMProvider
  language: Language
  framework: Framework
  threshold: number
  exclude: string[]
  concurrency: number
  failOnError: boolean
  keepGeneratedTests: boolean
  cacheTtlDays: number
}

// ─── Code Extraction ─────────────────────────────────────────────────────────

export type TargetType = 'function' | 'class' | 'method' | 'endpoint'

export interface TestTarget {
  /** Absolute path to the source file */
  filePath: string
  /** Name of the function, class, or endpoint */
  name: string
  /** Full source code of the extracted target */
  code: string
  /** Source language */
  language: Language
  /** What kind of code element this is */
  targetType: TargetType
  /** Line number where the target starts (1-based) */
  startLine: number
  /** Line number where the target ends (1-based) */
  endLine: number
  /** Parameter names and types, if available */
  params?: Array<{ name: string; type?: string }>
  /** Return type, if available */
  returnType?: string
  /** Whether the function is async */
  isAsync?: boolean
}

// ─── Test Cases ──────────────────────────────────────────────────────────────

export interface TestCase {
  /** Human-readable description of what this test checks */
  description: string
  /** Input value(s) to pass to the function */
  input: unknown
  /** Expected output or behavior */
  expectedOutput: unknown
  /** Category of test case (e.g. "happy-path", "edge-case", "null-check") */
  category: string
  /** The type of test this is */
  testType: TestType
  /** Whether we expect the function to throw */
  shouldThrow?: boolean
  /** Expected error message if shouldThrow is true */
  expectedError?: string
}

// ─── Test Results ────────────────────────────────────────────────────────────

export interface TestResult {
  /** The test case that was executed */
  testCase: TestCase
  /** The code target that was tested */
  target: TestTarget
  /** Whether the test passed */
  passed: boolean
  /** Error message if the test failed */
  error?: string
  /** Execution time in milliseconds */
  duration: number
  /** Whether this result came from the LLM cache */
  fromCache?: boolean
}

// ─── Generated Test Files ────────────────────────────────────────────────────

export interface GeneratedTestFile {
  /** Absolute path where the test file was (or will be) written */
  filePath: string
  /** The full test file content as a string */
  content: string
  /** The test framework this file targets */
  framework: Framework
  /** The target this file tests */
  target: TestTarget
  /** The test cases embedded in this file (used by runner to map results back) */
  testCases: TestCase[]
}

// ─── Plugin Interfaces ───────────────────────────────────────────────────────

export interface ScopePlugin {
  /** Unique name for this plugin (e.g. "unit", "smoke") */
  name: TestType
  /** Which test types this plugin produces */
  testTypes: TestType[]
  /**
   * Filter and extract testable targets from the given file paths.
   * Returns the targets this plugin knows how to test.
   */
  extractTargets(files: string[], config: CodeCheckConfig): Promise<TestTarget[]>
  /**
   * Build the user-turn prompt suffix for this test type.
   * The core engine prepends the system prompt; this adds the scope-specific instructions.
   */
  buildPrompt(target: TestTarget, testType: TestType): string
}

export interface TriggerPlugin {
  /** Unique name for this plugin (e.g. "oncommit", "onsave") */
  name: string
  /**
   * Register a handler to be called when the trigger fires.
   * The handler receives the list of changed files.
   */
  onTrigger(handler: (changedFiles: string[]) => Promise<void>): void
}

export interface OutputPlugin {
  /** Unique name for this plugin (e.g. "terminal", "github") */
  name: string
  /**
   * Receive test results and render them to the configured output.
   */
  report(results: TestResult[], config: CodeCheckConfig): Promise<void>
}

// ─── LLM Interfaces ──────────────────────────────────────────────────────────

export interface LLMClient {
  generateTestCases(
    target: TestTarget,
    testTypes: TestType[],
    promptSuffix: string,
    config: CodeCheckConfig
  ): Promise<TestCase[]>
}

export interface CacheEntry {
  testCases: TestCase[]
  generatedAt: string
  model: string
}

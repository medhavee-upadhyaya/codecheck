/**
 * @codecheck/core — Public API
 *
 * Re-exports all public types, interfaces, errors, and the engine.
 * This file grows as each module is built.
 */

// Types
export type {
  TestType,
  Language,
  Framework,
  LLMProvider,
  TargetType,
  CodeCheckConfig,
  TestTarget,
  TestCase,
  TestResult,
  GeneratedTestFile,
  ScopePlugin,
  TriggerPlugin,
  OutputPlugin,
  LLMClient,
  CacheEntry,
} from './types.js'

// Errors
export {
  CodeCheckError,
  UnsupportedFileTypeError,
  LLMApiError,
  LLMParseError,
  TestRunnerError,
  ConfigError,
  ExtractionError,
} from './errors.js'

// Config
export { loadConfig, configDefaults } from './config.js'

// Extractors
export { extractTargets, extractTargetsFromCode } from './extractor/index.js'

// LLM
export { parseLLMResponse, LLMResponseSchema, TestCaseSchema } from './llm/schema.js'
export { buildSystemPrompt, buildUserPrompt } from './llm/prompts.js'
export { AnthropicLLMClient, MockLLMClient } from './llm/client.js'
export type { MockFixture } from './llm/client.js'

// Generator
export { generateTestFile } from './generator/index.js'
export { generateJestFile } from './generator/jest.js'
export { generatePytestFile } from './generator/pytest.js'

// Cache
export { computeCacheKey, getCached, setCached, clearCache, getCacheStats } from './cache/index.js'

// Runner
export { runTests } from './runner/index.js'

// Engine
export { CodeCheckEngine } from './engine.js'
export type { EngineOptions, RunnerFn } from './engine.js'

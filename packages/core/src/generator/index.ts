/**
 * generator/index.ts — Routes to the right test file generator based on language.
 */

import type { CodeCheckConfig, GeneratedTestFile, TestCase, TestTarget } from '../types.js'
import { generateJestFile } from './jest.js'
import { generatePytestFile } from './pytest.js'

/**
 * Generate a test file for the given target and test cases.
 * Routes to the right generator based on language and framework config.
 */
export function generateTestFile(
  target: TestTarget,
  testCases: TestCase[],
  config: CodeCheckConfig,
  cwd: string,
): GeneratedTestFile {
  if (target.language === 'python' || config.framework === 'pytest') {
    return generatePytestFile(target, testCases, cwd)
  }

  if (config.framework === 'vitest') {
    // Vitest uses the same file format as Jest (it's API-compatible)
    return generateJestFile(target, testCases, cwd)
  }

  // Default: Jest for TypeScript/JavaScript
  return generateJestFile(target, testCases, cwd)
}

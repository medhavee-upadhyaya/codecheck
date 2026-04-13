/**
 * generator/index.ts — Routes to the right test file generator based on language.
 */

import type { CodeCheckConfig, GeneratedTestFile, TestCase, TestTarget } from '../types.js'
import { generateJestFile } from './jest.js'

/**
 * Generate a test file for the given target and test cases.
 * Routes to Jest (TypeScript) or Pytest (Python) based on the config.
 */
export function generateTestFile(
  target: TestTarget,
  testCases: TestCase[],
  config: CodeCheckConfig,
  cwd: string
): GeneratedTestFile {
  if (target.language === 'python') {
    // Pytest generator is Phase 2 — stub for now
    throw new Error('Python test generation is coming in Phase 2. Set language to "typescript".')
  }

  // Default: Jest for TypeScript/JavaScript
  return generateJestFile(target, testCases, cwd)
}

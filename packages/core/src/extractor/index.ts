/**
 * extractor/index.ts — Routes files to the correct extractor by extension.
 */

import path from 'node:path'
import fs from 'node:fs/promises'
import { UnsupportedFileTypeError } from '../errors.js'
import type { TestTarget } from '../types.js'
import { extractFromTypeScript } from './typescript.js'
import { extractFromPython } from './python.js'

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const PY_EXTENSIONS = new Set(['.py'])

/**
 * Read a file and extract all testable targets from it.
 * Routes to the correct language extractor based on file extension.
 *
 * @throws {UnsupportedFileTypeError} if the file extension is not supported
 */
export async function extractTargets(filePath: string): Promise<TestTarget[]> {
  const ext = path.extname(filePath).toLowerCase()

  if (TS_EXTENSIONS.has(ext)) {
    const code = await fs.readFile(filePath, 'utf-8')
    return extractFromTypeScript(code, filePath)
  }

  if (PY_EXTENSIONS.has(ext)) {
    const code = await fs.readFile(filePath, 'utf-8')
    return extractFromPython(code, filePath)
  }

  throw new UnsupportedFileTypeError(filePath, ext)
}

/**
 * Extract targets from source code directly (without reading from disk).
 * Useful for testing and for in-memory processing.
 */
export function extractTargetsFromCode(
  code: string,
  filePath: string
): TestTarget[] {
  const ext = path.extname(filePath).toLowerCase()

  if (TS_EXTENSIONS.has(ext)) {
    return extractFromTypeScript(code, filePath)
  }

  if (PY_EXTENSIONS.has(ext)) {
    return extractFromPython(code, filePath)
  }

  throw new UnsupportedFileTypeError(filePath, ext)
}

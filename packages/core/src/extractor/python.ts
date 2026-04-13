/**
 * extractor/python.ts — Regex + indentation-based function/class extractor for Python.
 *
 * No Python AST is available in Node.js, so we use regex to find function/class
 * definitions and track indentation to capture the full body.
 *
 * Handles:
 *   def foo(x: int, y: str = "default") -> bool:
 *   async def fetch_user(user_id: str) -> dict:
 *   class Calculator:
 *
 * Limitation: multiline function signatures are not fully supported in MVP.
 */

import type { TestTarget } from '../types.js'

// Matches the start of a top-level function or class definition.
// Groups: [1] async?, [2] def|class, [3] name, [4] params (for def), [5] return type (for def)
const DEF_PATTERN = /^(async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/
const CLASS_PATTERN = /^class\s+([A-Za-z_][A-Za-z0-9_]*)/

// ─── Public Entry Point ───────────────────────────────────────────────────────

export function extractFromPython(code: string, filePath: string): TestTarget[] {
  const lines = code.split('\n')
  const targets: TestTarget[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line === undefined) break

    const trimmed = line.trimStart()
    const indent = line.length - trimmed.length

    // Only process top-level or class-level definitions (indent 0 or 4)
    if (indent > 4) {
      i++
      continue
    }

    const defMatch = DEF_PATTERN.exec(trimmed)
    if (defMatch != null) {
      const isAsync = defMatch[1] != null
      const name = defMatch[2] ?? ''
      const rawParams = defMatch[3] ?? ''
      const returnTypeRaw = defMatch[4]

      const bodyEnd = findBodyEnd(lines, i, indent)
      const bodyLines = lines.slice(i, bodyEnd)
      const bodyCode = bodyLines.join('\n')

      const params = parseParams(rawParams)

      const target: TestTarget = {
        filePath,
        name,
        code: bodyCode,
        language: 'python',
        targetType: 'function',
        startLine: i + 1,
        endLine: bodyEnd,
      }

      if (params.length > 0) target.params = params
      if (returnTypeRaw != null) target.returnType = returnTypeRaw.trim()
      if (isAsync) target.isAsync = true

      targets.push(target)
      i = bodyEnd
      continue
    }

    const classMatch = CLASS_PATTERN.exec(trimmed)
    if (classMatch != null && indent === 0) {
      const name = classMatch[1] ?? ''
      const bodyEnd = findBodyEnd(lines, i, indent)
      const bodyLines = lines.slice(i, bodyEnd)

      targets.push({
        filePath,
        name,
        code: bodyLines.join('\n'),
        language: 'python',
        targetType: 'class',
        startLine: i + 1,
        endLine: bodyEnd,
      })

      i = bodyEnd
      continue
    }

    i++
  }

  return targets
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the last line of a Python block starting at `startLine` with `baseIndent`.
 * Returns the exclusive end index (lines[startLine..endIndex]).
 */
function findBodyEnd(lines: string[], startLine: number, baseIndent: number): number {
  // Skip the definition line itself
  let end = startLine + 1

  while (end < lines.length) {
    const line = lines[end]
    if (line === undefined) break

    // Blank lines and comment-only lines don't terminate a block
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      end++
      continue
    }

    const currentIndent = line.length - line.trimStart().length

    // When we return to base indent or less, the block is over
    if (currentIndent <= baseIndent) break

    end++
  }

  return end
}

/**
 * Parse a Python parameter string into name+type pairs.
 * Handles: positional, typed, defaults, *args, **kwargs.
 * Skips `self` and `cls`.
 */
function parseParams(rawParams: string): Array<{ name: string; type?: string }> {
  if (rawParams.trim() === '') return []

  const result: Array<{ name: string; type?: string }> = []

  // Split on commas, being careful not to split inside brackets
  const parts = splitParams(rawParams)

  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed === '' || trimmed === 'self' || trimmed === 'cls') continue

    // Strip default value: foo: int = 5 → foo: int
    const withoutDefault = trimmed.split('=')[0]?.trim() ?? trimmed

    // Check for type annotation: foo: int → name=foo, type=int
    const colonIdx = withoutDefault.indexOf(':')
    if (colonIdx !== -1) {
      const name = withoutDefault.slice(0, colonIdx).trim().replace(/^\*+/, '')
      const type = withoutDefault.slice(colonIdx + 1).trim()
      result.push(type !== '' ? { name, type } : { name })
    } else {
      const name = withoutDefault.replace(/^\*+/, '')
      if (name !== '') result.push({ name })
    }
  }

  return result
}

/** Split param string on commas, respecting brackets for complex default values */
function splitParams(params: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''

  for (const ch of params) {
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--

    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }

  if (current.trim() !== '') parts.push(current)
  return parts
}

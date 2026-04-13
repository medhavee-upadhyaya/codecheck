import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { generateJestFile } from '../generator/jest.js'
import type { TestCase, TestTarget } from '../types.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CWD = '/project'

const syncTarget: TestTarget = {
  filePath: '/project/src/math.ts',
  name: 'add',
  code: 'export function add(a: number, b: number): number { return a + b }',
  language: 'typescript',
  targetType: 'function',
  startLine: 1,
  endLine: 1,
  params: [{ name: 'a', type: 'number' }, { name: 'b', type: 'number' }],
  returnType: 'number',
}

const asyncTarget: TestTarget = {
  filePath: '/project/src/api.ts',
  name: 'fetchUser',
  code: 'export async function fetchUser(id: string): Promise<{name:string}> { return {name:"test"} }',
  language: 'typescript',
  targetType: 'function',
  startLine: 1,
  endLine: 1,
  params: [{ name: 'id', type: 'string' }],
  returnType: 'Promise<{name:string}>',
  isAsync: true,
}

const noParamTarget: TestTarget = {
  filePath: '/project/src/utils.ts',
  name: 'getVersion',
  code: 'export function getVersion(): string { return "1.0.0" }',
  language: 'typescript',
  targetType: 'function',
  startLine: 1,
  endLine: 1,
  params: [],
  returnType: 'string',
}

const happyCase: TestCase = {
  description: 'adds two positive numbers',
  input: [1, 2],
  expectedOutput: 3,
  category: 'happy-path',
  testType: 'unit',
  shouldThrow: false,
}

const throwCase: TestCase = {
  description: 'throws on division by zero',
  input: [10, 0],
  expectedOutput: null,
  category: 'error-handling',
  testType: 'unit',
  shouldThrow: true,
  expectedError: 'Division by zero',
}

const nullInputCase: TestCase = {
  description: 'returns version string',
  input: null,
  expectedOutput: '1.0.0',
  category: 'happy-path',
  testType: 'smoke',
  shouldThrow: false,
}

// ─── File Path ────────────────────────────────────────────────────────────────

describe('generateJestFile — file path', () => {
  it('places test file in .codecheck-tmp/', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(file.filePath).toContain('.codecheck-tmp')
  })

  it('uses function name in filename', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(path.basename(file.filePath)).toContain('add')
  })

  it('produces .test.ts extension', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(file.filePath).toMatch(/\.test\.ts$/)
  })

  it('sets framework to jest', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(file.framework).toBe('jest')
  })

  it('attaches target to the file', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(file.target).toBe(syncTarget)
  })

  it('attaches testCases to the file', () => {
    const file = generateJestFile(syncTarget, [happyCase, throwCase], CWD)
    expect(file.testCases).toHaveLength(2)
  })
})

// ─── File Content — Imports ───────────────────────────────────────────────────

describe('generateJestFile — import statement', () => {
  it('imports the function by name', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(file.content).toContain("import { add } from")
  })

  it('uses a relative path from .codecheck-tmp to source', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    // source: /project/src/math.ts → temp: /project/.codecheck-tmp/
    // relative path: ../src/math
    expect(file.content).toContain('../src/math')
  })

  it('strips the .ts extension from the import path', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(file.content).not.toMatch(/from '.*\.ts'/)
  })
})

// ─── File Content — describe/it structure ────────────────────────────────────

describe('generateJestFile — describe/it structure', () => {
  it('wraps tests in a describe block named after the function', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(file.content).toContain("describe('add'")
  })

  it('generates an it() block for each test case', () => {
    const file = generateJestFile(syncTarget, [happyCase, throwCase], CWD)
    expect(file.content).toContain("it('adds two positive numbers'")
    expect(file.content).toContain("it('throws on division by zero'")
  })

  it('uses the test case description as the it() label', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(file.content).toContain("it('adds two positive numbers'")
  })
})

// ─── File Content — Assertions ────────────────────────────────────────────────

describe('generateJestFile — assertions', () => {
  it('generates toEqual assertion for normal tests', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(file.content).toContain('toEqual(3)')
  })

  it('spreads array inputs for multi-param functions', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    // input [1, 2] with 2 params → add(1, 2)
    expect(file.content).toContain('add(1, 2)')
  })

  it('generates toThrow assertion for shouldThrow cases', () => {
    const file = generateJestFile(syncTarget, [throwCase], CWD)
    expect(file.content).toContain('.toThrow(')
  })

  it('includes the expected error message in toThrow()', () => {
    const file = generateJestFile(syncTarget, [throwCase], CWD)
    expect(file.content).toContain("'Division by zero'")
  })

  it('wraps throw assertion in arrow function for sync functions', () => {
    const file = generateJestFile(syncTarget, [throwCase], CWD)
    expect(file.content).toContain('expect(() =>')
  })

  it('handles null input as no-arg call', () => {
    const file = generateJestFile(noParamTarget, [nullInputCase], CWD)
    expect(file.content).toContain('getVersion()')
    expect(file.content).not.toContain('getVersion(null)')
  })
})

// ─── Async Functions ──────────────────────────────────────────────────────────

describe('generateJestFile — async functions', () => {
  const asyncCase: TestCase = {
    description: 'fetches user data',
    input: '123',
    expectedOutput: { name: 'Alice' },
    category: 'happy-path',
    testType: 'unit',
    shouldThrow: false,
  }

  it('marks the it() callback as async', () => {
    const file = generateJestFile(asyncTarget, [asyncCase], CWD)
    expect(file.content).toContain('async ()')
  })

  it('uses resolves.toEqual for async assertions', () => {
    const file = generateJestFile(asyncTarget, [asyncCase], CWD)
    expect(file.content).toContain('resolves.toEqual')
  })

  it('uses rejects.toThrow for async throw cases', () => {
    const asyncThrow: TestCase = {
      description: 'rejects on bad id',
      input: '',
      expectedOutput: null,
      category: 'error-handling',
      testType: 'unit',
      shouldThrow: true,
      expectedError: 'Not found',
    }
    const file = generateJestFile(asyncTarget, [asyncThrow], CWD)
    expect(file.content).toContain('rejects.toThrow')
  })

  it('uses await prefix on the assertion', () => {
    const file = generateJestFile(asyncTarget, [asyncCase], CWD)
    expect(file.content).toContain('await expect')
  })
})

// ─── Generated content is syntactically plausible ────────────────────────────

describe('generateJestFile — content sanity', () => {
  it('includes the CodeCheck header comment', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    expect(file.content).toContain('@ts-nocheck')
  })

  it('closes the describe block', () => {
    const file = generateJestFile(syncTarget, [happyCase], CWD)
    // File should end with }) closing the describe arrow function
    expect(file.content.trim()).toMatch(/\}\)\s*$/)
  })

  it('generates different file paths for different test cases', () => {
    const file1 = generateJestFile(syncTarget, [happyCase], CWD)
    const file2 = generateJestFile(syncTarget, [throwCase], CWD)
    // Different test cases → different hash → different filename
    expect(file1.filePath).not.toBe(file2.filePath)
  })
})

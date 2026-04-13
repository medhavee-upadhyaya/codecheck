import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extractTargetsFromCode } from '../extractor/index.js'
import { extractFromTypeScript } from '../extractor/typescript.js'
import { extractFromPython } from '../extractor/python.js'
import { UnsupportedFileTypeError } from '../errors.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, 'fixtures')
const sampleTsPath = path.join(fixturesDir, 'sample.ts')
const samplePyPath = path.join(fixturesDir, 'sample.py')

// ─── TypeScript Extractor ─────────────────────────────────────────────────────

describe('TypeScript extractor', () => {
  const TS_CODE = `
export function add(a: number, b: number): number {
  return a + b
}

export const multiply = (a: number, b: number): number => a * b

export async function fetchData(url: string): Promise<string> {
  return url
}

export class Calculator {
  add(a: number, b: number): number { return a + b }
}

// NOT exported — should be skipped
function internal(): void {}
const privateArrow = () => {}
void internal
void privateArrow
`

  it('extracts exported function declarations', () => {
    const targets = extractFromTypeScript(TS_CODE, 'test.ts')
    const names = targets.map((t) => t.name)
    expect(names).toContain('add')
    expect(names).toContain('fetchData')
  })

  it('extracts exported arrow functions', () => {
    const targets = extractFromTypeScript(TS_CODE, 'test.ts')
    const names = targets.map((t) => t.name)
    expect(names).toContain('multiply')
  })

  it('extracts exported classes', () => {
    const targets = extractFromTypeScript(TS_CODE, 'test.ts')
    const calc = targets.find((t) => t.name === 'Calculator')
    expect(calc).toBeDefined()
    expect(calc?.targetType).toBe('class')
  })

  it('does NOT extract non-exported functions', () => {
    const targets = extractFromTypeScript(TS_CODE, 'test.ts')
    const names = targets.map((t) => t.name)
    expect(names).not.toContain('internal')
    expect(names).not.toContain('privateArrow')
  })

  it('captures parameter names and types', () => {
    const targets = extractFromTypeScript(TS_CODE, 'test.ts')
    const addFn = targets.find((t) => t.name === 'add')
    expect(addFn).toBeDefined()
    expect(addFn?.params).toBeDefined()
    expect(addFn?.params?.length).toBe(2)
    expect(addFn?.params?.[0]?.name).toBe('a')
    expect(addFn?.params?.[0]?.type).toBe('number')
  })

  it('captures return type', () => {
    const targets = extractFromTypeScript(TS_CODE, 'test.ts')
    const addFn = targets.find((t) => t.name === 'add')
    expect(addFn?.returnType).toBe('number')
  })

  it('marks async functions', () => {
    const targets = extractFromTypeScript(TS_CODE, 'test.ts')
    const fetchFn = targets.find((t) => t.name === 'fetchData')
    expect(fetchFn?.isAsync).toBe(true)
  })

  it('sync functions are not marked async', () => {
    const targets = extractFromTypeScript(TS_CODE, 'test.ts')
    const addFn = targets.find((t) => t.name === 'add')
    expect(addFn?.isAsync).toBeUndefined()
  })

  it('includes correct file path', () => {
    const targets = extractFromTypeScript(TS_CODE, '/project/src/math.ts')
    expect(targets[0]?.filePath).toBe('/project/src/math.ts')
  })

  it('includes code snippet in each target', () => {
    const targets = extractFromTypeScript(TS_CODE, 'test.ts')
    const addFn = targets.find((t) => t.name === 'add')
    expect(addFn?.code).toContain('return a + b')
  })

  it('records correct start/end lines', () => {
    const targets = extractFromTypeScript(TS_CODE, 'test.ts')
    const addFn = targets.find((t) => t.name === 'add')
    expect(addFn?.startLine).toBeGreaterThan(0)
    expect(addFn?.endLine).toBeGreaterThanOrEqual(addFn?.startLine ?? 0)
  })

  it('parses the sample.ts fixture file', async () => {
    const code = await fs.readFile(sampleTsPath, 'utf-8')
    const targets = extractFromTypeScript(code, sampleTsPath)

    expect(targets.length).toBeGreaterThanOrEqual(5)
    const names = targets.map((t) => t.name)
    expect(names).toContain('add')
    expect(names).toContain('multiply')
    expect(names).toContain('fetchUser')
    expect(names).toContain('divide')
    expect(names).toContain('Calculator')
    // Non-exported functions must not appear
    expect(names).not.toContain('internalHelper')
    expect(names).not.toContain('privateArrow')
  })
})

// ─── Python Extractor ─────────────────────────────────────────────────────────

describe('Python extractor', () => {
  const PY_CODE = `
def add(a: int, b: int) -> int:
    return a + b


async def fetch_data(url: str) -> dict:
    return {}


def greet(name: str, greeting: str = "Hello") -> str:
    return f"{greeting}, {name}!"


def no_hints(x, y):
    return x + y


class Calculator:
    def __init__(self) -> None:
        self.value = 0

    def add(self, x: int) -> int:
        self.value += x
        return self.value
`

  it('extracts top-level function definitions', () => {
    const targets = extractFromPython(PY_CODE, 'test.py')
    const names = targets.map((t) => t.name)
    expect(names).toContain('add')
    expect(names).toContain('fetch_data')
    expect(names).toContain('greet')
    expect(names).toContain('no_hints')
  })

  it('extracts class definitions', () => {
    const targets = extractFromPython(PY_CODE, 'test.py')
    const calc = targets.find((t) => t.name === 'Calculator')
    expect(calc).toBeDefined()
    expect(calc?.targetType).toBe('class')
  })

  it('marks async functions', () => {
    const targets = extractFromPython(PY_CODE, 'test.py')
    const fetchFn = targets.find((t) => t.name === 'fetch_data')
    expect(fetchFn?.isAsync).toBe(true)
  })

  it('captures return types from type hints', () => {
    const targets = extractFromPython(PY_CODE, 'test.py')
    const addFn = targets.find((t) => t.name === 'add')
    expect(addFn?.returnType).toBe('int')
  })

  it('captures parameter names and types', () => {
    const targets = extractFromPython(PY_CODE, 'test.py')
    const addFn = targets.find((t) => t.name === 'add')
    expect(addFn?.params).toBeDefined()
    expect(addFn?.params?.length).toBe(2)
    expect(addFn?.params?.[0]?.name).toBe('a')
    expect(addFn?.params?.[0]?.type).toBe('int')
  })

  it('handles functions without type hints', () => {
    const targets = extractFromPython(PY_CODE, 'test.py')
    const noHints = targets.find((t) => t.name === 'no_hints')
    expect(noHints).toBeDefined()
    expect(noHints?.params?.length).toBe(2)
    expect(noHints?.returnType).toBeUndefined()
  })

  it('includes code snippet in each target', () => {
    const targets = extractFromPython(PY_CODE, 'test.py')
    const addFn = targets.find((t) => t.name === 'add')
    expect(addFn?.code).toContain('return a + b')
  })

  it('parses the sample.py fixture file', async () => {
    const code = await fs.readFile(samplePyPath, 'utf-8')
    const targets = extractFromPython(code, samplePyPath)

    expect(targets.length).toBeGreaterThanOrEqual(5)
    const names = targets.map((t) => t.name)
    expect(names).toContain('add')
    expect(names).toContain('fetch_user')
    expect(names).toContain('greet')
    expect(names).toContain('divide')
    expect(names).toContain('Calculator')
  })
})

// ─── Router (index.ts) ────────────────────────────────────────────────────────

describe('extractTargetsFromCode router', () => {
  it('routes .ts files to the TypeScript extractor', () => {
    const targets = extractTargetsFromCode(
      'export function foo(): void {}',
      '/project/foo.ts'
    )
    expect(targets[0]?.language).toBe('typescript')
  })

  it('routes .py files to the Python extractor', () => {
    const targets = extractTargetsFromCode(
      'def foo() -> None:\n    pass\n',
      '/project/foo.py'
    )
    expect(targets[0]?.language).toBe('python')
  })

  it('throws UnsupportedFileTypeError for unknown extensions', () => {
    expect(() =>
      extractTargetsFromCode('some content', '/project/foo.rb')
    ).toThrowError(UnsupportedFileTypeError)
  })

  it('routes .tsx files to the TypeScript extractor', () => {
    const targets = extractTargetsFromCode(
      'export function Button(): JSX.Element { return null as unknown as JSX.Element }',
      '/project/Button.tsx'
    )
    expect(targets[0]?.language).toBe('typescript')
  })
})

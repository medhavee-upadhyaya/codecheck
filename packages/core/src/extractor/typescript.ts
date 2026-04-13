/**
 * extractor/typescript.ts — AST-based function/class extractor for TypeScript and JavaScript.
 *
 * Uses @typescript-eslint/typescript-estree to parse source code and extract
 * exported functions and classes as TestTarget objects.
 *
 * Handles:
 *   export function foo() {}
 *   export const foo = () => {}
 *   export const foo = function() {}
 *   export class Foo {}
 *   export async function foo() {}
 */

import { parse } from '@typescript-eslint/typescript-estree'
import type { TSESTree } from '@typescript-eslint/typescript-estree'
import { ExtractionError } from '../errors.js'
import type { TestTarget } from '../types.js'

// ─── Public Entry Point ───────────────────────────────────────────────────────

export function extractFromTypeScript(code: string, filePath: string): TestTarget[] {
  let ast: TSESTree.Program

  try {
    ast = parse(code, {
      loc: true,
      range: true,
      jsx: filePath.endsWith('.tsx') || filePath.endsWith('.jsx'),
      tokens: false,
      comment: false,
    })
  } catch (err) {
    throw new ExtractionError(filePath, err instanceof Error ? err.message : String(err))
  }

  const targets: TestTarget[] = []

  for (const statement of ast.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue
    const decl = statement.declaration
    if (decl == null) continue

    if (decl.type === 'FunctionDeclaration' && decl.id != null) {
      // export function foo() {}
      targets.push(buildFunctionTarget(decl, code, filePath, decl.id.name))
    } else if (decl.type === 'VariableDeclaration') {
      // export const foo = () => {}   OR   export const foo = function() {}
      for (const declarator of decl.declarations) {
        if (declarator.id.type !== 'Identifier') continue
        const init = declarator.init
        if (init == null) continue
        if (init.type !== 'ArrowFunctionExpression' && init.type !== 'FunctionExpression') continue
        targets.push(buildFunctionTarget(init, code, filePath, declarator.id.name))
      }
    } else if (decl.type === 'ClassDeclaration' && decl.id != null) {
      // export class Foo {}
      targets.push(buildClassTarget(decl, code, filePath, decl.id.name))
    }
  }

  return targets
}

// ─── Builders ─────────────────────────────────────────────────────────────────

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionExpression

function buildFunctionTarget(
  node: FunctionNode,
  code: string,
  filePath: string,
  name: string
): TestTarget {
  const [rangeStart, rangeEnd] = node.range
  const functionCode = code.slice(rangeStart, rangeEnd)
  const params = node.params.map((p) => extractParam(p, code))

  const returnTypeNode = node.returnType?.typeAnnotation
  const returnType =
    returnTypeNode != null
      ? code.slice(...(returnTypeNode.range as [number, number]))
      : undefined

  const target: TestTarget = {
    filePath,
    name,
    code: functionCode,
    language: 'typescript',
    targetType: 'function',
    startLine: node.loc.start.line,
    endLine: node.loc.end.line,
  }

  if (params.length > 0) target.params = params
  if (returnType != null) target.returnType = returnType
  if (node.async) target.isAsync = true

  return target
}

function buildClassTarget(
  node: TSESTree.ClassDeclaration,
  code: string,
  filePath: string,
  name: string
): TestTarget {
  const [rangeStart, rangeEnd] = node.range
  return {
    filePath,
    name,
    code: code.slice(rangeStart, rangeEnd),
    language: 'typescript',
    targetType: 'class',
    startLine: node.loc.start.line,
    endLine: node.loc.end.line,
  }
}

// ─── Param Extraction ─────────────────────────────────────────────────────────

function extractParam(
  param: TSESTree.Parameter,
  code: string
): { name: string; type?: string } {
  switch (param.type) {
    case 'Identifier': {
      const typeNode = param.typeAnnotation?.typeAnnotation
      const type =
        typeNode != null ? code.slice(...(typeNode.range as [number, number])) : undefined
      return type != null ? { name: param.name, type } : { name: param.name }
    }

    case 'AssignmentPattern': {
      // foo = defaultValue (parameter with default)
      if (param.left.type === 'Identifier') {
        return { name: param.left.name }
      }
      const [s, e] = param.range
      return { name: code.slice(s, e) }
    }

    case 'RestElement': {
      if (param.argument.type === 'Identifier') {
        return { name: `...${param.argument.name}` }
      }
      const [s, e] = param.range
      return { name: code.slice(s, e) }
    }

    default: {
      // ObjectPattern, ArrayPattern, TSParameterProperty
      const [s, e] = param.range
      return { name: code.slice(s, e) }
    }
  }
}

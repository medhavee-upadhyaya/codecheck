/**
 * sample.ts — TypeScript fixture file for extractor tests.
 * This file contains various exported function patterns that the TS extractor must handle.
 */

// 1. Standard exported function declaration
export function add(a: number, b: number): number {
  return a + b
}

// 2. Exported async function
export async function fetchUser(id: string): Promise<{ name: string; email: string }> {
  // In a real implementation this would call an API
  return { name: 'Alice', email: 'alice@example.com' }
}

// 3. Exported arrow function (const)
export const multiply = (a: number, b: number): number => a * b

// 4. Exported arrow function (async)
export const delay = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

// 5. Exported function with optional param and default
export function greet(name: string, greeting = 'Hello'): string {
  return `${greeting}, ${name}!`
}

// 6. Exported function that throws
export function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero')
  return a / b
}

// 7. Exported class
export class Calculator {
  private history: number[] = []

  add(a: number, b: number): number {
    const result = a + b
    this.history.push(result)
    return result
  }

  getHistory(): number[] {
    return [...this.history]
  }
}

// NOT exported — should NOT be extracted
function internalHelper(x: number): number {
  return x * 2
}

// NOT exported — should NOT be extracted
const privateArrow = (s: string) => s.toLowerCase()

// Suppress unused variable warnings
void internalHelper
void privateArrow

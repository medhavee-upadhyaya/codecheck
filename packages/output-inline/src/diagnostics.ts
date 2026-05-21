/**
 * diagnostics.ts — Pure result-parsing logic (no vscode dependency).
 *
 * Converts CodeCheck latest.json into a list of DiagnosticRecord objects
 * that the extension.ts layer maps to vscode.Diagnostic instances.
 *
 * Keeping this file free of the vscode module allows unit testing with vitest.
 */

export interface DiagnosticRecord {
  filePath: string
  functionName: string
  message: string
  line: number
  endLine: number
}

export interface LatestRunShape {
  results: Array<{
    filePath: string
    targetName: string
    description: string
    passed: boolean
    error?: string | null
    startLine?: number
    endLine?: number
  }>
}

/**
 * Parse the contents of .codecheck-results/latest.json and return one
 * DiagnosticRecord per failing test, deduplicated by (file, function).
 */
export function parseDiagnostics(raw: string): DiagnosticRecord[] {
  let data: LatestRunShape
  try {
    data = JSON.parse(raw) as LatestRunShape
  } catch {
    return []
  }

  if (!Array.isArray(data?.results)) return []

  // One diagnostic per failing function (not per test case) to avoid noise
  const seen = new Set<string>()
  const records: DiagnosticRecord[] = []

  for (const r of data.results) {
    if (r.passed) continue

    const key = `${r.filePath}::${r.targetName}`
    if (seen.has(key)) continue
    seen.add(key)

    const failedInFile = data.results.filter(
      (x) => !x.passed && x.filePath === r.filePath && x.targetName === r.targetName,
    )

    const messages = failedInFile
      .map((x) => `• ${x.description}${x.error ? `: ${x.error.split('\n')[0]}` : ''}`)
      .join('\n')

    records.push({
      filePath: r.filePath,
      functionName: r.targetName,
      message: `CodeCheck: ${failedInFile.length} test(s) failed for \`${r.targetName}\`\n${messages}`,
      line: Math.max(0, (r.startLine ?? 1) - 1),
      endLine: Math.max(0, (r.endLine ?? r.startLine ?? 1) - 1),
    })
  }

  return records
}

/** Group DiagnosticRecords by file path. */
export function groupByFile(records: DiagnosticRecord[]): Map<string, DiagnosticRecord[]> {
  const map = new Map<string, DiagnosticRecord[]>()
  for (const r of records) {
    const existing = map.get(r.filePath)
    if (existing) {
      existing.push(r)
    } else {
      map.set(r.filePath, [r])
    }
  }
  return map
}

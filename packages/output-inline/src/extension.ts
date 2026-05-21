/**
 * extension.ts — VS Code extension entry point.
 *
 * Reads .codecheck-results/latest.json whenever it changes and shows
 * inline red-underline diagnostics on functions whose tests failed.
 *
 * How to install:
 *   npm install -g @vscode/vsce
 *   vsce package            # produces a .vsix file
 *   code --install-extension codecheck-output-inline-0.1.0.vsix
 *
 * Publishing to VS Code Marketplace:
 *   vsce publish            # requires a Personal Access Token in VSCE_PAT
 */

// vscode is only available at runtime inside VS Code — it is excluded from
// the build bundle via --external vscode in tsup config.
import type * as vscodeTypes from 'vscode'
import { parseDiagnostics, groupByFile } from './diagnostics.js'
import fs from 'node:fs/promises'
import path from 'node:path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscode: typeof vscodeTypes = require('vscode')

let diagnosticCollection: vscodeTypes.DiagnosticCollection | null = null
let watcher: vscodeTypes.FileSystemWatcher | null = null

export function activate(context: vscodeTypes.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('codecheck')
  context.subscriptions.push(diagnosticCollection)

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!workspaceRoot) return

  const resultsFile = path.join(workspaceRoot, '.codecheck-results', 'latest.json')

  // Watch for changes to latest.json
  const pattern = new vscode.RelativePattern(workspaceRoot, '.codecheck-results/latest.json')
  watcher = vscode.workspace.createFileSystemWatcher(pattern)
  context.subscriptions.push(watcher)

  watcher.onDidChange(() => void refreshDiagnostics(resultsFile))
  watcher.onDidCreate(() => void refreshDiagnostics(resultsFile))
  watcher.onDidDelete(() => diagnosticCollection?.clear())

  // Load on activation (results may already exist)
  void refreshDiagnostics(resultsFile)

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codecheck.refresh', () =>
      void refreshDiagnostics(resultsFile),
    ),
    vscode.commands.registerCommand('codecheck.clear', () => diagnosticCollection?.clear()),
  )
}

export function deactivate(): void {
  diagnosticCollection?.dispose()
  watcher?.dispose()
}

// ─── Core update logic ────────────────────────────────────────────────────────

async function refreshDiagnostics(filePath: string): Promise<void> {
  if (!diagnosticCollection) return

  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch {
    // File doesn't exist yet — clear and wait
    diagnosticCollection.clear()
    return
  }

  const records = parseDiagnostics(raw)
  const byFile = groupByFile(records)

  diagnosticCollection.clear()

  for (const [absPath, fileRecords] of byFile) {
    const uri = vscode.Uri.file(absPath)
    const diagnostics = fileRecords.map((r) => {
      const range = new vscode.Range(r.line, 0, r.endLine, Number.MAX_SAFE_INTEGER)
      const diag = new vscode.Diagnostic(range, r.message, vscode.DiagnosticSeverity.Warning)
      diag.source = 'CodeCheck'
      diag.code = 'test-failure'
      return diag
    })
    diagnosticCollection.set(uri, diagnostics)
  }
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {
  loadConfig,
  CodeCheckEngine,
  createLLMClient,
  humanizeError,
  configDefaults,
} from '@codecheck/core'
import type { ScopePlugin, TestResult, TestType, CodeCheckConfig } from '@codecheck/core'
import { UnitScopePlugin } from '@codecheck/scope-unit'
import { SmokeScopePlugin } from '@codecheck/scope-smoke'
import { FunctionalScopePlugin } from '@codecheck/scope-functional'
import { SanityScopePlugin } from '@codecheck/scope-sanity'
import { IntegrationScopePlugin } from '@codecheck/scope-integration'
import { ApiScopePlugin } from '@codecheck/scope-api'
import { E2EScopePlugin } from '@codecheck/scope-e2e'
import { SnapshotScopePlugin } from '@codecheck/scope-snapshot'
import { RegressionScopePlugin } from '@codecheck/scope-regression'
import { readFile, access } from 'node:fs/promises'
import { resolve, join } from 'node:path'

// ─── Scope Plugin Registry ────────────────────────────────────────────────────

const SCOPE_PLUGINS: Record<string, () => ScopePlugin> = {
  unit: () => new UnitScopePlugin(),
  smoke: () => new SmokeScopePlugin(),
  functional: () => new FunctionalScopePlugin(),
  sanity: () => new SanityScopePlugin(),
  integration: () => new IntegrationScopePlugin(),
  api: () => new ApiScopePlugin(),
  e2e: () => new E2EScopePlugin(),
  snapshot: () => new SnapshotScopePlugin(),
  regression: () => new RegressionScopePlugin(),
}

function buildScopePlugins(testTypes: TestType[]): ScopePlugin[] {
  const plugins = testTypes.flatMap((t) => {
    const factory = SCOPE_PLUGINS[t]
    return factory ? [factory()] : []
  })
  return plugins.length > 0 ? plugins : [new UnitScopePlugin(), new SmokeScopePlugin()]
}

// ─── Result Formatter ─────────────────────────────────────────────────────────

function formatResults(results: TestResult[]): string {
  if (results.length === 0) return 'No testable functions found in the specified files.'

  const passed = results.filter((r) => r.passed).length
  const failed = results.length - passed
  const passRate = Math.round((passed / results.length) * 100)

  const lines: string[] = [
    'CodeCheck Results',
    '─'.repeat(50),
    `${passed} passed · ${failed} failed · ${passRate}% pass rate`,
    '',
  ]

  const byFile = new Map<string, TestResult[]>()
  for (const r of results) {
    const key = r.target.filePath
    const group = byFile.get(key) ?? []
    group.push(r)
    byFile.set(key, group)
  }

  for (const [filePath, fileResults] of byFile) {
    lines.push(`  ${filePath}`)
    for (const r of fileResults) {
      const icon = r.passed ? '✓' : '✗'
      lines.push(`    ${icon} ${r.target.name} — ${r.testCase.testType} · ${r.testCase.category}  (${r.duration}ms)`)
      if (!r.passed && r.error != null) {
        lines.push(`      → ${humanizeError(r.error)}`)
        lines.push(`        ${r.error.split('\n')[0] ?? r.error}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Tool Handlers ────────────────────────────────────────────────────────────

async function handleRun(args: Record<string, unknown>, cwd: string): Promise<string> {
  const projectDir = resolve((args['projectDir'] as string | undefined) ?? cwd)
  const rawFiles = (args['files'] as string[] | undefined) ?? []

  if (rawFiles.length === 0) {
    return 'No files specified. Provide a "files" array with paths to source files.'
  }

  const files = rawFiles.map((f) => resolve(projectDir, f))

  const config = await loadConfig(projectDir)
  if (args['testTypes'] != null) {
    config.testTypes = args['testTypes'] as TestType[]
  }

  const providerKeyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
  }
  const requiredKey = providerKeyMap[config.provider] ?? 'ANTHROPIC_API_KEY'
  if (config.provider !== 'ollama' && process.env[requiredKey] == null) {
    return [
      `${requiredKey} is not set in the MCP server environment.`,
      '',
      'Add it to your Claude Code MCP server config in settings.json:',
      `  "env": { "${requiredKey}": "your-key-here" }`,
    ].join('\n')
  }

  const llmClient = createLLMClient(config)
  const scopePlugins = buildScopePlugins(config.testTypes)
  const engine = new CodeCheckEngine(config, scopePlugins, { cwd: projectDir, llmClient })

  const results = await engine.run(files)
  return formatResults(results)
}

async function handleResults(args: Record<string, unknown>, cwd: string): Promise<string> {
  const projectDir = resolve((args['projectDir'] as string | undefined) ?? cwd)
  const latestPath = join(projectDir, '.codecheck-results', 'latest.json')

  try {
    const raw = await readFile(latestPath, 'utf-8')
    const data = JSON.parse(raw) as TestResult[]
    return formatResults(data)
  } catch {
    return [
      'No CodeCheck results found.',
      `Expected: ${latestPath}`,
      '',
      'Run codecheck_run first to generate results.',
    ].join('\n')
  }
}

async function handleStatus(args: Record<string, unknown>, cwd: string): Promise<string> {
  const projectDir = resolve((args['projectDir'] as string | undefined) ?? cwd)
  const lines: string[] = ['CodeCheck Status', '─'.repeat(50)]

  let config: CodeCheckConfig
  try {
    config = await loadConfig(projectDir)
    lines.push('✓ Config found')
    lines.push(`  provider:    ${config.provider}`)
    lines.push(`  model:       ${config.model}`)
    lines.push(`  testTypes:   ${config.testTypes.join(', ')}`)
    lines.push(`  framework:   ${config.framework}`)
    lines.push(`  threshold:   ${config.threshold}`)
    lines.push(`  failOnError: ${config.failOnError}`)
  } catch {
    config = { ...configDefaults, trigger: 'oncommit', output: ['terminal'] } as CodeCheckConfig
    lines.push('✗ No codecheck config found')
    lines.push('  Run: npx codecheck-init')
  }

  lines.push('')

  const providerKeyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
  }
  const requiredKey = providerKeyMap[config.provider] ?? 'ANTHROPIC_API_KEY'

  if (config.provider === 'ollama') {
    const base = process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434/v1'
    lines.push(`✓ Ollama — no API key needed (${base})`)
  } else if (process.env[requiredKey] != null) {
    lines.push(`✓ ${requiredKey} is set`)
  } else {
    lines.push(`✗ ${requiredKey} not set — add it to the MCP server env in settings.json`)
  }

  lines.push('')

  const resultsDir = join(projectDir, '.codecheck-results')
  try {
    await access(resultsDir)
    try {
      await access(join(resultsDir, 'latest.json'))
      lines.push('✓ Previous results exist — call codecheck_results to view them')
    } catch {
      lines.push('✓ .codecheck-results/ exists (no runs yet)')
    }
  } catch {
    lines.push('○ No .codecheck-results/ yet — created on first run')
  }

  return lines.join('\n')
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: '@codecheck/mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'codecheck_run',
      description:
        'Run AI-generated tests on source files. Extracts functions, sends them to an LLM ' +
        '(Claude/OpenAI/Gemini/Ollama), generates test cases, runs them, and returns pass/fail results. ' +
        'Use this after editing code to verify correctness automatically.',
      inputSchema: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Source file paths to test (absolute or relative to projectDir)',
          },
          projectDir: {
            type: 'string',
            description: 'Project root. Defaults to the server working directory.',
          },
          testTypes: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['unit', 'smoke', 'functional', 'sanity', 'integration', 'api', 'e2e', 'snapshot', 'regression'],
            },
            description: 'Test types to generate. Defaults to the project config (usually unit + smoke).',
          },
        },
        required: ['files'],
      },
    },
    {
      name: 'codecheck_results',
      description: 'Get the latest CodeCheck test results for a project from the most recent run.',
      inputSchema: {
        type: 'object',
        properties: {
          projectDir: {
            type: 'string',
            description: 'Project root. Defaults to the server working directory.',
          },
        },
      },
    },
    {
      name: 'codecheck_status',
      description:
        'Check if CodeCheck is configured in a project. Shows provider, model, test types, ' +
        'API key status, and whether previous results exist.',
      inputSchema: {
        type: 'object',
        properties: {
          projectDir: {
            type: 'string',
            description: 'Project root. Defaults to the server working directory.',
          },
        },
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const cwd = process.cwd()
  const a = (args ?? {}) as Record<string, unknown>

  try {
    let text: string
    if (name === 'codecheck_run') text = await handleRun(a, cwd)
    else if (name === 'codecheck_results') text = await handleResults(a, cwd)
    else if (name === 'codecheck_status') text = await handleStatus(a, cwd)
    else text = `Unknown tool: ${name}`

    return { content: [{ type: 'text', text }] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text', text: `CodeCheck error: ${message}` }],
      isError: true,
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)

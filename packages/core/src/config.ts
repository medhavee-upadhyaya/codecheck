/**
 * config.ts — Configuration loading and validation.
 * Reads from package.json ("codecheck" key), .codecheckrc, or codecheck.config.json.
 * Applies defaults for all optional fields.
 */

import { cosmiconfig } from 'cosmiconfig'
import { z } from 'zod'
import { ConfigError } from './errors.js'
import type { CodeCheckConfig, Framework, Language, LLMProvider, TestType } from './types.js'

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const TestTypeSchema = z.enum([
  'unit',
  'smoke',
  'functional',
  'sanity',
  'integration',
  'e2e',
  'api',
  'snapshot',
  'regression',
])

const ConfigSchema = z.object({
  trigger: z.enum(['oncommit', 'onsave', 'onpush', 'ci', 'watch']).optional(),
  testTypes: z.array(TestTypeSchema).min(1).optional(),
  output: z.array(z.string()).min(1).optional(),
  model: z.string().optional(),
  provider: z.enum(['anthropic', 'openai', 'gemini', 'ollama']).optional(),
  language: z.enum(['typescript', 'javascript', 'python']).optional(),
  framework: z.enum(['jest', 'vitest', 'pytest', 'mocha']).optional(),
  threshold: z.number().min(0).max(1).optional(),
  exclude: z.array(z.string()).optional(),
  concurrency: z.number().min(1).max(10).optional(),
  failOnError: z.boolean().optional(),
  keepGeneratedTests: z.boolean().optional(),
  cacheTtlDays: z.number().min(0).optional(),
})

type RawConfig = z.infer<typeof ConfigSchema>

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS: CodeCheckConfig = {
  trigger: 'oncommit',
  testTypes: ['unit', 'smoke'] as TestType[],
  output: ['terminal'],
  model: 'claude-sonnet-4-6',
  provider: 'anthropic' as LLMProvider,
  language: 'typescript' as Language,
  framework: 'jest' as Framework,
  threshold: 0.8,
  exclude: ['node_modules', 'dist', '*.test.ts', '*.test.js', '*.spec.ts', '*.spec.js'],
  concurrency: 3,
  failOnError: false,
  keepGeneratedTests: false,
  cacheTtlDays: 7,
}

// ─── Loader ──────────────────────────────────────────────────────────────────

const explorer = cosmiconfig('codecheck', {
  searchPlaces: [
    'package.json',
    '.codecheckrc',
    '.codecheckrc.json',
    '.codecheckrc.yaml',
    '.codecheckrc.yml',
    'codecheck.config.json',
    'codecheck.config.js',
    'codecheck.config.mjs',
  ],
})

/**
 * Load and validate CodeCheck config from the nearest config file.
 * Falls back to defaults for any missing fields.
 *
 * @param cwd - Directory to start searching from (defaults to process.cwd())
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<CodeCheckConfig> {
  let raw: RawConfig = {}

  try {
    const result = await explorer.search(cwd)
    if (result != null && !result.isEmpty) {
      const parsed = ConfigSchema.safeParse(result.config)
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        throw new ConfigError(`Invalid configuration:\n${issues.join('\n')}`)
      }
      raw = parsed.data
    }
  } catch (err) {
    if (err instanceof ConfigError) throw err
    // If no config file found, use all defaults — that's fine
  }

  return mergeWithDefaults(raw)
}

function mergeWithDefaults(raw: RawConfig): CodeCheckConfig {
  return {
    trigger: raw.trigger ?? DEFAULTS.trigger,
    testTypes: (raw.testTypes as TestType[] | undefined) ?? DEFAULTS.testTypes,
    output: raw.output ?? DEFAULTS.output,
    model: raw.model ?? DEFAULTS.model,
    provider: (raw.provider as LLMProvider | undefined) ?? DEFAULTS.provider,
    language: (raw.language as Language | undefined) ?? DEFAULTS.language,
    framework: (raw.framework as Framework | undefined) ?? DEFAULTS.framework,
    threshold: raw.threshold ?? DEFAULTS.threshold,
    exclude: raw.exclude ?? DEFAULTS.exclude,
    concurrency: raw.concurrency ?? DEFAULTS.concurrency,
    failOnError: raw.failOnError ?? DEFAULTS.failOnError,
    keepGeneratedTests: raw.keepGeneratedTests ?? DEFAULTS.keepGeneratedTests,
    cacheTtlDays: raw.cacheTtlDays ?? DEFAULTS.cacheTtlDays,
  }
}

export { DEFAULTS as configDefaults }

# @codecheck/core

The AI engine behind [CodeCheck](https://github.com/medhavee-upadhyaya/codecheck) — reads your source files, generates test cases with Claude / OpenAI / Gemini / Ollama, runs them, and returns structured results.

Most projects don't install this directly. Use a trigger package instead:

```bash
npm install -D @codecheck/trigger-oncommit @codecheck/scope-unit @codecheck/output-terminal
npx codecheck-init
```

Install `@codecheck/core` directly only if you're **building a custom trigger, scope plugin, or output plugin**.

---

## What this package provides

- **Extractor** — parses TypeScript, JavaScript, and Python source files into `TestTarget` objects (functions and classes)
- **LLM clients** — Anthropic, OpenAI, Gemini, and Ollama clients behind a common `LLMClient` interface
- **Schema validation** — validates every LLM response with Zod before it touches your filesystem
- **Generator** — writes Jest, Vitest, or Pytest test files to a temp directory
- **Runner** — executes generated tests and returns `TestResult[]`
- **Cache** — skips unchanged functions (7-day TTL by default)
- **Adaptive learning** — reads per-project history and adjusts LLM prompts automatically after 3+ runs
- **`CodeCheckEngine`** — the top-level orchestrator that wires all of the above together

---

## Install

```bash
npm install @codecheck/core
```

Requires Node.js ≥ 18.

---

## Quick example — run CodeCheck programmatically

```ts
import { CodeCheckEngine, AnthropicLLMClient } from '@codecheck/core'

const engine = new CodeCheckEngine({
  config: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    language: 'typescript',
    framework: 'vitest',
    testTypes: ['unit', 'smoke'],
    threshold: 0.8,
    failOnError: false,
    concurrency: 3,
    cacheTtlDays: 7,
    keepGeneratedTests: false,
    exclude: ['node_modules', 'dist'],
    output: ['terminal'],
  },
  llmClient: new AnthropicLLMClient(process.env.ANTHROPIC_API_KEY!),
})

const results = await engine.run(['src/utils.ts', 'src/payment.ts'])

console.log(`${results.passed} passed · ${results.failed} failed`)
```

---

## AI providers

```ts
import {
  AnthropicLLMClient,
  OpenAILLMClient,
  GeminiLLMClient,
  OllamaLLMClient,
  createLLMClient,
} from '@codecheck/core'

// Pick one — or use the factory:
const client = createLLMClient(config) // reads config.provider + env vars
```

| Provider | Env var | Notes |
|---|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` | Default. Claude models. |
| `openai` | `OPENAI_API_KEY` | GPT-4o, o1, etc. |
| `gemini` | `GEMINI_API_KEY` | Gemini 1.5 Pro, Flash, etc. |
| `ollama` | `OLLAMA_BASE_URL` | Local. No key needed. Default: `http://localhost:11434/v1` |

---

## Key types

```ts
import type {
  CodeCheckConfig,   // full config shape
  TestTarget,        // a function or class extracted from source
  TestCase,          // a single generated test (name + code)
  TestResult,        // pass/fail + duration for one TestCase
  ScopePlugin,       // interface for custom test-type plugins
  OutputPlugin,      // interface for custom result reporters
  LLMClient,         // interface for custom AI providers
} from '@codecheck/core'
```

---

## Building a custom scope plugin

A scope plugin tells CodeCheck **what kind of tests to generate** for each target.

```ts
import type { ScopePlugin, TestTarget, CodeCheckConfig } from '@codecheck/core'

export class MyCustomScopePlugin implements ScopePlugin {
  readonly name = 'custom'

  buildPrompt(target: TestTarget, config: CodeCheckConfig): string {
    return `Generate property-based tests for this function:\n\n${target.code}`
  }
}
```

Register it in your trigger config:

```ts
import { CodeCheckEngine } from '@codecheck/core'
import { MyCustomScopePlugin } from './my-plugin.js'

const engine = new CodeCheckEngine({
  config,
  llmClient,
  scopePlugins: { custom: () => new MyCustomScopePlugin() },
})
```

---

## Adaptive learning

After 3 runs, the engine automatically injects project history into each prompt — pass rates by test type, common failure patterns, and proven examples from your codebase. This is entirely automatic and stored in `.codecheck-results/project-profile.json` per project.

You can also use the learning API directly:

```ts
import { loadProfile, updateProfile, buildProfileContext } from '@codecheck/core'

const profile = await loadProfile('/path/to/project')
const context = buildProfileContext(profile) // null if < 3 runs
```

---

## Exported API

| Export | Description |
|---|---|
| `CodeCheckEngine` | Top-level orchestrator |
| `createLLMClient(config)` | Factory — picks the right LLM client from config |
| `AnthropicLLMClient` | Anthropic / Claude client |
| `OpenAILLMClient` | OpenAI client |
| `GeminiLLMClient` | Google Gemini client |
| `OllamaLLMClient` | Local Ollama client |
| `MockLLMClient` | For testing — returns fixture responses |
| `extractTargets(filePath)` | Extract functions/classes from a source file |
| `extractTargetsFromCode(code, lang)` | Extract from a string of code |
| `loadConfig(dir?)` | Load `codecheck` config via cosmiconfig |
| `runTests(file)` | Execute a generated test file, return results |
| `generateTestFile(targets, cases, config)` | Write Jest/Vitest/Pytest file |
| `computeCacheKey(target)` | SHA key for a function |
| `getCached / setCached` | Read/write the LLM result cache |
| `loadProfile / saveProfile` | Per-project learning profile |
| `updateProfile(profile, results)` | Update learning profile from run results |
| `buildProfileContext(profile)` | Build prompt context string from profile |
| `humanizeError(error)` | Translate assertion errors to plain English |
| `parseLLMResponse(json)` | Validate raw LLM JSON against the Zod schema |
| All error classes | `CodeCheckError`, `LLMApiError`, `LLMParseError`, etc. |

---

## Links

- [Full documentation & ecosystem](https://github.com/medhavee-upadhyaya/codecheck)
- [Quick Start (5 minutes)](https://github.com/medhavee-upadhyaya/codecheck/blob/main/docs/quickstart.md)
- [Plugin authoring guide](https://github.com/medhavee-upadhyaya/codecheck/blob/main/docs/plugins.md)
- [npm — all @codecheck packages](https://www.npmjs.com/search?q=%40codecheck)

---

## License

MIT © [Medhavee Upadhyaya](https://github.com/medhavee)

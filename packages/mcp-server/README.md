# @codecheck/mcp-server

MCP server for [CodeCheck](https://github.com/medhavee-upadhyaya/codecheck) — lets Claude Code and any MCP-compatible AI assistant run AI-generated tests directly from within their workflow, without you asking.

When this server is connected, Claude can call `codecheck_run` after editing your files, see which functions passed and failed, and fix issues before you even commit.

---

## Install in Claude Code

Add to your Claude Code settings (`~/.claude/settings.json` for global, or `.claude/settings.json` for a single project):

```json
{
  "mcpServers": {
    "codecheck": {
      "command": "npx",
      "args": ["-y", "@codecheck/mcp-server"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

That's it. Restart Claude Code and it will have access to three new tools.

---

## Tools

### `codecheck_run`

Run AI-generated tests on source files. Extracts every function, sends them to your configured LLM, generates test cases, runs them, and returns a pass/fail report.

```
codecheck_run({ files: ["src/utils.ts", "src/payment.ts"] })

→ CodeCheck Results
  ──────────────────────────────────────────────────
  4 passed · 1 failed · 80% pass rate

    src/payment.ts
      ✓ processPayment — unit · happy-path  (14ms)
      ✓ processPayment — unit · type-error  (11ms)
      ✓ processPayment — smoke · happy-path  (9ms)
      ✗ processPayment — unit · null-check  (8ms)
        → Crashed on null or undefined input — the function needs a null check
          TypeError: Cannot read properties of null
```

**Parameters:**
- `files` *(required)* — array of source file paths (absolute or relative to project root)
- `projectDir` — project root, defaults to the server's working directory
- `testTypes` — override test types: `unit`, `smoke`, `functional`, `sanity`, `integration`, `api`, `e2e`, `snapshot`, `regression`

### `codecheck_results`

Get the results from the most recent run without re-running tests.

### `codecheck_status`

Check whether CodeCheck is configured in the project, which AI provider is in use, and whether the API key is set.

---

## Providers

The MCP server uses the same provider configured in your project's `codecheck` config (`package.json` or `codecheck.config.json`).

| Provider | Env var to set in MCP config |
|---|---|
| Anthropic (default) | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Gemini | `GEMINI_API_KEY` |
| Ollama | `OLLAMA_BASE_URL` (optional, defaults to `http://localhost:11434/v1`) |

---

## Project setup

The project being tested needs a `codecheck` config. The fastest way:

```bash
npm install -D @codecheck/trigger-oncommit @codecheck/scope-unit @codecheck/output-terminal
npx codecheck-init
```

Or add manually to `package.json`:

```json
{
  "codecheck": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-6",
    "language": "typescript",
    "framework": "vitest",
    "testTypes": ["unit", "smoke"],
    "threshold": 0.8,
    "failOnError": false
  }
}
```

---

## Links

- [CodeCheck ecosystem](https://github.com/medhavee-upadhyaya/codecheck)
- [All @codecheck packages](https://www.npmjs.com/search?q=%40codecheck)
- [MCP protocol](https://modelcontextprotocol.io)

---

## License

MIT © [Medhavee Upadhyaya](https://github.com/medhavee)

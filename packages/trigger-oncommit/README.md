# @codecheck/trigger-oncommit

Pre-commit trigger for CodeCheck. Runs AI-generated tests on staged files before every git commit.

## Setup

```bash
npx codecheck-init
```

Or manually add to `.husky/pre-commit`:

```bash
npx codecheck
```

## Features

- Reads staged files via `git diff --cached`
- Generates and runs tests automatically
- Never blocks commits on its own errors (exits 0)
- `--dry-run` mode to preview without calling the LLM
- Supports all 4 providers: Anthropic, OpenAI, Gemini, Ollama

Part of the [CodeCheck](https://github.com/medhavee-upadhyaya/codecheck) ecosystem.

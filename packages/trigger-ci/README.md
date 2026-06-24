# CodeCheck CI — AI Test Generation for GitHub Actions

Automatically generate and run AI-powered tests on changed files in your pull requests.

## Quick Start

```yaml
# .github/workflows/codecheck.yml
name: CodeCheck
on: [pull_request]

jobs:
  codecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: medhavee-upadhyaya/codecheck@main
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `provider` | `anthropic` | LLM provider (`anthropic`, `openai`, `gemini`, `ollama`) |
| `model` | auto | Model name (e.g. `claude-sonnet-4-20250514`, `gpt-4o`, `gemini-2.5-flash`) |
| `test-types` | `unit,smoke` | Comma-separated test types to generate |
| `threshold` | `0.8` | Minimum pass rate before failing |
| `fail-on-error` | `false` | Whether to fail the CI job on test failures |
| `anthropic-api-key` | — | Anthropic API key |
| `openai-api-key` | — | OpenAI API key |
| `gemini-api-key` | — | Gemini API key |

## Using Gemini (free)

```yaml
- uses: medhavee-upadhyaya/codecheck@main
  with:
    provider: gemini
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
```

## What It Does

1. Detects files changed in the PR
2. Extracts functions from those files
3. Sends them to an LLM to generate test cases
4. Runs the generated tests
5. Reports results as a GitHub step summary

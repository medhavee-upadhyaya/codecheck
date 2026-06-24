# CodeCheck — AI Test Diagnostics

VS Code extension that shows inline diagnostics (red underlines) on functions whose AI-generated tests failed.

## How It Works

1. **CodeCheck** generates and runs tests on your code (via commit hooks, save triggers, or CI)
2. Results are written to `.codecheck-results/latest.json`
3. This extension **watches that file** and shows failed tests as inline warnings in your editor

## Features

- Red underline diagnostics on functions with failing tests
- Auto-refreshes when new results arrive
- Commands: `CodeCheck: Refresh Diagnostics` and `CodeCheck: Clear Diagnostics`

## Setup

1. Install [CodeCheck](https://www.npmjs.com/package/@codecheck/trigger-oncommit) in your project
2. Install this extension
3. Run your code through CodeCheck — diagnostics appear automatically

## Requirements

- CodeCheck must be set up in your project (`npx codecheck-init`)
- An LLM API key (Anthropic, OpenAI, Gemini, or local Ollama)

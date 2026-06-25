# @codecheck/init

Interactive setup wizard for CodeCheck. Configures your project with the right trigger, scope plugins, LLM provider, and output format.

## Usage

```bash
npx codecheck-init
```

Walks you through:
- Choosing an LLM provider (Anthropic, OpenAI, Gemini, Ollama)
- Selecting test types (unit, smoke, functional, etc.)
- Setting up the commit hook trigger
- Creating a `.codecheckrc` config file

Part of the [CodeCheck](https://github.com/medhavee-upadhyaya/codecheck) ecosystem.

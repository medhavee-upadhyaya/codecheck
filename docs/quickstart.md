# QuickStart

Get CodeCheck running on a TypeScript + Jest project in under 5 minutes.

## Prerequisites

- Node.js 18+
- A TypeScript or JavaScript project with Git initialized
- An [Anthropic API key](https://console.anthropic.com)

---

## Step 1 — Install

```bash
npm install -D \
  @codecheck/trigger-oncommit \
  @codecheck/scope-unit \
  @codecheck/scope-smoke \
  @codecheck/output-terminal
```

## Step 2 — Set your API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Add this to your shell profile (`.zshrc`, `.bashrc`) so it persists.

## Step 3 — Configure

Run the setup wizard:

```bash
npx codecheck-init
```

This asks you 8 questions and writes a `codecheck` block to your `package.json`. It can also set up the git hook automatically.

**Or** add the config manually to `package.json`:

```json
{
  "codecheck": {
    "trigger": "oncommit",
    "testTypes": ["unit", "smoke"],
    "output": ["terminal"],
    "model": "claude-sonnet-4-6",
    "language": "typescript",
    "framework": "jest",
    "threshold": 0.8,
    "failOnError": false
  }
}
```

## Step 4 — Set up the git hook

```bash
npx husky init
echo "npx codecheck" > .husky/pre-commit
chmod +x .husky/pre-commit
```

## Step 5 — Commit something

```bash
# Make a change
echo "export function greet(name: string) { return \`Hello, \${name}!\` }" >> src/utils.ts

# Stage and commit
git add src/utils.ts
git commit -m "feat: add greet function"
```

You'll see:

```
⠋ CodeCheck: generating tests…

  src/utils.ts
    ✓ greet returns greeting for typical name      8ms
    ✓ greet handles empty string input             6ms
    ✓ greet works with special characters          7ms
    ✓ greet does not throw on valid input          5ms

  4 passed · 0 failed · 100% ✓
```

---

## Next steps

- Add more test types: see [configuration.md](./configuration.md)
- View results in the browser: `npx codecheck-serve`
- Watch mode while coding: `npx codecheck-watch`
- Python project: see [configuration.md#python](./configuration.md#python)

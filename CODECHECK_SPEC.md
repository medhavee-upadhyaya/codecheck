# CodeCheck
## AI-Powered Self-Testing Ecosystem for Developers

**Created by:** Medhavee Upadhyaya  
**Version:** 0.1 — Concept Spec  
**Date:** April 2026

---

## The Problem

Developers know they should write tests. They almost never do.

Not because they are lazy. Because writing tests is:

- Slow — setting up mocks, assertions, and test frameworks takes longer than writing the actual feature
- Repetitive — the same boilerplate patterns written thousands of times across every codebase
- Brittle — tests break when UI changes, not when logic breaks
- Disconnected — tests live separately from the code they are supposed to protect
- Ignored — most AI coding tools generate code but leave testing entirely to the developer

The result: industry surveys show the average codebase has less than 60% test coverage even in 2026, despite AI being "everywhere in testing."

**The gap nobody has filled:** a modular, zero-config, drop-in package that generates and runs tests automatically as developers work — with no platform signup, no proprietary format, and no vendor lock-in.

---

## The Solution: CodeCheck

CodeCheck is a modular AI testing ecosystem. Developers install only what they need. The AI engine reads their code, understands intent, generates meaningful tests, runs them, and reports results — without the developer writing a single test file.

```bash
npm install codecheck
```

That is it. One install. The rest is configuration.

---

## Architecture: The Modular Ecosystem

CodeCheck is built as a composable plugin system. Three layers: trigger, scope, output.

### Core Package
`codecheck` — the AI brain

The core package does one thing: reads code, understands what it is supposed to do, and generates test cases using an LLM. It has no opinion about when to run, what to test, or how to show results. Those are plugin decisions.

**Supports:**
- Claude API (default)
- OpenAI API
- Google Gemini API
- Local Ollama models (zero cost, fully private)

---

### Layer 1: Trigger Plugins (when it runs)

| Package | Trigger | Use case |
|---|---|---|
| `codecheck-onsave` | File save | Instant feedback while coding |
| `codecheck-oncommit` | Git commit hook | Pre-commit gate |
| `codecheck-onpush` | Git push hook | Pre-push validation |
| `codecheck-ci` | CI pipeline (GitHub Actions, Jenkins) | Automated PR gate |
| `codecheck-watch` | Continuous file watcher | Always-on background testing |

---

### Layer 2: Scope Plugins (what it tests)

| Package | Scope | What it generates |
|---|---|---|
| `codecheck-functions` | Individual functions | Unit tests with edge cases, boundary conditions, null checks |
| `codecheck-api` | API endpoints | Request/response validation, status codes, error handling |
| `codecheck-e2e` | Full user flows | End-to-end Playwright tests from route analysis |
| `codecheck-everything` | Entire codebase | All of the above, prioritised by change impact |

---

### Layer 3: Output Plugins (what the developer sees)

| Package | Output | What it shows |
|---|---|---|
| `codecheck-terminal` | Terminal | Coloured pass/fail with failure details |
| `codecheck-inline` | Editor (VS Code) | Inline warnings like ESLint, red underlines on untested code |
| `codecheck-dashboard` | Web UI | Live dashboard with coverage, history, trend |
| `codecheck-report` | File | HTML/JSON report saved to disk |
| `codecheck-slack` | Slack | Alert on failure with summary |
| `codecheck-github` | GitHub | PR comment with test results and coverage delta |

---

## Configuration

One config block in `package.json` or `codecheck.config.json`:

```json
{
  "codecheck": {
    "trigger": "oncommit",
    "scope": "functions",
    "output": ["terminal", "github"],
    "model": "claude-sonnet-4-6",
    "language": "typescript",
    "threshold": 0.80,
    "exclude": ["node_modules", "dist", "*.test.ts"]
  }
}
```

Zero boilerplate. No test files to maintain. No framework to learn.

---

## How It Works (Under the Hood)

### Step 1: Code Reading
When triggered, CodeCheck reads the changed files. For `codecheck-functions`, it extracts every function signature, its docstring if present, its parameter types, and its return type.

### Step 2: Intent Understanding
The core LLM call. CodeCheck sends the function to Claude with a structured prompt:

```
Given this function:
[function code]

Generate test cases that cover:
1. The happy path
2. Boundary conditions
3. Null and undefined inputs
4. Type edge cases
5. Business logic edge cases

Return JSON: { testCases: [{ description, input, expectedOutput, category }] }
```

### Step 3: Test Generation
CodeCheck converts the JSON test cases into actual runnable test code in the developer's framework of choice: Jest, Vitest, Pytest, Mocha, or plain assertions.

### Step 4: Execution
Tests run immediately. Results are captured with pass/fail status, error messages, and execution time.

### Step 5: Output
Results are sent to the configured output plugins. Terminal shows coloured output. GitHub plugin posts a PR comment. Dashboard updates the trend chart.

### Step 6: Learning (Phase 2)
CodeCheck stores which test patterns caught real bugs. Over time it prioritises generating the kinds of tests that have historically found failures in this specific codebase.

---

## What Makes CodeCheck Different

The research shows the market gaps clearly. Here is where every existing tool falls short and what CodeCheck fixes:

| Pain point (from research) | Existing tools | CodeCheck |
|---|---|---|
| Signup required | Almost all SaaS tools | Zero signup. pip/npm install and go. |
| Proprietary format lock-in | Testim, Mabl, most platforms | Tests generated as standard code in your repo |
| Only works at one trigger point | Most tools pick one integration | Modular. Choose your trigger. |
| Covers only one test type | Unit OR E2E, rarely both | Scope plugins cover all layers |
| Requires platform dashboard | All SaaS tools | Optional. Terminal output works alone. |
| Happy-path only coverage | Most AI tools | Explicitly generates edge cases and boundary conditions |
| No business logic understanding | Single-prompt tools | Multi-turn context gathering before generation |
| Expensive at scale | $50 to $200+ per month | Core is open source. Bring your own API key. |

---

## What the Research Found Developers Actually Want

From analysis of developer forums, QA surveys, and testing tool reviews in 2026:

**Pain 1: Test setup takes longer than writing the feature**
Mocking frameworks, fixture setup, assertion boilerplate. Developers skip tests because the setup cost is too high relative to the perceived value.

**CodeCheck fix:** Zero setup. CodeCheck generates the entire test including mocks and assertions.

**Pain 2: Tests break for the wrong reasons**
A UI selector changes. 30 tests fail. None of them found a real bug. The team spends two hours updating locators.

**CodeCheck fix:** `codecheck-functions` tests logic not UI. `codecheck-e2e` uses AI-generated semantic locators that self-heal on selector changes.

**Pain 3: Flaky tests destroy CI trust**
When tests fail randomly, developers stop trusting the pipeline. They merge anyway. Real bugs slip through.

**CodeCheck fix:** CodeCheck tracks flakiness per test and flags repeat offenders. Flaky tests are quarantined automatically.

**Pain 4: Coverage numbers are vanity metrics**
High coverage with weak assertions gives false confidence. A test that runs a function without asserting anything is worthless.

**CodeCheck fix:** Every generated test has a meaningful assertion. CodeCheck is explicitly instructed to generate tests that would catch real failures, not just execute code paths.

**Pain 5: No tool works across the whole stack**
Teams use one tool for unit tests, another for APIs, another for E2E. The reporting is fragmented. The context is lost.

**CodeCheck fix:** One config. One install. All layers.

---

## MVP Scope (What to Build First)

Do not build everything. Ship one complete, working slice.

**MVP: `codecheck` + `codecheck-oncommit` + `codecheck-functions` + `codecheck-terminal`**

This is the most useful combination for the most developers. When they commit code, their functions get tested automatically, and they see results in the terminal before the commit goes through.

### MVP timeline (nights and weekends, 4 weeks)

**Week 1: Core engine**
- File reader that extracts functions from TypeScript and Python
- LLM integration (Claude API first, mock provider for testing)
- JSON test case schema
- Test code generator for Jest (TypeScript) and Pytest (Python)

**Week 2: Trigger and execution**
- Git commit hook integration via husky (TypeScript) or pre-commit (Python)
- Test runner that executes generated tests
- Result capture and exit code handling

**Week 3: Terminal output and polish**
- Coloured terminal output with pass/fail summary
- Failure detail with expected vs actual
- Configuration file parsing
- Error handling and graceful degradation when API is unavailable

**Week 4: Documentation and launch**
- README with quick start (under 5 minutes to first test)
- npm publish and PyPI publish
- GitHub repository with CI demonstrating CodeCheck testing itself
- Launch post

---

## Pricing Model

**Core is free and open source forever.**

Revenue (future) comes from:
- `codecheck-dashboard` — hosted dashboard with history, trends, team sharing ($9/month)
- `codecheck-teams` — shared config, team analytics, SSO ($19/user/month)
- Managed API key — developers who do not want to manage their own LLM API key ($5/month, includes API costs)

The open source model builds trust and installs. The hosted services make money.

---

## Why This Builds Medhavee's Brand

Every element of CodeCheck connects directly to the published work and research:

- The self-healing locator work from the Appium framework connects to `codecheck-e2e`
- The LLM consistency research connects to the AI engine design
- The ML reliability research connects to the flakiness detection logic
- The Preflight architecture connects to the overall pipeline design
- The APR research connects to the test generation methodology

CodeCheck is not a new direction. It is the natural product of everything already built.

When a developer installs `codecheck`, they are installing something built by someone who has spent two years studying exactly why AI-generated tests fail and how to make them reliable.

That story writes itself.

---

## Launch Strategy

**Step 1:** Build MVP in private. Do not announce until it works end to end.

**Step 2:** Write one LinkedIn post: "I got tired of writing tests manually so I built a package that writes them for me." Show a screen recording of CodeCheck running on a commit.

**Step 3:** Post to Hacker Show HN, Dev.to, and Reddit r/programming on the same day.

**Step 4:** Write a Substack deep dive on the architecture decisions and why existing tools fall short.

**Step 5:** Open issues on GitHub to build community before the tool has users.

---

## Repository Structure

```
codecheck/
├── packages/
│   ├── core/                   # AI engine, test generation
│   ├── trigger-oncommit/       # Git hook integration
│   ├── trigger-onsave/         # File watcher
│   ├── trigger-ci/             # GitHub Actions integration
│   ├── scope-functions/        # Function-level test generation
│   ├── scope-api/              # API test generation
│   ├── scope-e2e/              # E2E test generation
│   ├── output-terminal/        # Terminal reporter
│   ├── output-github/          # GitHub PR comments
│   └── output-dashboard/       # Web dashboard
├── examples/
│   ├── typescript-jest/
│   └── python-pytest/
├── docs/
└── README.md
```

---

## The One-Line Pitch

**CodeCheck: Your code tests itself.**

---

*This document is a living spec. Update as the build progresses.*

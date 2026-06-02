# I Built a Tool That Makes Your Code Test Itself. Here's Everything I Learned.

*After watching five decades of software development, I've come to one uncomfortable conclusion: we've been thinking about testing backwards.*

---

Every team I've ever worked with has the same conversation. It goes like this:

"We should have better test coverage."

"Agreed."

"Who's going to write them?"

Silence.

The tests don't get written. Not because developers are lazy. Not because they don't understand their value. But because writing a good test requires a particular kind of mental discipline — you have to stop thinking about the problem you just solved and start thinking about all the ways you might have gotten it wrong. That's a hard context switch. It happens after the dopamine of finishing the feature has already faded. The activation energy is too high.

So I built CodeCheck. It removes the activation energy entirely.

You commit code. CodeCheck reads what you wrote, figures out what to test, generates the tests, runs them, and tells you what broke — before your commit goes through. No test files to write. No framework to configure. No thinking required.

Here's what building it taught me.

---

## The Insight That Started Everything

I've built compilers, distributed databases, real-time trading systems, and large-scale infrastructure. The one constant across all of it: the bugs that escape to production are always in the code nobody thought to test.

Not the complex code. Complex code gets scrutinized. It's the "obviously correct" one-liner that returns null when the input is an empty string. The boundary condition that was never a boundary during development but becomes one in production at 3am on a Saturday.

LLMs are remarkably good at generating tests for this kind of code. They've been trained on millions of test files. They know what edge cases look like. They don't get tired or impatient. And critically — they don't have the author's blind spot. The model that generates tests for your function didn't just write that function. It comes to it fresh.

That asymmetry is the whole idea.

---

## The Architecture: Why Three Plugin Layers?

Most testing tools are monolithic. One config file, one command, one opinion about how your project should be structured. That's fine for small projects. It falls apart the moment your team grows, your stack evolves, or your quality standards change.

I designed CodeCheck around three independent plugin layers:

**Triggers** answer *when*. On every commit? Every save? Every push? When CI runs? The trigger doesn't care about tests. It cares about time.

**Scopes** answer *what*. Unit tests? Integration? Smoke? End-to-end? Snapshot? Regression? Each scope plugin extracts targets from your code and tells the AI exactly what kind of test to generate. A smoke test and an integration test are fundamentally different things and should be generated differently.

**Outputs** answer *how you find out*. Terminal output. A GitHub PR comment. A Slack notification. A local web dashboard. An HTML report. VS Code inline diagnostics. The result is the same; how it reaches you depends on your workflow.

This isn't over-engineering. It's the opposite. A monolithic tool has to be everything to everyone or it's nothing to most people. A plugin system lets each concern evolve independently. You don't need to rebuild the whole thing when GitHub adds a new annotation format. You update one output plugin.

The lesson from fifty years of software: **separate things that change for different reasons.**

---

## The Decision I'm Most Proud Of

Every trigger in CodeCheck exits zero on unexpected errors.

That's it. That's the rule. If CodeCheck crashes — bad API response, network down, malformed config, disk full, anything — your commit goes through.

This sounds obvious. It isn't. Most developer tools don't think carefully about their failure mode. They assume they'll work. CodeCheck assumes it will sometimes fail, and designs for that case first.

The reasoning is simple: CodeCheck is a guest in your workflow, not the host. Your commit is real work. CodeCheck's opinion of your commit is a service, not a gate. The moment a tool starts blocking real work due to its own failures, it becomes the enemy. Developers will find ways around it. They'll use `--no-verify`. They'll disable it. All the value disappears.

By guaranteeing zero impact on unexpected failure, CodeCheck earns the right to stay in the critical path.

The only time it should ever block a commit is when you've explicitly asked it to (`failOnError: true`) AND your pass rate has genuinely dropped below your threshold. That's it.

---

## What I Got Wrong First

My initial approach was to have the AI generate test code directly — full Jest or Pytest files, ready to run.

This was a mistake.

LLMs, even good ones, generate syntactically plausible but semantically wrong test code at a surprisingly high rate. Import paths that don't exist. Mock setups that don't match the real module. Assert patterns that Jest accepts but that test nothing meaningful.

The better approach was to have the AI output structured data — a JSON array of test cases describing inputs, expected outputs, categories, and whether the test should throw — and then use a deterministic code generator to turn that into runnable test files.

This changes the failure mode completely. Instead of "the AI wrote broken code," you get "the AI described a test case that doesn't make sense, and the generator caught it during schema validation." You can fix the schema. You can improve the prompts. You have something to debug.

**Never ask an LLM to generate something you'll run directly. Ask it to describe what you want. Write the runner yourself.**

This is the most important technical insight in the whole project.

---

## The Provider Problem

Claude is the best model for code understanding tasks. I believe this. But I'm biased — I use it every day.

Not everyone has an Anthropic API key. Many companies have existing relationships with OpenAI. Some teams need everything to stay local for compliance reasons.

So CodeCheck supports four providers: Anthropic (Claude), OpenAI, Google Gemini, and Ollama for fully local inference. One config line to switch.

```json
{ "provider": "ollama", "model": "llama3.2" }
```

No data leaves your machine. No API key needed. Pull a model, point CodeCheck at it, done.

The implementation required one insight: OpenAI and Ollama share an API protocol. Ollama exposes an OpenAI-compatible endpoint at localhost. So the "Ollama client" is just the OpenAI SDK pointed at a different baseURL. That's it. Four providers, three distinct implementations.

```typescript
case 'ollama':
  return new OllamaLLMClient(
    process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434/v1'
  )
```

The lesson: **before building something new, check whether something you already have does the job.**

---

## Adaptive Learning Was the Hardest Part

After three or more runs, CodeCheck starts reading its own history. It knows your project's pass rates by test category. It knows which kinds of errors keep appearing. It knows what kinds of tests have historically caught real bugs versus generating false positives.

It injects this context into every subsequent prompt:

*"In this project, null-check tests fail 60% of the time. Generate more of them. Async timeout tests have a 90% pass rate. Boundary condition tests catch real bugs here — include them."*

The model reads this and adjusts. Over time, CodeCheck gets better at testing your specific codebase.

This was hard to build because it required resisting the urge to make it complex. The profile is just a JSON file. The analyzer is simple arithmetic. The prompt injection is a string append. The sophistication isn't in the mechanism — it's in recognizing that even simple feedback loops produce meaningful improvement when run consistently.

Two design constraints I held firm on:

1. No signal until three runs. One or two runs are noise. Injecting context from two runs teaches the model to optimize for randomness.
2. Profile save is best-effort. If writing the profile fails, the run continues. Never let bookkeeping block the actual work.

---

## On Publishing 22 npm Packages

The monorepo publishes 22 scoped packages under `@codecheck`. Getting there required:

- A granular npm access token with "bypass 2FA" explicitly enabled
- An npm organization named `codecheck` to register the scope
- A publish script that builds, tests, and publishes in strict dependency order

The dependency order matters. If you publish `scope-unit` before `core`, users installing `scope-unit` at that exact moment get a broken install. `core` must be live before anything that depends on it.

The publish script enforces this. It's not clever. It's a loop over a hardcoded array in the right order. Boring, correct, and impossible to get wrong by accident.

```bash
PACKAGES=(
  "packages/core"          # first
  "packages/scope-unit"    # depends on core
  "packages/scope-smoke"   # depends on core
  # ... rest in order
)
```

The `npm warn publish` about `repository.url` was harmless — npm normalized the format. It's not an error. Don't let warnings distract you from the real signal.

---

## The Thing Nobody Talks About

Testing tools are philosophical documents.

When you write a test, you're making a claim: *this is what correct behavior looks like.* You're capturing your understanding of the system at a point in time.

Most teams don't do this consistently, not because they don't care, but because maintaining that discipline over hundreds of commits is genuinely hard. The intention is there. The follow-through isn't.

What CodeCheck does — what any AI-assisted testing tool does at its best — is lower the cost of that documentation to nearly zero. You don't have to write the claim. You commit the code, and the system figures out what claims are worth making and makes them.

That's not laziness. That's leverage.

The best engineers I've known understood that their job is to solve hard problems, not to perform solving hard problems. If a tool handles the mechanical parts — file I/O, test structure, boilerplate — you can spend your attention on the parts that actually require judgment.

---

## What's Next

CodeCheck is version 0.1.0. It works. It's published. People can use it today.

What comes next:

**Smarter target extraction.** Right now CodeCheck extracts functions and classes by pattern. A proper TypeScript AST traversal would catch more targets and understand context better — generic functions, overloads, interface implementations.

**Richer learning.** The current profile tracks pass rates. Future versions should track which test inputs repeatedly find bugs, and bias generation toward those input shapes.

**Test persistence.** Generated tests currently live in `.codecheck-tmp/` and are deleted after each run. Some teams will want to keep the best ones, integrate them into their permanent test suite, and iterate on them. That workflow deserves first-class support.

**Python and beyond.** TypeScript and Python are supported. Go, Rust, and Java are obvious next additions.

---

## The One Thing I'd Tell Any Engineer Starting Something Like This

Don't build the perfect version first.

I've seen too many tools die in the design phase. Developers who spend six months on the architecture and never ship. The architecture is beautiful. The tool doesn't exist.

Build the smallest thing that proves the core idea works. In CodeCheck's case, that was: read a TypeScript file, send one function to Claude, get test cases back, run them, print pass/fail. That's it. No plugins. No providers. No learning. Just the proof.

Once you have the proof, you can build around it. The plugin system came later. The four providers came later. Adaptive learning came later. None of it was in the first version. All of it builds on the same core.

The question to ask isn't "what should this be?" It's "what's the smallest thing that would prove this is worth building?"

Build that. Then build what's next.

---

CodeCheck is open source. You can install it right now:

```bash
npm install -D @codecheck/trigger-oncommit @codecheck/scope-unit @codecheck/output-terminal
npx codecheck-init
```

Your code has been waiting to test itself. Now it can.

---

*Medhavee Upadhyaya builds developer tools. CodeCheck is available on npm under the @codecheck scope. The source is on GitHub at github.com/medhavee-upadhyaya/codecheck.*

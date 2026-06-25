# @codecheck/scope-regression

Regression test scope plugin for CodeCheck. Reads `.codecheck-results/flakiness.json` and prioritizes previously-failed functions for retesting.

Functions that have failed before are sorted to the front. The LLM focuses on failure-prone inputs, off-by-one errors, type coercion traps, and re-entry correctness.

Part of the [CodeCheck](https://github.com/medhavee-upadhyaya/codecheck) ecosystem.

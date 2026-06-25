# @codecheck/scope-unit

Unit test scope plugin for CodeCheck. Generates isolated unit tests covering happy path, edge cases, boundary conditions, null checks, and error handling.

## Test Categories Generated

- `happy-path` — typical inputs with expected outputs
- `edge-case` — empty strings, zero, empty arrays
- `boundary` — min/max values, off-by-one
- `null-check` — null and undefined inputs
- `error-handling` — inputs that should throw
- `type-error` — wrong argument types

Part of the [CodeCheck](https://github.com/medhavee-upadhyaya/codecheck) ecosystem.

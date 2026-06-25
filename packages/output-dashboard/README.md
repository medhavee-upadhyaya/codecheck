# @codecheck/output-dashboard

Web dashboard output plugin for CodeCheck. Writes test results to `.codecheck-results/` and serves a local dashboard with pass/fail trends.

## Usage

```bash
npx codecheck-serve
npx codecheck-serve --port 8080
```

Results are saved automatically on every CodeCheck run. The dashboard polls for updates every 5 seconds.

## Features

- Pass/fail history (up to 50 runs)
- Per-function breakdown
- Auto-refresh
- Zero dependencies (built-in Node HTTP server)

Part of the [CodeCheck](https://github.com/medhavee-upadhyaya/codecheck) ecosystem.

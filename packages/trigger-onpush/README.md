# @codecheck/trigger-onpush

Pre-push trigger for CodeCheck. Runs AI-generated tests on files changed since the remote HEAD before every `git push`.

## Setup

Add to `.husky/pre-push`:

```bash
npx codecheck-push
```

Never blocks push on its own errors.

Part of the [CodeCheck](https://github.com/medhavee-upadhyaya/codecheck) ecosystem.

# @codecheck/output-slack

Slack output plugin for CodeCheck. Posts test results to a Slack channel via webhook.

## Setup

Set the `SLACK_WEBHOOK_URL` environment variable. If not set, the plugin is silently skipped.

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
```

Part of the [CodeCheck](https://github.com/medhavee-upadhyaya/codecheck) ecosystem.

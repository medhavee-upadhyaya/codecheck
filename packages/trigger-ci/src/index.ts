/**
 * @codecheck/trigger-ci — CI trigger plugin.
 *
 * Exports the programmatic API for embedding the CI trigger
 * in custom setups. Default usage is via the `codecheck-ci` bin
 * in your GitHub Actions / GitLab CI / etc. pipeline step.
 *
 * GitHub Actions usage:
 *   - name: Run CodeCheck
 *     run: npx codecheck-ci
 *     env:
 *       ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
 */

export { getCIChangedFiles } from './getCIChangedFiles.js'

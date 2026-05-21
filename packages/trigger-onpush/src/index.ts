/**
 * @codecheck/trigger-onpush — Pre-push trigger plugin.
 *
 * Exports the programmatic API for embedding the on-push trigger
 * in custom setups. Default usage is via the `codecheck-push` bin
 * which husky invokes as a pre-push hook.
 *
 * Setup (add to your project):
 *   echo "npx codecheck-push" > .husky/pre-push
 *   chmod +x .husky/pre-push
 */

export { getPushedFiles } from './getPushedFiles.js'

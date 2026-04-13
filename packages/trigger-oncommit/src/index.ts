/**
 * @codecheck/trigger-oncommit — Pre-commit trigger plugin.
 *
 * Exports the programmatic API for embedding the on-commit trigger
 * in custom setups. The default usage is via the `codecheck` bin
 * which husky invokes as a pre-commit hook.
 */

export { getStagedFiles } from './getStagedFiles.js'

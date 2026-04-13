#!/usr/bin/env node
/**
 * bin.ts — codecheck-serve CLI.
 *
 * Starts the CodeCheck dashboard web server. Reads test results from
 * `.codecheck-results/` in the current directory and serves a web UI at
 * http://localhost:<port> that auto-refreshes every 5 seconds.
 *
 * Usage:
 *   npx codecheck-serve
 *   npx codecheck-serve --port 8080
 */

import { startDashboardServer } from './server.js'

const args = process.argv.slice(2)
const portIndex = args.findIndex((a) => a === '--port' || a === '-p')
const port = portIndex !== -1 ? parseInt(args[portIndex + 1] ?? '3333', 10) : 3333

if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${args[portIndex + 1]}`)
  process.exit(1)
}

const cwd = process.cwd()
const server = startDashboardServer({ port, cwd })

server.on('listening', () => {
  console.log()
  console.log('  \x1b[1m\x1b[36m◆ CodeCheck Dashboard\x1b[0m')
  console.log()
  console.log(`  \x1b[2mListening at:\x1b[0m  \x1b[4mhttp://localhost:${port}\x1b[0m`)
  console.log(`  \x1b[2mResults dir:\x1b[0m   ${cwd}/.codecheck-results/`)
  console.log()
  console.log('  \x1b[2mDashboard auto-refreshes every 5 seconds.\x1b[0m')
  console.log('  \x1b[2mPress Ctrl+C to stop.\x1b[0m')
  console.log()
})

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\x1b[31mPort ${port} is already in use. Try --port <other>.\x1b[0m`)
  } else {
    console.error(`\x1b[31mServer error:\x1b[0m ${err.message}`)
  }
  process.exit(1)
})

process.on('SIGINT', () => {
  server.close(() => process.exit(0))
})

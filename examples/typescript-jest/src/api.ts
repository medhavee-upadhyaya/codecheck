/**
 * api.ts — Example HTTP handler functions that demonstrate scope-api test generation.
 *
 * These are plain functions that simulate the request/response contract of an API
 * without requiring an actual HTTP server. CodeCheck's API scope plugin will
 * generate tests that verify status codes, response shapes, and error handling.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Request {
  method: string
  path: string
  body?: Record<string, unknown>
  headers?: Record<string, string>
  query?: Record<string, string>
}

export interface Response {
  status: number
  body: unknown
  headers?: Record<string, string>
}

// ─── In-memory store (simulates a database) ───────────────────────────────────

const users = new Map<string, { id: string; name: string; email: string }>()
let nextId = 1

export function resetStore(): void {
  users.clear()
  nextId = 1
}

// ─── User Handlers ────────────────────────────────────────────────────────────

/** Create a new user. Expects { name, email } in the request body. */
export function createUserHandler(req: Request): Response {
  if (req.method !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed' } }
  }

  const body = req.body ?? {}
  const name = body['name']
  const email = body['email']

  if (typeof name !== 'string' || name.trim() === '') {
    return { status: 400, body: { error: 'name is required' } }
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return { status: 400, body: { error: 'email is required and must be valid' } }
  }

  const id = String(nextId++)
  const user = { id, name: name.trim(), email: email.toLowerCase() }
  users.set(id, user)

  return { status: 201, body: { user } }
}

/** Get a user by ID. */
export function getUserHandler(req: Request): Response {
  if (req.method !== 'GET') {
    return { status: 405, body: { error: 'Method not allowed' } }
  }

  const id = req.query?.['id']
  if (!id) {
    return { status: 400, body: { error: 'id query parameter is required' } }
  }

  const user = users.get(id)
  if (!user) {
    return { status: 404, body: { error: `User ${id} not found` } }
  }

  return { status: 200, body: { user } }
}

/** List all users. Supports optional ?limit= query param. */
export function listUsersHandler(req: Request): Response {
  if (req.method !== 'GET') {
    return { status: 405, body: { error: 'Method not allowed' } }
  }

  const limitParam = req.query?.['limit']
  const limit = limitParam ? parseInt(limitParam, 10) : undefined

  const all = Array.from(users.values())
  const result = limit != null && !isNaN(limit) ? all.slice(0, limit) : all

  return { status: 200, body: { users: result, total: all.length } }
}

/** Delete a user by ID. Requires Authorization header. */
export function deleteUserHandler(req: Request): Response {
  if (req.method !== 'DELETE') {
    return { status: 405, body: { error: 'Method not allowed' } }
  }

  const auth = req.headers?.['authorization']
  if (!auth) {
    return { status: 401, body: { error: 'Authorization header required' } }
  }

  const id = req.query?.['id']
  if (!id) {
    return { status: 400, body: { error: 'id query parameter is required' } }
  }

  if (!users.has(id)) {
    return { status: 404, body: { error: `User ${id} not found` } }
  }

  users.delete(id)
  return { status: 204, body: null }
}

/** Health check endpoint — always returns 200 OK. */
export function healthHandler(req: Request): Response {
  return { status: 200, body: { status: 'ok', timestamp: new Date().toISOString() } }
}

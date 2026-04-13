import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OnSaveTrigger } from '../index.js'

describe('OnSaveTrigger', () => {
  it('has name "onsave"', () => {
    const trigger = new OnSaveTrigger()
    expect(trigger.name).toBe('onsave')
  })

  it('accepts cwd option', () => {
    const trigger = new OnSaveTrigger({ cwd: '/tmp' })
    expect(trigger.name).toBe('onsave')
  })

  it('accepts debounceMs option', () => {
    const trigger = new OnSaveTrigger({ debounceMs: 500 })
    expect(trigger.name).toBe('onsave')
  })

  it('accepts include/exclude options', () => {
    const trigger = new OnSaveTrigger({
      include: ['**/*.ts'],
      exclude: ['**/node_modules/**'],
    })
    expect(trigger.name).toBe('onsave')
  })

  it('onTrigger registers a handler without throwing', () => {
    const trigger = new OnSaveTrigger()
    expect(() => {
      trigger.onTrigger(async (_files) => {})
    }).not.toThrow()
  })

  it('stop() resolves even if watcher was never started', async () => {
    const trigger = new OnSaveTrigger()
    await expect(trigger.stop()).resolves.toBeUndefined()
  })

  it('exports OnSaveTrigger as a class', async () => {
    const mod = await import('../index.js')
    expect(typeof mod.OnSaveTrigger).toBe('function')
  })
})

describe('OnSaveTrigger debounce logic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces multiple rapid file changes into a single handler call', async () => {
    const trigger = new OnSaveTrigger({ debounceMs: 100 })
    const handler = vi.fn().mockResolvedValue(undefined)
    trigger.onTrigger(handler)

    // Directly call the private scheduleRun via type casting
    const t = trigger as unknown as { scheduleRun: (path: string) => void }
    t.scheduleRun('/project/src/a.ts')
    t.scheduleRun('/project/src/b.ts')
    t.scheduleRun('/project/src/c.ts')

    expect(handler).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()

    expect(handler).toHaveBeenCalledTimes(1)
    const calledWith = handler.mock.calls[0]?.[0] as string[]
    expect(calledWith).toHaveLength(3)
    expect(calledWith).toContain('/project/src/a.ts')
  })

  it('fires handler after debounce delay', async () => {
    const trigger = new OnSaveTrigger({ debounceMs: 200 })
    const handler = vi.fn().mockResolvedValue(undefined)
    trigger.onTrigger(handler)

    const t = trigger as unknown as { scheduleRun: (path: string) => void }
    t.scheduleRun('/project/src/file.ts')

    // Before delay — not called yet
    await vi.advanceTimersByTimeAsync(100)
    expect(handler).not.toHaveBeenCalled()

    // After delay — called
    await vi.advanceTimersByTimeAsync(200)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

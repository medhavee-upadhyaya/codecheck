import { describe, it, expect } from 'vitest'
import { loadConfig, configDefaults } from '../config.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, 'fixtures')

describe('loadConfig', () => {
  it('returns defaults when no config file exists', async () => {
    // Use a temp directory with no config file
    const config = await loadConfig('/tmp')
    expect(config.trigger).toBe(configDefaults.trigger)
    expect(config.testTypes).toEqual(configDefaults.testTypes)
    expect(config.model).toBe(configDefaults.model)
    expect(config.threshold).toBe(configDefaults.threshold)
    expect(config.concurrency).toBe(configDefaults.concurrency)
    expect(config.failOnError).toBe(false)
    expect(config.keepGeneratedTests).toBe(false)
    expect(config.cacheTtlDays).toBe(7)
  })

  it('loads config from fixture directory', async () => {
    const config = await loadConfig(fixturesDir)
    expect(config.testTypes).toContain('unit')
    expect(config.threshold).toBe(0.9)
    expect(config.model).toBe('claude-sonnet-4-6')
  })

  it('merges partial config with defaults', async () => {
    // Any field not in the config file should get defaults
    const config = await loadConfig(fixturesDir)
    expect(config.concurrency).toBe(configDefaults.concurrency)
    expect(config.failOnError).toBe(configDefaults.failOnError)
  })
})

describe('configDefaults', () => {
  it('has valid testTypes', () => {
    expect(configDefaults.testTypes.length).toBeGreaterThan(0)
  })

  it('has a threshold between 0 and 1', () => {
    expect(configDefaults.threshold).toBeGreaterThanOrEqual(0)
    expect(configDefaults.threshold).toBeLessThanOrEqual(1)
  })
})

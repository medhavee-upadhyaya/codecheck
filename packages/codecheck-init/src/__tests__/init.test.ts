import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildConfig,
  writeConfig,
  detectPackageManager,
  detectProjectName,
} from '../index.js'
import type { InitAnswers } from '../index.js'

function makeAnswers(overrides: Partial<InitAnswers> = {}): InitAnswers {
  return {
    trigger: 'oncommit',
    testTypes: ['unit', 'smoke'],
    output: ['terminal'],
    model: 'claude-sonnet-4-6',
    language: 'typescript',
    framework: 'jest',
    threshold: 0.8,
    failOnError: false,
    setupHusky: false,
    ...overrides,
  }
}

describe('buildConfig', () => {
  it('produces a config with the given trigger', () => {
    const config = buildConfig(makeAnswers({ trigger: 'onsave' }))
    expect(config.trigger).toBe('onsave')
  })

  it('includes testTypes from answers', () => {
    const config = buildConfig(makeAnswers({ testTypes: ['unit', 'functional'] }))
    expect(config.testTypes).toEqual(['unit', 'functional'])
  })

  it('sets default exclude list', () => {
    const config = buildConfig(makeAnswers())
    expect(config.exclude).toContain('node_modules')
    expect(config.exclude).toContain('dist')
  })

  it('sets cacheTtlDays to 7', () => {
    const config = buildConfig(makeAnswers())
    expect(config.cacheTtlDays).toBe(7)
  })

  it('passes threshold through', () => {
    const config = buildConfig(makeAnswers({ threshold: 0.9 }))
    expect(config.threshold).toBe(0.9)
  })

  it('passes failOnError through', () => {
    const config = buildConfig(makeAnswers({ failOnError: true }))
    expect(config.failOnError).toBe(true)
  })
})

describe('writeConfig', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'codecheck-init-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('injects into package.json when it exists', async () => {
    const pkgPath = join(tmpDir, 'package.json')
    await writeFile(pkgPath, JSON.stringify({ name: 'my-app', version: '1.0.0' }), 'utf8')

    const config = buildConfig(makeAnswers())
    const { method } = await writeConfig(tmpDir, config)

    expect(method).toBe('package.json')
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, unknown>
    expect(pkg['codecheck']).toBeDefined()
    expect((pkg['codecheck'] as Record<string, unknown>)['trigger']).toBe('oncommit')
  })

  it('preserves existing package.json keys', async () => {
    const pkgPath = join(tmpDir, 'package.json')
    await writeFile(
      pkgPath,
      JSON.stringify({ name: 'my-app', version: '2.0.0', scripts: { test: 'jest' } }),
      'utf8',
    )

    const config = buildConfig(makeAnswers())
    await writeConfig(tmpDir, config)

    const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, unknown>
    expect(pkg['name']).toBe('my-app')
    expect(pkg['version']).toBe('2.0.0')
    expect((pkg['scripts'] as Record<string, string>)['test']).toBe('jest')
  })

  it('writes codecheck.config.json when no package.json', async () => {
    const config = buildConfig(makeAnswers())
    const { method, configPath } = await writeConfig(tmpDir, config)

    expect(method).toBe('codecheck.config.json')
    expect(configPath).toContain('codecheck.config.json')

    const content = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
    expect(content['codecheck']).toBeDefined()
  })
})

describe('detectPackageManager', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'codecheck-pm-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('detects npm from package-lock.json', async () => {
    await writeFile(join(tmpDir, 'package-lock.json'), '{}', 'utf8')
    const pm = await detectPackageManager(tmpDir)
    expect(pm).toBe('npm')
  })

  it('detects yarn from yarn.lock', async () => {
    await writeFile(join(tmpDir, 'yarn.lock'), '', 'utf8')
    const pm = await detectPackageManager(tmpDir)
    expect(pm).toBe('yarn')
  })

  it('detects pnpm from pnpm-lock.yaml', async () => {
    await writeFile(join(tmpDir, 'pnpm-lock.yaml'), '', 'utf8')
    const pm = await detectPackageManager(tmpDir)
    expect(pm).toBe('pnpm')
  })

  it('defaults to npm when no lock file found', async () => {
    const pm = await detectPackageManager(tmpDir)
    expect(pm).toBe('npm')
  })
})

describe('detectProjectName', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'codecheck-name-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('reads name from package.json', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-cool-project' }),
      'utf8',
    )
    const name = await detectProjectName(tmpDir)
    expect(name).toBe('my-cool-project')
  })

  it('falls back to directory name when no package.json', async () => {
    const name = await detectProjectName(tmpDir)
    // The temp dir basename is the name
    expect(typeof name).toBe('string')
    expect(name.length).toBeGreaterThan(0)
  })
})

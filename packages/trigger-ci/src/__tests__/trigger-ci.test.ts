import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGit = {
  revparse: vi.fn(),
  raw: vi.fn(),
}

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}))

describe('getCIChangedFiles', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...originalEnv }
    mockGit.revparse.mockResolvedValue('/repo')
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('uses GITHUB_BASE_REF for pull request events', async () => {
    process.env['GITHUB_BASE_REF'] = 'main'
    process.env['GITHUB_SHA'] = 'abc123'
    mockGit.raw
      .mockResolvedValueOnce('') // fetch
      .mockResolvedValueOnce('src/api.ts\nsrc/handler.ts\n') // diff

    const { getCIChangedFiles } = await import('../getCIChangedFiles.js')
    const files = await getCIChangedFiles('/repo')

    expect(files).toHaveLength(2)
    expect(files[0]).toContain('api.ts')
  })

  it('uses GITHUB_BEFORE for push events when no base ref', async () => {
    delete process.env['GITHUB_BASE_REF']
    process.env['GITHUB_BEFORE'] = 'deadbeef'
    process.env['GITHUB_SHA'] = 'abc123'
    mockGit.raw.mockResolvedValueOnce('src/service.ts\n')

    const { getCIChangedFiles } = await import('../getCIChangedFiles.js')
    const files = await getCIChangedFiles('/repo')

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('service.ts')
  })

  it('falls back to HEAD~1..HEAD when no env vars', async () => {
    delete process.env['GITHUB_BASE_REF']
    delete process.env['GITHUB_BEFORE']
    delete process.env['GITHUB_SHA']
    mockGit.raw.mockResolvedValueOnce('src/utils.ts\n')

    const { getCIChangedFiles } = await import('../getCIChangedFiles.js')
    const files = await getCIChangedFiles('/repo')

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('utils.ts')
  })

  it('returns empty array when git fails', async () => {
    mockGit.raw.mockRejectedValue(new Error('git unavailable'))

    const { getCIChangedFiles } = await import('../getCIChangedFiles.js')
    const files = await getCIChangedFiles('/repo')

    expect(files).toEqual([])
  })

  it('excludes test files and dist', async () => {
    mockGit.raw.mockResolvedValueOnce('src/lib.ts\nsrc/lib.test.ts\ndist/lib.js\n')

    const { getCIChangedFiles } = await import('../getCIChangedFiles.js')
    const files = await getCIChangedFiles('/repo')

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('lib.ts')
  })

  it('skips all-zeros GITHUB_BEFORE (initial commit to branch)', async () => {
    delete process.env['GITHUB_BASE_REF']
    process.env['GITHUB_BEFORE'] = '0000000000000000000000000000000000000000'
    process.env['GITHUB_SHA'] = 'abc123'
    mockGit.raw.mockResolvedValueOnce('src/main.ts\n')

    const { getCIChangedFiles } = await import('../getCIChangedFiles.js')
    const files = await getCIChangedFiles('/repo')

    // Falls back to HEAD~1..HEAD because before SHA is all zeros
    expect(files).toHaveLength(1)
  })
})

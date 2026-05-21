import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGit = {
  revparse: vi.fn(),
  raw: vi.fn(),
}

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}))

describe('getPushedFiles', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGit.revparse.mockResolvedValue('/repo')
  })

  it('returns TS files changed between origin and HEAD', async () => {
    mockGit.raw.mockResolvedValueOnce('src/utils.ts\nsrc/helper.ts\n')

    const { getPushedFiles } = await import('../getPushedFiles.js')
    const files = await getPushedFiles('/repo')

    expect(files).toHaveLength(2)
    expect(files[0]).toContain('utils.ts')
    expect(files[1]).toContain('helper.ts')
  })

  it('falls back to HEAD~1..HEAD when origin/HEAD is not available', async () => {
    mockGit.raw
      .mockRejectedValueOnce(new Error('no upstream'))
      .mockResolvedValueOnce('src/app.ts\n')

    const { getPushedFiles } = await import('../getPushedFiles.js')
    const files = await getPushedFiles('/repo')

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('app.ts')
  })

  it('returns empty array when both diff attempts fail', async () => {
    mockGit.raw.mockRejectedValue(new Error('git error'))

    const { getPushedFiles } = await import('../getPushedFiles.js')
    const files = await getPushedFiles('/repo')

    expect(files).toEqual([])
  })

  it('excludes test files', async () => {
    mockGit.raw.mockResolvedValueOnce('src/utils.ts\nsrc/utils.test.ts\nsrc/utils.spec.ts\n')

    const { getPushedFiles } = await import('../getPushedFiles.js')
    const files = await getPushedFiles('/repo')

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('utils.ts')
  })

  it('excludes dist and node_modules', async () => {
    mockGit.raw.mockResolvedValueOnce('dist/index.js\nnode_modules/lib/index.ts\nsrc/main.ts\n')

    const { getPushedFiles } = await import('../getPushedFiles.js')
    const files = await getPushedFiles('/repo')

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('main.ts')
  })

  it('returns empty array when diff output is empty', async () => {
    mockGit.raw.mockResolvedValueOnce('\n')

    const { getPushedFiles } = await import('../getPushedFiles.js')
    const files = await getPushedFiles('/repo')

    expect(files).toEqual([])
  })
})

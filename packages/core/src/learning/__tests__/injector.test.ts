import { describe, it, expect } from 'vitest'
import { buildProfileContext } from '../injector.js'
import { emptyProfile } from '../profile.js'
import type { ProjectProfile } from '../profile.js'

function profileWithRuns(runs: number): ProjectProfile {
  return {
    ...emptyProfile(),
    totalRuns: runs,
    passRateByTestType: {
      unit: { passCount: 9, totalCount: 10 },
      smoke: { passCount: 10, totalCount: 10 },
    },
    passRateByCategory: {
      'null-check': { passCount: 8, totalCount: 10 },
      'async-behavior': { passCount: 1, totalCount: 5 },
    },
    topFailureReasons: ['async timeout failures'],
    successfulExamples: ['returns null for empty input', 'throws on negative value'],
  }
}

describe('buildProfileContext', () => {
  it('returns null when fewer than 3 runs', () => {
    expect(buildProfileContext(emptyProfile())).toBeNull()
    expect(buildProfileContext(profileWithRuns(1))).toBeNull()
    expect(buildProfileContext(profileWithRuns(2))).toBeNull()
  })

  it('returns a string when 3+ runs', () => {
    const ctx = buildProfileContext(profileWithRuns(3))
    expect(typeof ctx).toBe('string')
    expect(ctx).not.toBeNull()
  })

  it('includes run count', () => {
    const ctx = buildProfileContext(profileWithRuns(47))
    expect(ctx).toContain('47')
  })

  it('includes test type pass rates', () => {
    const ctx = buildProfileContext(profileWithRuns(5))!
    expect(ctx).toContain('unit')
    expect(ctx).toContain('smoke')
  })

  it('mentions high-performing categories', () => {
    const ctx = buildProfileContext(profileWithRuns(5))!
    expect(ctx).toContain('null-check')
  })

  it('warns about low-performing categories', () => {
    const ctx = buildProfileContext(profileWithRuns(5))!
    expect(ctx).toContain('async-behavior')
    expect(ctx).toContain('conservative')
  })

  it('includes failure reasons', () => {
    const ctx = buildProfileContext(profileWithRuns(5))!
    expect(ctx).toContain('async timeout failures')
  })

  it('includes successful examples', () => {
    const ctx = buildProfileContext(profileWithRuns(5))!
    expect(ctx).toContain('returns null for empty input')
  })

  it('returns null for empty profile with 0 runs', () => {
    const ctx = buildProfileContext(emptyProfile())
    expect(ctx).toBeNull()
  })
})

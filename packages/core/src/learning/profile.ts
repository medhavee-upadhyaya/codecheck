/**
 * learning/profile.ts — ProjectProfile data type, load, and save.
 *
 * The profile is stored in .codecheck-results/project-profile.json.
 * It accumulates pass/fail data across every CodeCheck run so the LLM
 * can be told what kinds of tests work well in this specific project.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PassFailCounts {
  passCount: number
  totalCount: number
}

export interface ProjectProfile {
  /** Schema version — increment if the shape changes incompatibly */
  version: 1
  /** ISO timestamp of last update */
  lastUpdated: string
  /** Total number of CodeCheck runs recorded */
  totalRuns: number
  /** Running pass/fail counts per test type (e.g. "unit", "smoke") */
  passRateByTestType: Record<string, PassFailCounts>
  /** Running pass/fail counts per test category (e.g. "null-check", "boundary") */
  passRateByCategory: Record<string, PassFailCounts>
  /** Top 3 recurring failure reasons — plain English */
  topFailureReasons: string[]
  /** Up to 5 test descriptions that consistently pass — used as examples in prompts */
  successfulExamples: string[]
}

// ─── Empty profile ────────────────────────────────────────────────────────────

export function emptyProfile(): ProjectProfile {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    totalRuns: 0,
    passRateByTestType: {},
    passRateByCategory: {},
    topFailureReasons: [],
    successfulExamples: [],
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const PROFILE_FILENAME = '.codecheck-results/project-profile.json'

export async function loadProfile(cwd: string): Promise<ProjectProfile> {
  try {
    const filePath = path.join(cwd, PROFILE_FILENAME)
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as ProjectProfile
    // Reject profiles from incompatible schema versions
    if (parsed.version !== 1) return emptyProfile()
    return parsed
  } catch {
    // File doesn't exist yet or is corrupt — start fresh
    return emptyProfile()
  }
}

export async function saveProfile(cwd: string, profile: ProjectProfile): Promise<void> {
  const filePath = path.join(cwd, PROFILE_FILENAME)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf8')
}

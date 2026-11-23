import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { keyOf } from '@toolpath/tool-matching/library'
import { library } from '../src/library'
import { matchPart, prepareLibrary } from '../src/match-part'
import { partReportOf } from '../src/part-report'

const json = (path: string) =>
  JSON.parse(readFileSync(new URL(`../public/parts/${path}`, import.meta.url), 'utf8'))

const samples: Array<{ slug: string }> = json('index.json')
const matching = prepareLibrary(library)
const matchSample = (slug: string) =>
  matchPart(
    partReportOf(json(`${slug}/report.json`), json(`${slug}/features.json`)).report,
    matching,
  )

describe('the library', () => {
  it('is valid tool-support records, every cutter matchable', () => {
    expect(matching.tools).toHaveLength(library.tools.length)
    expect(new Set(library.tools.map((tool) => tool.guid)).size).toBe(library.tools.length)
  })
})

describe.each(samples)('$slug', ({ slug }) => {
  const match = matchSample(slug)

  it('needs tools from the library alone', () => {
    const keys = new Set(matching.tools.map(keyOf))
    expect(match.tools.length).toBeGreaterThan(0)
    for (const usage of match.tools) {
      expect(keys.has(usage.key)).toBe(true)
      expect(usage.uses.length).toBeGreaterThan(0)
    }
  })

  it('says of every feature it keeps how it is made, or why nothing makes it', () => {
    const said = new Set([
      ...match.tools.flatMap((usage) => usage.uses.flatMap((use) => use.tags)),
      ...match.unmatched.flatMap((item) => item.tags),
    ])
    expect(said.size).toBe(match.featureCount)
  })

  it('holds every cutter in a holder of the library', () => {
    for (const use of match.tools.flatMap((usage) => usage.uses)) {
      expect(library.holders).toContain(use.holder)
      expect(use.stickout).toBeGreaterThan(0)
    }
  })
})

it('drills, helically mills and chamfers the housing', () => {
  const ways = matchSample('toolpath-housing-probing-example-simple').tools.flatMap((usage) =>
    usage.uses.map((use) => `${use.way} ${usage.tool.kind}`),
  )
  expect(ways).toContain('chamfer ChamferEndmill')
  expect(ways).toContain('helical FlatEndmill')
})

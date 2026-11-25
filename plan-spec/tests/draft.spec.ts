import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { firstDraft, nextReading, specOf } from '../src/draft'
import type { Part } from '../src/plan-part'

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'))
const part: Part = fixture('part.json')
// The plan spec Toolpath accepted for this part's first draft, echoed as it queued the plan.
const accepted = fixture('plan-queued.json').planSpec

test('the first draft states the plan spec Toolpath accepted', () => {
  expect(specOf(part, firstDraft(part))).toEqual(accepted)
})

test('a click moves the face to the next feature that holds it', () => {
  const draft = firstDraft(part)
  const region = 5
  const owners = part.features
    .filter((feature) => feature.regionIdxs.includes(region))
    .map((feature) => feature.featureTag)
  const setupOf = (stated: ReturnType<typeof specOf>) =>
    typeof stated === 'string'
      ? null
      : stated.setups?.find((setup) =>
          setup.features?.some((feature) => feature.regions.includes(region)),
        )?.direction

  const before = setupOf(specOf(part, draft))
  const after = setupOf(specOf(part, nextReading(part, draft, owners)))
  expect(after).toBeDefined()
  expect(after).not.toEqual(before)
})

import type { PlanSpec } from '@toolpath/api'
import {
  applyDraftAction,
  planSpecOf,
  type Constraints,
  type DraftAction,
  type PlanRules,
} from '@toolpath/plan'
import type { Part } from './plan-part'

/** What `@toolpath/plan` needs to know of the part: each feature's regions, and who numbered them. */
const rulesOf = (part: Part): PlanRules => {
  const regions = new Map(part.features.map((feature) => [feature.featureTag, feature.regionIdxs]))
  return {
    regionsOf: (tag) => regions.get(tag) ?? [],
    kernel: part.kernelVersion,
    preparationId: part.preparationId,
  }
}

const apply = (part: Part, draft: Constraints, action: DraftAction): Constraints => {
  const result = applyDraftAction(draft, action, rulesOf(part))
  // This example only makes edits the package takes, so a refusal is a bug here. An app that lets
  // people edit freely shows `result.refused` to them instead.
  if ('refused' in result) throw new Error(`${action.kind} refused: ${result.refused.kind}`)
  return result.draft
}

/** Machines a feature from the direction the report reads it from, in a setup facing that way. */
const assign = (part: Part, draft: Constraints, tag: string): Constraints => {
  const { machiningDirection } = part.features.find((feature) => feature.featureTag === tag)!
  return apply(part, draft, {
    kind: 'assignFrom',
    tag,
    direction: machiningDirection,
    newId: crypto.randomUUID(),
  })
}

/**
 * 1. The first draft: each face in one feature, the first the report lists that holds it, and one
 * setup for each direction those features are read from.
 */
export const firstDraft = (part: Part): Constraints => {
  let draft: Constraints = { setups: [], done: [], doneKernel: null }
  const taken = new Set<number>()
  for (const feature of part.features) {
    if (feature.regionIdxs.some((region) => taken.has(region))) continue
    draft = assign(part, draft, feature.featureTag)
    feature.regionIdxs.forEach((region) => taken.add(region))
  }
  return draft
}

/**
 * 2. A click on a face: the next feature that holds it (`owners`, from the viewer) is assigned, in
 * the setup facing its direction, and the one assigned before is let go.
 */
export const nextReading = (part: Part, draft: Constraints, owners: ReadonlyArray<string>) => {
  // A face the report reads as part of no feature has nothing to assign.
  if (owners.length === 0) return draft
  const assigned = new Set(draft.setups.flatMap((setup) => setup.features))
  const current = owners.find((tag) => assigned.has(tag))
  const next = owners[(current ? owners.indexOf(current) + 1 : 0) % owners.length]
  const without = current ? apply(part, draft, { kind: 'unassign', tag: current }) : draft
  return assign(part, without, next)
}

/**
 * 3. The plan spec the draft states, by region, or why it can't be sent. The draft holds only the
 * report's own features, so none is `unstated`: an app that stores drafts checks that too.
 */
export const specOf = (part: Part, draft: Constraints): PlanSpec | string => {
  const { spec, tooManyRegions } = planSpecOf(draft, part.preparationId, part.features)
  if (tooManyRegions) return 'The plan spec names more regions than Toolpath takes in one plan.'
  // The SDK types `featureType` as its enum, and the spec carries the report's string for it.
  return spec as PlanSpec
}

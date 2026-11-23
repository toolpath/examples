import type { Collet, Holder, Tool, ToolLibrary } from '@toolpath/tool-support'
import {
  drillRequirement,
  millRequirement,
  type Requirement,
} from '@toolpath/tool-matching/assembly-check'
import { stickoutIn } from '@toolpath/tool-matching/clearance-note'
import { coverage } from '@toolpath/tool-matching/coverage'
import { readFeature, type FeatureReading } from '@toolpath/tool-matching/feature'
import { mapRequirement, type Way } from '@toolpath/tool-matching/feature-map'
import { keyOf, matchable, type MatchingLibrary } from '@toolpath/tool-matching/library'
import { hasTools } from '@toolpath/tool-matching/part-list'
import type { PartReport } from '@toolpath/tool-matching/part'
import { withReach } from '@toolpath/tool-matching/reach'
import type { Gap, Reason } from '@toolpath/tool-matching/solution'
import { featureName } from '@toolpath/tool-matching/text'
import { approachRank, solve, type SolveResult } from '@toolpath/tool-matching/solve'

/*
  A part's report and a tool library in, the tools that make the part out, each with what it
  makes and how. Every step is the package's; this file only decides what to ask it and groups
  the answers by tool. Nothing here knows units: the page writes the words.
*/

/** One way a tool is used on the part: a step on one or more identical features. */
export interface ToolUse {
  /** How the step makes the feature: `drill`, `helical`, `mill`, `finish`, `chamfer`, `tap`… */
  way: Way
  /** The features it makes this way, by tag, and how matching reads the first of them. */
  tags: Array<string>
  reading: FeatureReading
  holder: Holder
  /** Null where the holder grips the shank itself. */
  collet: Collet | null
  /** How far the cutter stands out of the holder for this feature, mm. */
  stickout: number | null
  /** Why matching chose this assembly, as data: `reasonText` writes it. */
  reasons: ReadonlyArray<Reason>
}

/** A cutter the part needs, and every way it is used. */
export interface ToolUsage {
  key: string
  tool: Tool
  uses: Array<ToolUse>
}

/** A step no tool in the library makes, and why (`gapText` writes it). */
export interface Unmatched {
  way: Way | null
  tags: Array<string>
  reading: FeatureReading
  gap: Gap | null
}

export interface PartMatch {
  tools: Array<ToolUsage>
  unmatched: Array<Unmatched>
  /** The features the part needs tooled, after `coverage` drops the ones another feature cuts. */
  featureCount: number
}

/** Matching reads a library once: the cutters it matches, and each one's reach worked out. */
export const prepareLibrary = (library: ToolLibrary): MatchingLibrary =>
  withReach(matchable(library))

/** One step of making a feature: what it asks, and what the library answers. */
interface Step {
  requirement: Requirement
  result: SolveResult
}

/**
 * The steps that make one feature, as Tool Finder makes it by default: a tapped hole drilled (or,
 * where no drill does, milled) and then tapped; a plain hole drilled or helically milled,
 * whichever `approachRank` puts first; anything else milled.
 */
const stepsOf = (reading: FeatureReading, library: MatchingLibrary): Array<Step> => {
  const ask = (requirement: Requirement | null): Step | null =>
    requirement && { requirement, result: solve(requirement, { library, limit: 1 }) }
  const found = (step: Step | null) => (step?.result.solutions.length ?? 0) > 0
  const drilled = ask(drillRequirement(reading))
  const milled = ask(millRequirement(reading))

  if (reading.drill?.thread) {
    const hole = found(drilled) || !found(milled) ? drilled : milled
    const tap = ask({ approach: 'tap', hole: reading.drill })
    return [hole, tap].filter((step): step is Step => step !== null)
  }
  if (drilled && milled) {
    const rank = (step: Step, approach: 'drill' | 'mill') =>
      approachRank(approach, step.result, reading.drill) ?? Infinity
    return [rank(milled, 'mill') < rank(drilled, 'drill') ? milled : drilled]
  }
  const only = drilled ?? milled
  return only ? [only] : []
}

/** Features of one kind and size, made the same way with the same assembly, are one use. */
const useKey = (way: Way, assembly: string, reading: FeatureReading) =>
  [way, assembly, featureName(reading, 'mm')].join('|')

export const matchPart = (report: PartReport, library: MatchingLibrary): PartMatch => {
  // 1. Read every feature: what it asks of a drill, a tap or a mill.
  const readings = new Map(
    report.features.map((feature) => [
      feature.featureTag,
      readFeature(feature, report.directionZBounds),
    ]),
  )

  // 2. Keep the features the part needs tooled. The Engine reads one face as several features (a
  //    wall, the pocket it bounds, the profile round it) and a through hole from both ends;
  //    `coverage` keeps one of each, preferring features the library has tools for.
  const { included } = coverage(report.features, readings, {}, (tag) => {
    const reading = readings.get(tag)
    return reading !== undefined && hasTools(reading, { library })
  })

  // 3. Solve each step of each feature, and group the answers by tool.
  const tools = new Map<string, ToolUsage>()
  const uses = new Map<string, ToolUse>()
  const unmatched = new Map<string, Unmatched>()
  for (const tag of included) {
    const reading = readings.get(tag)!
    const steps = stepsOf(reading, library)
    if (steps.length === 0) {
      const key = useKey('mill', 'none', reading)
      const entry = unmatched.get(key) ?? { way: null, tags: [], reading, gap: null }
      entry.tags.push(tag)
      unmatched.set(key, entry)
    }
    for (const { requirement, result } of steps) {
      const way = mapRequirement(requirement).way
      const best = result.solutions[0]
      if (!best) {
        const key = useKey(way, 'none', reading)
        const entry = unmatched.get(key) ?? { way, tags: [], reading, gap: result.gap }
        entry.tags.push(tag)
        unmatched.set(key, entry)
        continue
      }
      const toolKey = keyOf(best.tool)
      const key = useKey(
        way,
        [best.tool, best.holder, best.collet].map((p) => p && keyOf(p)).join(),
        reading,
      )
      const existing = uses.get(key)
      if (existing) {
        existing.tags.push(tag)
        continue
      }
      const use: ToolUse = {
        way,
        tags: [tag],
        reading,
        holder: best.holder,
        collet: best.collet,
        stickout: stickoutIn(best, requirement, library.collets),
        reasons: best.reasons,
      }
      uses.set(key, use)
      const usage = tools.get(toolKey) ?? { key: toolKey, tool: best.tool, uses: [] }
      usage.uses.push(use)
      tools.set(toolKey, usage)
    }
  }

  return {
    tools: [...tools.values()].sort(
      (a, b) => kindOrder(a.tool) - kindOrder(b.tool) || a.tool.diameter - b.tool.diameter,
    ),
    unmatched: [...unmatched.values()],
    featureCount: included.length,
  }
}

/** Drills first, then end mills, then taps: roughly the order a shop runs them. */
const kindOrder = (tool: Tool) =>
  tool.kind === 'SpotDrill' ? 0 : tool.kind === 'DrillBit' ? 1 : tool.kind.endsWith('Tap') ? 3 : 2

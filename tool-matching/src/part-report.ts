import { PartFeaturesResponseFromJSON, PartResponseFromJSON } from '@toolpath/api'
import { withoutInvalid } from '@toolpath/tool-matching/invalid'
import { withDatasheets, type PartReport } from '@toolpath/tool-matching/part'

/** A part as the page holds it, a sample or an upload: what matching reads, and what the viewer draws. */
export interface LoadedPart {
  id: string
  name: string
  /** The report with its datasheets, less the features the analysis found can't be cut. */
  report: PartReport
  /** The report exactly as the API sent it, with its mesh pointed at the saved copy. */
  raw: unknown
  /** The features left out of `report`, which the viewer leaves out too. */
  suppressed: Array<string>
}

/**
 * A part report as matching reads it, from two API responses as JSON: the report
 * (`GET /v1/parts/{id}`) and its features' datasheets (`GET /v1/parts/{id}/features`), which the
 * report leaves out. Features the analysis found can't be cut are left out too.
 */
export const partReportOf = (
  report: unknown,
  features: unknown,
): { report: PartReport; suppressed: Array<string> } =>
  withoutInvalid(
    withDatasheets(PartResponseFromJSON(report), PartFeaturesResponseFromJSON(features).datasheets),
  )

const getJson = async (path: string): Promise<unknown> => {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`GET ${path}: ${response.status}`)
  return response.json()
}

/** The samples `scripts/analyze-samples.ts` saved: their names, from `public/parts/index.json`. */
export const listSamples = async () =>
  (await getJson('/parts/index.json')) as Array<{ slug: string; name: string }>

/** A part from its two responses, whether saved with the example or just analyzed. */
export const loadedPart = (
  id: string,
  name: string,
  raw: unknown,
  features: unknown,
): LoadedPart => ({
  id,
  name,
  raw,
  ...partReportOf(raw, features),
})

/** One saved sample, read as the page reads a part the API returns, its mesh the saved copy. */
export const loadSample = async ({ slug, name }: { slug: string; name: string }) => {
  const [json, features] = await Promise.all([
    getJson(`/parts/${slug}/report.json`),
    getJson(`/parts/${slug}/features.json`),
  ])
  return loadedPart(
    slug,
    name,
    { ...(json as object), meshGlbUrl: `/parts/${slug}/mesh.glb` },
    features,
  )
}

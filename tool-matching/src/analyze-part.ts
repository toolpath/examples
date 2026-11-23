import {
  UpdatePartOperationFeatureDetailsEnum,
  uploadToPresignedUrl,
  waitForJob,
  type createToolpathClient,
} from '@toolpath/api'

/*
  Every API call matching needs, in order: a CAD file in, the two responses matching reads out.
  The page calls it for an upload, and `scripts/analyze-samples.ts` for the samples it ships.
*/

type Client = ReturnType<typeof createToolpathClient>

/** What one analysis returns, as JSON exactly as the API sent it. */
export interface Analysis {
  /** `GET /v1/parts/{id}`: the features, regions, mesh and directions. */
  report: { meshGlbUrl: string | null; features: Array<{ featureId: string }> } & Record<
    string,
    unknown
  >
  /** `GET /v1/parts/{id}/features`: each feature's datasheet, which the report leaves out. */
  features: { datasheets: Array<unknown> }
}

/** The steps of an analysis, in order, as `analyzePart` reports each one starting. */
export const ANALYSIS_STEPS = [
  'Uploading the file',
  'Analyzing the part',
  'Reading the report',
] as const
export type AnalysisStep = (typeof ANALYSIS_STEPS)[number]

export const analyzePart = async (
  client: Client,
  file: { name: string; body: BodyInit },
  onStatus: (step: AnalysisStep) => void = () => {},
): Promise<Analysis> => {
  // 1. Create the part, and upload the file straight to the URL that returns.
  onStatus('Uploading the file')
  const created = await client.parts.createPart({ filename: file.name })
  await uploadToPresignedUrl(created.uploadUrl, file.body)

  // 2. Analyze it, and wait for the job. This is the billed step: one analysis per part.
  onStatus('Analyzing the part')
  const { jobId } = await client.parts.updatePart({
    id: created.partId,
    featureDetails: UpdatePartOperationFeatureDetailsEnum.True,
    idempotencyKey: crypto.randomUUID(),
  })
  await waitForJob(client, jobId)

  // 3. Read the report. The `Raw` call keeps the JSON as sent, as a saved sample keeps it.
  onStatus('Reading the report')
  const report = await (await client.parts.getPartRaw({ id: created.partId, jobId })).raw.json()

  // 4. Read the features' datasheets, at most 50 ids to a request.
  const ids = [...new Set(report.features.map((f: { featureId: string }) => f.featureId))]
  const datasheets: Array<unknown> = []
  for (let start = 0; start < ids.length; start += 50) {
    const response = await client.features.getPartFeaturesRaw({
      id: created.partId,
      ids: ids.slice(start, start + 50).join(','),
    })
    datasheets.push(...(await response.raw.json()).datasheets)
  }
  return { report, features: { datasheets } }
}

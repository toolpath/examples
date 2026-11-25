import {
  createToolpathClient,
  uploadToPresignedUrl,
  waitForJob,
  type PartResponse,
  type PlanResponse,
  type PlanSpec,
} from '@toolpath/api'

const apiKey = import.meta.env.VITE_TOOLPATH_API_KEY
// The same origin as this page: `vite.config.ts` forwards `/v1` to the Toolpath API.
const baseUrl = window.location.origin

const client = createToolpathClient({ apiKey, baseUrl })

/** A part's report, numbered by an analysis a plan spec can name. */
export type Part = PartResponse & { preparationId: string }

/** From a CAD file on disk to the part's analysis: its regions, its features and its `preparationId`. */
export const analyzePart = async (
  file: File,
  onStatus: (status: string) => void,
): Promise<Part> => {
  // 1. Create the part, and upload it straight to the URL that returns.
  onStatus('Uploading the part')
  const { partId, uploadUrl } = await client.parts.createPart({ filename: file.name })
  await uploadToPresignedUrl(uploadUrl, file)

  // 2. Analyze it, and read the report once the job succeeds.
  onStatus('Analyzing the part')
  const { jobId } = await client.parts.updatePart({ id: partId })
  await waitForJob(client, jobId)
  const part = await client.parts.getPart({ id: partId, jobId })
  // A plan spec names regions by the analysis that numbered them. Parts analyzed before plan specs
  // have none, and can only be planned by tag (`setupPlan`).
  const { preparationId } = part
  if (!preparationId) throw new Error('This part was analyzed without a preparationId')
  return { ...part, preparationId }
}

/** Plans the part as the plan spec states, and reads the plan back. */
export const planPart = async (
  partId: string,
  planSpec: PlanSpec,
  onStatus: (status: string) => void,
): Promise<PlanResponse> => {
  // 3. Ask for a plan. Everything left out of the request (material, tools, stock) is the default.
  onStatus('Planning the part')
  const { planId, jobId } = await client.plans.createPlan({
    id: partId,
    partJobRequest: { planSpec },
  })

  // 4. Read the plan once its job succeeds. A spec the kernel can't honor fails the job, and the
  // error says which statement, beginning `refused_plan_spec:`.
  await waitForJob(client, jobId)
  return client.plans.getPlan({ planId })
}

import {
  uploadToPresignedUrl,
  type PartJobRequest,
  type PartResponse,
  type PlanResponse,
  type ToolpathsResponse,
  type Vec3,
} from '@toolpath/api'

import type { ToolpathClient } from './client'

export interface SentPart {
  partId: string
  jobId: string
}

export const sendPart = async (
  client: ToolpathClient,
  fileName: string,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<SentPart> => {
  const part = await client.parts.createPart({ filename: fileName })
  // A bare PUT: the URL is the credential, so the API key is not sent to S3.
  await uploadToPresignedUrl(part.uploadUrl, bytes)
  const analysis = await client.parts.updatePart({
    id: part.partId,
    featureDetails: 'true',
    // A retry then starts (and bills) one analysis, not two.
    idempotencyKey: crypto.randomUUID(),
  })
  return { partId: part.partId, jobId: analysis.jobId }
}

// Raw JSON: the viewer wants the report as served, and directions must go back bit-exact.
export const getReport = async (
  client: ToolpathClient,
  partId: string,
  jobId: string,
): Promise<PartResponse> => {
  const response = await client.parts.getPartRaw({ id: partId, jobId })
  return (await response.raw.json()) as PartResponse
}

export const setupPlanFor = (
  directions: ReadonlyArray<Vec3>,
): NonNullable<PartJobRequest['setupPlan']> => ({
  setups: directions.map((direction) => ({ orientations: [{ direction, features: [] }] })),
})

export interface RequestedToolpaths {
  jobId: string
  planId: string
}

export const requestToolpaths = async (
  client: ToolpathClient,
  partId: string,
  directions: ReadonlyArray<Vec3>,
  options: Omit<PartJobRequest, 'setupPlan' | 'planSpec' | 'doneRegions'> = {},
): Promise<RequestedToolpaths> => {
  const queued = await client.toolpaths.createToolpaths({
    id: partId,
    idempotencyKey: crypto.randomUUID(),
    partJobRequest: { ...options, setupPlan: setupPlanFor(directions) },
  })
  return { jobId: queued.jobId, planId: queued.planId }
}

export interface Results {
  plan: PlanResponse
  toolpaths: ToolpathsResponse
}

export const getResults = async (client: ToolpathClient, planId: string): Promise<Results> => {
  const [plan, toolpaths] = await Promise.all([
    client.plans
      .getPlanRaw({ planId })
      .then((response) => response.raw.json() as Promise<PlanResponse>),
    client.toolpaths
      .getToolpathsRaw({ planId })
      .then((response) => response.raw.json() as Promise<ToolpathsResponse>),
  ])
  return { plan, toolpaths }
}

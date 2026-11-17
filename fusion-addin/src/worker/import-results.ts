import type { ToolpathAction, ToolpathsResponse } from '@toolpath/api'

import { getResults, type Results } from '@/api/cam'
import type { ToolpathClient } from '@/api/client'
import { fusionSend } from '@/fusion/bridge'
import type { ImportBegin, ImportSummary, ToolpathFile, WatchedJob } from '@/fusion/protocol'

export const buildImportBegin = (
  job: WatchedJob,
  importId: string,
  { plan, toolpaths }: Results,
): ImportBegin => {
  const actionsBySetup = new Map(toolpaths.setups.map((setup) => [setup.idx, setup.actions]))
  return {
    importId,
    jobId: job.jobId,
    partId: job.partId,
    planId: plan.planId,
    partName: job.bodyName,
    bodyToken: job.bodyToken,
    documentId: job.documentId,
    stock: plan.stock.resolved ?? null,
    setups: plan.setups.map((setup) => ({
      idx: setup.idx,
      direction: setup.direction,
      actions: (actionsBySetup.get(setup.idx) ?? []).map((action) => ({
        idx: action.idx,
        actionId: action.actionId,
        intent: action.intent,
        toolName: action.toolName,
        machiningTime: action.machiningTime,
      })),
    })),
  }
}

export const parseToolpath = (value: unknown): ToolpathFile | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const { frame, points, sections, segments } = value as Record<string, unknown>
  const ranges = sections ?? segments
  if (frame !== undefined || !Array.isArray(points) || !Array.isArray(ranges)) {
    return null
  }
  return { points: points as Array<number>, sections: ranges as ToolpathFile['sections'] }
}

const fetchToolpath = async (url: string): Promise<ToolpathFile | null> => {
  // A presigned S3 URL: no API key, and the gzip encoding is undone by the browser.
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Downloading a toolpath failed (HTTP ${response.status}).`)
  }
  return parseToolpath(await response.json())
}

const findAction = (
  toolpaths: ToolpathsResponse,
  setupIdx: number,
  actionIdx: number,
): ToolpathAction | undefined =>
  toolpaths.setups
    .find((setup) => setup.idx === setupIdx)
    ?.actions.find((action) => action.idx === actionIdx)

export const importResults = async (
  client: ToolpathClient,
  job: WatchedJob,
): Promise<ImportSummary> => {
  if (!job.planId) {
    throw new Error('This job has no plan to import.')
  }
  const results = await getResults(client, job.planId)
  const importId = crypto.randomUUID()
  const begin = buildImportBegin(job, importId, results)
  await fusionSend('importBegin', begin)

  let toolpaths = results.toolpaths
  for (const setup of begin.setups) {
    if (!setup.direction) {
      // The add-in leaves setups without a direction out; don't download their paths.
      continue
    }
    for (const { idx } of setup.actions) {
      const url = findAction(toolpaths, setup.idx, idx)?.toolpathUrl
      let toolpath: ToolpathFile | null = null
      if (url) {
        try {
          toolpath = await fetchToolpath(url)
        } catch {
          // Toolpath URLs last 15 minutes; a long import can outlive them. Read fresh ones once.
          toolpaths = (await getResults(client, job.planId)).toolpaths
          const fresh = findAction(toolpaths, setup.idx, idx)?.toolpathUrl
          toolpath = fresh ? await fetchToolpath(fresh) : null
        }
      }
      await fusionSend('importAction', { importId, setupIdx: setup.idx, actionIdx: idx, toolpath })
    }
  }
  return (await fusionSend('importEnd', { importId })).summary
}

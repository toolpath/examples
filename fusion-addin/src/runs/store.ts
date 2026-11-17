import { fusionSend, isInFusion } from '@/fusion/bridge'
import type { Run } from '@/fusion/protocol'

// In Fusion the add-in keeps runs as files; in a browser they live in localStorage.
const BROWSER_KEY = 'toolpath-cam:runs'

const readBrowser = (): Record<string, Run> => {
  try {
    return JSON.parse(localStorage.getItem(BROWSER_KEY) ?? '{}') as Record<string, Run>
  } catch {
    return {}
  }
}

export const writeBrowserRuns = (runs: Record<string, Run>) =>
  localStorage.setItem(BROWSER_KEY, JSON.stringify(runs))

export const listRuns = async (): Promise<Array<Run>> =>
  isInFusion() ? (await fusionSend('listRuns')).runs : Object.values(readBrowser())

export const saveRun = async (run: Run): Promise<Run> => {
  if (isInFusion()) {
    const { jobs: _jobs, ...fields } = run
    return (await fusionSend('saveRun', { run: fields })).run
  }
  return run
}

export const deleteRun = async (runId: string) => {
  if (isInFusion()) {
    await fusionSend('deleteRun', { runId })
  }
}

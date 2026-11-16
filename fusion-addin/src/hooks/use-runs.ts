import { useCallback, useEffect, useMemo, useState } from 'react'

import type { ToolpathClient } from '@/api/client'
import { fusionSend, isInFusion, onFusionEvent } from '@/fusion/bridge'
import type { Run, WatchedJob } from '@/fusion/protocol'
import { upsertJob } from '@/runs/runs'
import { deleteRun, listRuns, saveRun, writeBrowserRuns } from '@/runs/store'
import { JobWatcher } from '@/worker/job-watcher'

// In Fusion the worker palette polls; in a browser this page does, without importing.
export const useRuns = (client: ToolpathClient | null, apiUrl: string) => {
  const [runs, setRuns] = useState<Record<string, Run> | null>(null)

  const localWatcher = useMemo(
    () =>
      isInFusion()
        ? null
        : new JobWatcher({
            apiUrl,
            report: (update) => setRuns((current) => current && upsertJob(current, update)),
          }),
    [apiUrl],
  )

  useEffect(() => {
    void listRuns().then((list) => {
      setRuns(Object.fromEntries(list.map((run) => [run.runId, run])))
      list.flatMap((run) => run.jobs).forEach((job) => localWatcher?.watch(job))
    })
  }, [localWatcher])

  useEffect(() => {
    if (runs && !isInFusion()) {
      writeBrowserRuns(runs)
    }
  }, [runs])

  useEffect(
    () =>
      onFusionEvent((event) => {
        if (event.action === 'jobUpdated' || event.action === 'importCompleted') {
          const { job } = event.data
          setRuns((current) => current && upsertJob(current, job))
        }
      }),
    [],
  )

  useEffect(() => {
    localWatcher?.setClient(client)
    return () => localWatcher?.stop()
  }, [localWatcher, client])

  const save = useCallback(async (run: Run) => {
    const saved = await saveRun(run)
    setRuns((current) => ({ ...current, [saved.runId]: saved }))
    return saved
  }, [])

  const watch = useCallback(
    async (job: WatchedJob) => {
      setRuns((current) => current && upsertJob(current, job))
      if (localWatcher) {
        localWatcher.watch(job)
      } else {
        await fusionSend('watchJob', { job })
      }
    },
    [localWatcher],
  )

  const remove = useCallback(async (runId: string) => {
    await deleteRun(runId)
    setRuns((current) => {
      if (!current) {
        return current
      }
      const { [runId]: _removed, ...rest } = current
      return rest
    })
  }, [])

  const retryImport = useCallback(async (jobId: string) => {
    const { job } = await fusionSend('retryImport', { jobId })
    setRuns((current) => current && upsertJob(current, job))
  }, [])

  return { runs, save, watch, remove, retryImport }
}

import { createClient } from '@/api/client'
import { fusionSend, onFusionEvent, waitForFusion } from '@/fusion/bridge'
import type { FusionEvent } from '@/fusion/protocol'

import { importResults } from './import-results'
import { JobWatcher } from './job-watcher'

// The hidden palette: polls every job the add-in knows about and imports finished toolpaths.
export const startWorker = async () => {
  // Listen first: events that arrive while the context loads are replayed once it has.
  const early: Array<FusionEvent> = []
  let handle = (event: FusionEvent) => {
    early.push(event)
  }
  onFusionEvent((event) => handle(event))

  if (!(await waitForFusion())) {
    console.warn('The worker palette only runs inside Fusion.')
    return
  }
  const context = await fusionSend('getContext')
  const watcher = new JobWatcher({
    apiUrl: context.apiUrl,
    report: (job) => fusionSend('jobUpdate', { job }),
    importResults,
  })
  const setKey = (apiKey: string | null | undefined) =>
    watcher.setClient(apiKey ? createClient(apiKey, context.apiUrl) : null)

  handle = (event) => {
    if (event.action === 'watchJob') {
      watcher.watch(event.data.job)
    } else if (event.action === 'apiKeyChanged') {
      setKey(event.data.apiKey)
    }
  }
  context.jobs.forEach((job) => watcher.watch(job))
  setKey(context.apiKey)
  early.splice(0).forEach(handle)
  void fusionSend('log', `worker ready, watching ${context.jobs.length} job(s)`)
}

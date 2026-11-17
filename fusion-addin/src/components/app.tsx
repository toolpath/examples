import type { Vec3 } from '@toolpath/api'
import { SignOutIcon } from '@phosphor-icons/react'
import { IconButton, Tooltip } from '@toolpath/ui'
import { useEffect, useMemo, useRef, useState } from 'react'

import { getReport, requestToolpaths, sendPart } from '@/api/cam'
import { createClient, describeError } from '@/api/client'
import { base64ToBytes, fusionSend, isInFusion } from '@/fusion/bridge'
import type { FusionDocument, Run, WatchedJob } from '@/fusion/protocol'
import { useApiKey } from '@/hooks/use-api-key'
import { useDarkMode } from '@/hooks/use-dark-mode'
import { useFusion } from '@/hooks/use-fusion'
import { useRuns } from '@/hooks/use-runs'
import { resumeStep, stepForRun, type Step } from '@/lib/steps'
import { latestJob } from '@/runs/runs'

import { ApiKeyScreen } from './api-key-screen'
import { BodyStep, type ChosenBody } from './body-step'
import { DirectionsStep } from './directions-step'
import { ErrorText } from './error-text'
import { ResultsStep } from './results-step'
import { RunList } from './run-list'

const DEFAULT_API_URL = import.meta.env.VITE_API_URL ?? 'https://api.toolpath.com'
const DEFAULT_PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? 'https://portal.toolpath.com'

export const App = () => {
  const { state } = useFusion()
  useDarkMode(state.status === 'ready' ? state.theme : null)

  const context = state.status === 'ready' ? state.context : null
  return (
    // Our own background on a full-size wrapper; Fusion's palette shows through html and body.
    <div
      id="app"
      className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 font-body text-gray-700 antialiased dark:bg-zinc-950 dark:text-zinc-100"
    >
      {state.status === 'error' && (
        <div className="p-4">
          <ErrorText>Toolpath CAM couldn't talk to Fusion: {state.error}</ErrorText>
        </div>
      )}
      {(state.status === 'ready' || state.status === 'browser') && (
        <Connected
          apiUrl={context?.apiUrl ?? DEFAULT_API_URL}
          portalUrl={context?.portalUrl ?? DEFAULT_PORTAL_URL}
          document={state.status === 'ready' ? state.document : null}
        />
      )}
    </div>
  )
}

interface ConnectedProps {
  apiUrl: string
  portalUrl: string
  /** Null in a browser. */
  document: FusionDocument | null
}

const Connected = ({ apiUrl, portalUrl, document }: ConnectedProps) => {
  const { apiKey, save, clear } = useApiKey(apiUrl)
  const client = useMemo(() => (apiKey ? createClient(apiKey, apiUrl) : null), [apiKey, apiUrl])
  const { runs, save: saveRun, watch, remove, retryImport } = useRuns(client, apiUrl)
  const [step, setStep] = useState<Step>({ name: 'body' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resumed = useRef(false)
  useEffect(() => {
    if (runs && !resumed.current) {
      resumed.current = true
      setStep(resumeStep(Object.values(runs)))
    }
  }, [runs])

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (e) {
      setError(await describeError(e, apiUrl))
    } finally {
      setBusy(false)
    }
  }

  const current = step.name === 'body' ? undefined : runs?.[step.runId]
  const analysisJob =
    current && step.name === 'analyzing' ? latestJob(current, 'analysis') : undefined
  const runId = current?.runId
  const partId = current?.partId
  const analysisJobId = analysisJob?.status === 'succeeded' ? analysisJob.jobId : undefined
  useEffect(() => {
    if (!runId || !partId || !analysisJobId || !client) {
      return
    }
    let cancelled = false
    getReport(client, partId, analysisJobId).then(
      (report) => {
        if (!cancelled) {
          setStep({ name: 'directions', runId, report })
        }
      },
      async (e: unknown) => {
        const message = await describeError(e, apiUrl)
        if (!cancelled) {
          setError(message)
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [runId, partId, analysisJobId, client, apiUrl])

  if (!client) {
    return <ApiKeyScreen apiUrl={apiUrl} portalUrl={portalUrl} onSave={save} />
  }

  const newJob = (
    target: Run,
    fields: Pick<WatchedJob, 'jobId' | 'kind'> & Partial<WatchedJob>,
  ): WatchedJob => ({
    runId: target.runId,
    partId: target.partId ?? '',
    bodyToken: target.bodyToken,
    bodyName: target.bodyName,
    documentId: target.documentId,
    status: 'queued',
    progress: null,
    error: null,
    createdAt: new Date().toISOString(),
    ...fields,
  })

  const analyze = (body: ChosenBody) =>
    run(async () => {
      const file = body.file ?? (await exportFromFusion(body.token))
      const sent = await sendPart(client, file.fileName, file.bytes)
      const saved = await saveRun({
        runId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        bodyName: body.name,
        bodyToken: body.token,
        documentId: document?.id ?? null,
        documentName: document?.name ?? null,
        partId: sent.partId,
        jobs: [],
      })
      await watch(newJob(saved, { jobId: sent.jobId, kind: 'analysis' }))
      setStep({ name: 'analyzing', runId: saved.runId })
    })

  const machine = (directions: Array<Vec3>) =>
    run(async () => {
      if (step.name !== 'directions' || !current?.partId) {
        return
      }
      const queued = await requestToolpaths(client, current.partId, directions)
      await watch(
        newJob(current, {
          jobId: queued.jobId,
          kind: 'toolpaths',
          planId: queued.planId,
          directions,
        }),
      )
      setStep({ name: 'toolpaths', runId: current.runId, jobId: queued.jobId })
    })

  const open = (target: Run) => {
    setError(null)
    setStep(stepForRun(target))
  }

  const startOver = () => {
    setError(null)
    setStep({ name: 'body' })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="font-display text-sm font-semibold text-gray-500 dark:text-zinc-100">
          Toolpath CAM
        </h1>
        <Tooltip tip="Sign out">
          <IconButton onClick={clear} aria-label="Sign out">
            <SignOutIcon className="size-4 text-gray-400 dark:text-zinc-400" />
          </IconButton>
        </Tooltip>
      </header>
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {(step.name === 'body' || step.name === 'analyzing') && (
          <BodyStep
            document={document}
            job={analysisJob}
            busy={busy || step.name === 'analyzing'}
            onAnalyze={(body) => void analyze(body)}
            onCancel={step.name === 'analyzing' ? startOver : undefined}
          />
        )}
        {step.name === 'directions' && current && (
          <DirectionsStep
            report={step.report}
            initial={latestJob(current, 'toolpaths')?.directions}
            busy={busy}
            onMachine={(directions) => void machine(directions)}
            onBack={startOver}
          />
        )}
        {step.name === 'toolpaths' && current && (
          <ResultsStep
            job={current.jobs.find((job) => job.jobId === step.jobId)}
            inFusion={isInFusion()}
            onChangeDirections={() => setStep({ name: 'analyzing', runId: current.runId })}
            onRetryImport={(jobId) => void run(() => retryImport(jobId))}
            onStartOver={startOver}
          />
        )}
        {error && <ErrorText>{error}</ErrorText>}
        {step.name === 'body' && runs && (
          <RunList
            runs={Object.values(runs)}
            onOpen={open}
            onDelete={(target) => void run(() => remove(target.runId))}
          />
        )}
      </main>
    </div>
  )
}

const exportFromFusion = async (token: string) => {
  const exported = await fusionSend('exportBody', { token })
  return { fileName: exported.fileName, bytes: base64ToBytes(exported.data) }
}

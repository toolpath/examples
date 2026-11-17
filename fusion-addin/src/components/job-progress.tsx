import { Badge, ProgressBar } from '@toolpath/ui'
import type { ReactNode } from 'react'

import type { WatchedJob } from '@/fusion/protocol'

import { ErrorText } from './error-text'

export type StatusBadge = { label: string; variant: 'secondary' | 'info' | 'success' | 'danger' }

const STATUS: Record<WatchedJob['status'], StatusBadge> = {
  queued: { label: 'Queued', variant: 'secondary' },
  running: { label: 'Running', variant: 'info' },
  succeeded: { label: 'Done', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
}

/** A step's title, with its job's status beside it. */
export const StepTitle = ({
  children,
  job,
  status,
}: {
  children: ReactNode
  job?: WatchedJob
  status?: StatusBadge
}) => {
  const badge = status ?? (job ? STATUS[job.status] : null)
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-zinc-100">{children}</h2>
      {badge && (
        <Badge variant={badge.variant}>
          {badge.label}
          {job?.status === 'running' && job.progress !== null && ` ${Math.round(job.progress)}%`}
        </Badge>
      )}
    </div>
  )
}

/** The bar while a job runs, then its error if it has one. */
export const JobProgress = ({
  job,
  error = job.error,
}: {
  job: WatchedJob
  error?: string | null
}) => (
  <>
    {(job.status === 'queued' || job.status === 'running') && (
      <ProgressBar size="sm" progress={Math.max(job.progress ?? 0, 2)} />
    )}
    {error && <ErrorText>{error}</ErrorText>}
  </>
)

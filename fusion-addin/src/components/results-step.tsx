import { Button, Card } from '@toolpath/ui'

import type { WatchedJob } from '@/fusion/protocol'

import { JobProgress, StepTitle, type StatusBadge } from './job-progress'

interface Props {
  job: WatchedJob | undefined
  inFusion: boolean
  onChangeDirections: () => void
  onRetryImport: (jobId: string) => void
  onStartOver: () => void
}

// Once the toolpaths are calculated, the import is what the badge reports.
const importState = (job: WatchedJob): { status?: StatusBadge; error?: string | null } => {
  if (job.status !== 'succeeded') {
    return {}
  }
  switch (job.importStatus) {
    case 'importing':
      return { status: { label: 'Importing', variant: 'info' }, error: null }
    case 'imported':
      return { status: { label: 'Imported', variant: 'success' }, error: null }
    case 'failed':
      return { status: { label: 'Import failed', variant: 'danger' }, error: job.importError }
    default:
      return { error: null }
  }
}

export const ResultsStep = ({
  job,
  inFusion,
  onChangeDirections,
  onRetryImport,
  onStartOver,
}: Props) => {
  const summary = job?.importSummary
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <StepTitle job={job} status={job ? importState(job).status : undefined}>
          CAM results
        </StepTitle>
        {job && <JobProgress job={job} error={importState(job).error} />}
        {job?.status === 'succeeded' && !inFusion && (
          <p className="text-xs text-gray-400">Import needs Fusion.</p>
        )}
        {job?.importStatus === 'imported' && summary && (
          <div className="text-xs text-gray-500 dark:text-zinc-300">
            <p>
              Imported {summary.setups} setups and {summary.actions} toolpaths.
            </p>
            {summary.thinned && <p className="mt-1 text-gray-400">Long toolpaths were thinned.</p>}
            {summary.warnings.map((warning) => (
              <p key={warning} className="mt-1 text-gray-400 dark:text-zinc-400">
                {warning}
              </p>
            ))}
          </div>
        )}
        {inFusion && job?.importStatus === 'failed' && (
          <Button variant="success" onClick={() => onRetryImport(job.jobId)} full>
            Import again
          </Button>
        )}
        <Button variant="secondary" onClick={onChangeDirections} full>
          Change directions
        </Button>
        <Button variant="secondary" onClick={onStartOver} full>
          Start over
        </Button>
      </div>
    </Card>
  )
}

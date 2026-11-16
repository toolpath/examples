import { TrashIcon } from '@phosphor-icons/react'
import { Badge, Card, IconButton, Tooltip } from '@toolpath/ui'

import type { Run } from '@/fusion/protocol'
import { runStatus } from '@/runs/runs'

const BADGE = { muted: 'secondary', info: 'info', success: 'success', danger: 'danger' } as const

interface Props {
  runs: ReadonlyArray<Run>
  onOpen: (run: Run) => void
  onDelete: (run: Run) => void
}

export const RunList = ({ runs, onOpen, onDelete }: Props) => {
  if (runs.length === 0) {
    return null
  }
  const sorted = [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <Card>
      <div className="flex flex-col gap-1 p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-500 dark:text-zinc-100">Past runs</h2>
        {sorted.map((run) => {
          const status = runStatus(run)
          return (
            <div
              key={run.runId}
              className="group flex items-center gap-1 rounded pr-1 hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              <button
                type="button"
                onClick={() => onOpen(run)}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-xs"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-500 dark:text-zinc-200">
                    {run.bodyName}
                  </span>
                  <span className="block truncate text-gray-300 dark:text-zinc-500">
                    {[run.documentName, new Date(run.createdAt).toLocaleString()]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Badge variant={BADGE[status.tone]}>{status.label}</Badge>
              </button>
              <Tooltip tip="Delete run">
                <IconButton
                  size="md"
                  onClick={() => onDelete(run)}
                  aria-label={`Delete ${run.bodyName}`}
                >
                  <TrashIcon className="size-4 text-gray-300 group-hover:text-gray-500 dark:text-zinc-500 dark:group-hover:text-zinc-300" />
                </IconButton>
              </Tooltip>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

import { Button, Card } from '@toolpath/ui'
import { type ChangeEvent, useState } from 'react'

import type { FusionDocument, WatchedJob } from '@/fusion/protocol'

import { JobProgress, StepTitle } from './job-progress'
import { SelectBody, type SelectedBody } from './select-body'

export interface ChosenBody {
  /** The Fusion body's entity token; empty for a file chosen in a browser. */
  token: string
  name: string
  /** A file picked in a browser; inside Fusion the body is exported instead. */
  file?: { fileName: string; bytes: Uint8Array<ArrayBuffer> }
}

interface Props {
  document: FusionDocument | null
  job: WatchedJob | undefined
  busy: boolean
  onAnalyze: (body: ChosenBody) => void
  onCancel?: () => void
}

const CAD_EXTENSIONS = '.step,.stp,.x_t,.x_b,.sldprt,.catpart,.prt,.igs,.iges,.ipt,.par,.sat,.3dm'

// A body already selected when the panel opens starts out picked, as in Fusion's own inputs.
const preselected = (document: FusionDocument | null): SelectedBody | null => {
  const body = document?.bodies?.find((candidate) => candidate.token === document.selectedBodyToken)
  return body ? { token: body.token, name: body.name } : null
}

export const BodyStep = ({ document, job, busy, onAnalyze, onCancel }: Props) => {
  const [body, setBody] = useState<SelectedBody | null>(() => preselected(document))
  const [file, setFile] = useState<ChosenBody['file'] | null>(null)

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    setFile(
      picked ? { fileName: picked.name, bytes: new Uint8Array(await picked.arrayBuffer()) } : null,
    )
  }

  const chosen: ChosenBody | null = document
    ? body
    : file
      ? { token: '', name: file.fileName, file }
      : null

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <StepTitle job={job}>Feature analysis</StepTitle>
        {document ? (
          !document.hasDocument || !document.isDesign ? (
            <p className="text-xs text-gray-400">Open a design to begin.</p>
          ) : (
            <div className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-right text-xs font-semibold text-gray-500 dark:text-zinc-300">
                Body
              </span>
              <SelectBody value={body} onValueChange={setBody} disabled={busy} />
            </div>
          )
        ) : (
          <input
            type="file"
            accept={CAD_EXTENSIONS}
            disabled={busy}
            onChange={(event) => void chooseFile(event)}
            className="text-xs"
          />
        )}
        {job ? (
          <JobProgress job={job} />
        ) : (
          <Button
            variant="success"
            disabled={!chosen}
            isLoading={busy}
            onClick={() => chosen && onAnalyze(chosen)}
            full
          >
            Analyze features
          </Button>
        )}
        {job && onCancel && (job.status === 'failed' || job.error) && (
          <Button variant="secondary" onClick={onCancel} full>
            Start over
          </Button>
        )}
      </div>
    </Card>
  )
}

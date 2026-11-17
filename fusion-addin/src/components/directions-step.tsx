import type { PartResponse, Vec3 } from '@toolpath/api'
import { Button, Card, Checkbox } from '@toolpath/ui'
import { directionColor, directionLabel } from '@toolpath/viewer'
import { useState } from 'react'

import { directionIndices } from '@/runs/runs'

import { DirectionViewer } from './direction-viewer'

interface Props {
  report: PartResponse
  /** Directions of the run's last request, picked again on revisit. */
  initial?: ReadonlyArray<Vec3> | null
  busy: boolean
  onMachine: (directions: Array<Vec3>) => void
  onBack: () => void
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`

export const DirectionsStep = ({ report, initial, busy, onMachine, onBack }: Props) => {
  const directions = report.candidateDirections
  // Pick order is setup order.
  const [picked, setPicked] = useState<Array<number>>(() => directionIndices(directions, initial))
  const [focused, setFocused] = useState<number | null>(null)

  const toggle = (index: number) =>
    setPicked((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index],
    )

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-zinc-100">
          Machining directions
        </h2>
        <DirectionViewer report={report} picked={picked} focused={focused} onPick={toggle} />
        <ul className="flex flex-col gap-1" onMouseLeave={() => setFocused(null)}>
          {directions.map((direction, index) => {
            const order = picked.indexOf(index)
            return (
              <li
                key={index}
                className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-zinc-800"
                onMouseEnter={() => setFocused(index)}
              >
                <Checkbox
                  name={`direction-${index}`}
                  checked={order >= 0}
                  onChange={() => toggle(index)}
                  size="sm"
                />
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: hex(directionColor(index)) }}
                />
                <span className="flex-1 font-mono">{directionLabel(direction)}</span>
                {order >= 0 && <span className="text-gray-400">Setup {order + 1}</span>}
              </li>
            )
          })}
        </ul>
        <Button
          variant="success"
          disabled={picked.length === 0}
          isLoading={busy}
          onClick={() => onMachine(picked.map((index) => directions[index]!))}
          full
        >
          Get CAM results
        </Button>
        <Button variant="secondary" onClick={onBack} disabled={busy} full>
          Back
        </Button>
      </div>
    </Card>
  )
}

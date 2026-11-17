import type { PartResponse } from '@toolpath/api'
import { DirectionArrows, PartMesh, Viewer, directionHighlights } from '@toolpath/viewer'
import { useMemo } from 'react'

import { usePartGeometry } from '@/hooks/use-part-geometry'

interface Props {
  report: PartResponse
  picked: ReadonlyArray<number>
  focused: number | null
  onPick: (index: number) => void
}

export const DirectionViewer = ({ report, picked, focused, onPick }: Props) => {
  const geometry = usePartGeometry(report)
  const highlights = useMemo(
    () => (geometry.status === 'ready' ? directionHighlights(geometry.model, focused) : []),
    [geometry, focused],
  )

  return (
    <div className="relative h-64 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 dark:border-zinc-700/50 dark:bg-zinc-950">
      {geometry.status === 'loading' && <Message>Loading part…</Message>}
      {geometry.status === 'error' && <Message>The part preview couldn't load.</Message>}
      {geometry.status === 'ready' && (
        <Viewer className="h-full w-full" controls="toolpath" theme={{ background: null }}>
          <PartMesh
            model={geometry.model}
            geometry={geometry.geometry}
            regionHighlights={highlights}
            showEdges
          />
          <DirectionArrows
            directions={geometry.model.candidateDirections}
            shownDirection={focused ?? (picked.length > 0 ? picked : null)}
            onPickDirection={onPick}
          />
        </Viewer>
      )}
    </div>
  )
}

const Message = ({ children }: { children: string }) => (
  <div className="flex h-full items-center justify-center p-4 text-xs text-gray-300 dark:text-zinc-400">
    {children}
  </div>
)

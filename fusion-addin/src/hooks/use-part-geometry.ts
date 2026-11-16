import type { PartResponse } from '@toolpath/api'
import type { PartModel } from '@toolpath/viewer'
import { engineGeometryCache, normalizePartReport } from '@toolpath/viewer/engine'
import { useEffect, useMemo, useState } from 'react'
import type { BufferGeometry } from 'three'

export type PartGeometryState =
  | { status: 'loading' }
  | { status: 'ready'; model: PartModel; geometry: BufferGeometry }
  | { status: 'error'; error: Error }

export const usePartGeometry = (report: PartResponse): PartGeometryState => {
  const model = useMemo(() => normalizePartReport(report), [report])
  const [state, setState] = useState<PartGeometryState>({ status: 'loading' })

  useEffect(() => {
    const resource = engineGeometryCache.get(model)
    engineGeometryCache.retain(resource)
    let active = true
    const settle = () => {
      if (!active) {
        return
      }
      if (resource.status === 'fulfilled') {
        setState({ status: 'ready', model, geometry: resource.geometry! })
      } else if (resource.status === 'rejected') {
        setState({ status: 'error', error: resource.error! })
      }
    }
    if (resource.status === 'pending') {
      setState({ status: 'loading' })
      void resource.promise.then(settle)
    } else {
      settle()
    }
    return () => {
      active = false
      engineGeometryCache.release(resource)
    }
  }, [model])

  return state
}

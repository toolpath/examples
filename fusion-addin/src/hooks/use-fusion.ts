import { useEffect, useState } from 'react'

import { fusionSend, onFusionEvent, waitForFusion } from '@/fusion/bridge'
import type { FusionContext, FusionDocument } from '@/fusion/protocol'

export type FusionState =
  | { status: 'connecting' }
  /** Outside Fusion, e.g. `pnpm dev` in a browser: upload a file instead of exporting a body. */
  | { status: 'browser' }
  | { status: 'error'; error: string }
  | {
      status: 'ready'
      context: FusionContext
      document: FusionDocument
      theme: FusionContext['theme']
    }

export const useFusion = () => {
  const [state, setState] = useState<FusionState>({ status: 'connecting' })

  useEffect(() => {
    let cancelled = false
    const connect = async () => {
      if (!(await waitForFusion())) {
        return setState({ status: 'browser' })
      }
      const context = await fusionSend('getContext')
      if (!cancelled) {
        setState({ status: 'ready', context, document: context.document, theme: context.theme })
      }
    }
    connect().catch((error: unknown) => {
      if (!cancelled) {
        setState({ status: 'error', error: error instanceof Error ? error.message : String(error) })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () =>
      onFusionEvent((event) => {
        setState((current) => {
          if (current.status !== 'ready') {
            return current
          }
          if (event.action === 'documentChanged') {
            return { ...current, document: event.data }
          }
          if (event.action === 'themeChanged') {
            return { ...current, theme: event.data.theme }
          }
          return current
        })
      }),
    [],
  )

  return { state }
}

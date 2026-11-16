import type { FusionEvent, RequestMap, ResponseMap, Role } from './protocol'

declare global {
  interface Window {
    adsk?: { fusionSendData: (action: string, data: string) => Promise<string> }
    fusionJavaScriptHandler?: { handle: (action: string, data: string) => string }
  }
}

const ADSK_WAIT_MS = 5000

/** Which palette this page is: the add-in loads both from one build, `?role=main|worker`. */
export const paletteRole = (search = window.location.search): Role =>
  new URLSearchParams(search).get('role') === 'worker' ? 'worker' : 'main'

export const waitForFusion = (): Promise<boolean> =>
  new Promise((resolve) => {
    const started = Date.now()
    const check = () => {
      if (window.adsk?.fusionSendData) {
        return resolve(true)
      }
      if (Date.now() - started > ADSK_WAIT_MS) {
        return resolve(false)
      }
      setTimeout(check, 50)
    }
    check()
  })

export const isInFusion = (): boolean => !!window.adsk?.fusionSendData

export const fusionSend = async <A extends keyof RequestMap>(
  action: A,
  ...[data]: RequestMap[A] extends undefined ? [] : [RequestMap[A]]
): Promise<ResponseMap[A]> => {
  if (!window.adsk?.fusionSendData) {
    throw new Error('Not running inside Fusion.')
  }

  const payload = data === undefined ? '' : typeof data === 'string' ? data : JSON.stringify(data)
  const raw = await window.adsk.fusionSendData(action, payload)
  const parsed: unknown = raw ? JSON.parse(raw) : {}

  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    throw new Error(String((parsed as { error: unknown }).error))
  }
  return parsed as ResponseMap[A]
}

type Listener = (event: FusionEvent) => void
const listeners = new Set<Listener>()

/** Python pushes events with `palette.sendInfoToHTML`; they land here. */
window.fusionJavaScriptHandler = {
  handle: (action, data) => {
    try {
      const event = { action, data: JSON.parse(data) } as FusionEvent
      listeners.forEach((listener) => listener(event))
    } catch (error) {
      console.error('Bad event from Fusion', action, error)
    }
    return 'OK'
  },
}

export const onFusionEvent = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const base64ToBytes = (base64: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export const openExternal = (url: string) => {
  if (isInFusion()) {
    void fusionSend('openExternal', url)
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

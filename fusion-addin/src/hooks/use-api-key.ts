import { useCallback, useEffect, useState } from 'react'

import { fusionSend, isInFusion } from '@/fusion/bridge'

export const useApiKey = (apiUrl: string) => {
  const storageKey = `toolpath-cam:api-key:${apiUrl}`
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem(storageKey))

  useEffect(() => setApiKey(localStorage.getItem(storageKey)), [storageKey])

  useEffect(() => {
    if (isInFusion()) {
      void fusionSend('setApiKey', { apiKey })
    }
  }, [apiKey])

  const save = useCallback(
    (key: string) => {
      localStorage.setItem(storageKey, key)
      setApiKey(key)
    },
    [storageKey],
  )

  const clear = useCallback(() => {
    localStorage.removeItem(storageKey)
    setApiKey(null)
  }, [storageKey])

  return { apiKey, save, clear }
}

import { Button, Card, Input } from '@toolpath/ui'
import { type FormEvent, useState } from 'react'

import { checkKey, createClient, describeError } from '@/api/client'
import { openExternal } from '@/fusion/bridge'

import { ErrorText } from './error-text'

interface Props {
  apiUrl: string
  portalUrl: string
  onSave: (key: string) => void
}

export const ApiKeyScreen = ({ apiUrl, portalUrl, onSave }: Props) => {
  const [key, setKey] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) {
      return
    }
    setChecking(true)
    setError(null)
    try {
      await checkKey(createClient(trimmed, apiUrl))
      onSave(trimmed)
    } catch (e) {
      setError(await describeError(e, apiUrl))
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="p-3">
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-6">
          <h1 className="font-display text-lg font-semibold text-gray-500 dark:text-zinc-100">
            Connect to Toolpath
          </h1>
          <Input
            id="api-key"
            name="api-key"
            type="password"
            autoComplete="off"
            placeholder="API key"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            invalid={!!error}
            autoFocus
          />
          {error && <ErrorText>{error}</ErrorText>}
          <Button type="submit" variant="success" isLoading={checking} disabled={!key.trim()} full>
            Continue
          </Button>
          <button
            type="button"
            className="text-xs font-semibold text-info"
            onClick={() => openExternal(`${portalUrl}/keys`)}
          >
            Get an API key
          </button>
        </form>
      </Card>
    </div>
  )
}

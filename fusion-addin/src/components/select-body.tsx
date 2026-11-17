import { CursorIcon, XIcon } from '@phosphor-icons/react'
import { Button, IconButton, Tooltip, cn } from '@toolpath/ui'
import { useEffect, useState } from 'react'

import { fusionSend, onFusionEvent } from '@/fusion/bridge'

export interface SelectedBody {
  token: string
  name: string
}

interface Props {
  value: SelectedBody | null
  onValueChange: (value: SelectedBody | null) => void
  disabled?: boolean
}

/** Like a Fusion selection input: click it, then pick a body in the canvas. */
export const SelectBody = ({ value, onValueChange, disabled = false }: Props) => {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!active) {
      return
    }
    return onFusionEvent((event) => {
      if (event.action === 'bodySelected') {
        onValueChange(event.data)
        setActive(false)
      }
    })
  }, [active, onValueChange])

  // Leaving the panel mid-pick hands Fusion's selection back.
  useEffect(
    () => () => {
      void fusionSend('disableBodySelection')
    },
    [],
  )

  const toggle = async () => {
    const next = !active
    setActive(next)
    try {
      await fusionSend(next ? 'enableBodySelection' : 'disableBodySelection')
    } catch {
      setActive(false)
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <Tooltip tip="Click a body in the canvas" side="bottom" sideOffset={10} delay={1000}>
        <div className="inline-block min-w-0">
          <Button
            variant={active ? 'info' : 'secondary'}
            onClick={() => void toggle()}
            disabled={disabled}
            className={cn('flex min-w-0 items-center gap-1 pl-2', { 'border border-info': active })}
          >
            <CursorIcon
              className={cn('size-3 shrink-0 text-gray-400 dark:text-zinc-300', {
                'animate-pulse text-white': active,
              })}
            />
            <span
              className={cn('truncate text-xs font-medium text-gray-400 dark:text-zinc-300', {
                'animate-pulse text-white dark:text-zinc-100': active,
              })}
            >
              {value?.name ?? 'Select'}
            </span>
          </Button>
        </div>
      </Tooltip>
      {value && !disabled && (
        <Tooltip tip="Clear selection" side="bottom" sideOffset={10} delay={1000}>
          <IconButton
            variant="muted"
            onClick={() => onValueChange(null)}
            aria-label="Clear selection"
          >
            <XIcon className="size-3.5" />
          </IconButton>
        </Tooltip>
      )}
    </div>
  )
}

import { WrenchIcon } from '@phosphor-icons/react'
import { Badge, Card } from '@toolpath/ui'
import type { Tool, ToolLibrary } from '@toolpath/tool-support'
import type { Units } from '@toolpath/tool-matching/format'
import { describe } from '@toolpath/tool-matching/text'
import type { ReactNode } from 'react'
import { ColletIcon, LibraryIcon, ToolIcon } from './icons'
import { SpecRow } from './tool-card'

type Piece = Parameters<typeof describe>[0] & { productId?: string }

/** Pieces of one kind, each a card with the package's name and spec for it. */
const Pieces = ({
  title,
  icon,
  items,
  units,
}: {
  title: string
  icon: (item: Piece) => ReactNode
  items: ReadonlyArray<Piece>
  units: Units
}) => (
  <section className="flex flex-col gap-3">
    <h2 className="m-0 flex items-center gap-2 text-sm font-semibold text-gray-800">
      {title}
      <Badge size="lg" variant="secondary" className="h-5">
        {items.length}
      </Badge>
    </h2>
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
      {items.map((item) => {
        const { name, spec } = describe(item, units)
        return (
          <li key={item.productId ?? name}>
            <Card className="flex h-full flex-col gap-2 p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-300">
                  {icon(item)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-gray-800">{name}</span>
                  <span className="text-xs text-gray-400">{item.productId}</span>
                </span>
              </div>
              {spec ? (
                <div className="mt-auto border-t border-gray-100 px-1 pt-2.5">
                  <SpecRow spec={spec} />
                </div>
              ) : null}
            </Card>
          </li>
        )
      })}
    </ul>
  </section>
)

/** Everything matching may choose from. */
export const LibraryView = ({ library, units }: { library: ToolLibrary; units: Units }) => (
  <div className="relative flex flex-1 flex-col gap-6 overflow-auto bg-gray-50 p-6">
    <header className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--color-gray-200),var(--color-gray-300)_55%)] text-gray-500">
        <LibraryIcon className="size-6" />
      </span>
      <h1 className="m-0 text-sm font-semibold text-gray-800">Tool library</h1>
    </header>
    <Pieces
      title="Cutters"
      // Matching makes features with solid drills, taps and end mills; `matchable` keeps those.
      items={library.tools.filter((tool) => tool.type === 'solid')}
      icon={(item) => <ToolIcon kind={(item as Tool).kind} className="size-4" />}
      units={units}
    />
    <Pieces
      title="Holders"
      items={library.holders}
      icon={() => <WrenchIcon className="size-4" aria-hidden />}
      units={units}
    />
    <Pieces
      title="Collets"
      items={library.collets}
      icon={() => <ColletIcon className="size-4" />}
      units={units}
    />
  </div>
)

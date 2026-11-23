import { InfoIcon, LinkSimpleIcon, WarningIcon, WrenchIcon } from '@phosphor-icons/react'
import { Badge, Card, Tooltip, cn } from '@toolpath/ui'
import { length, type Units } from '@toolpath/tool-matching/format'
import { describe, featureName, gapText } from '@toolpath/tool-matching/text'
import type { ReactNode } from 'react'
import { LengthBelowHolderIcon, ToolIcon, readSpecPiece } from './icons'
import type { ToolUsage, ToolUse, Unmatched } from './match-part'
import { WAY_LABEL, WAY_VARIANT, reasonText } from './words'

/** `bodyColors` gives three.js colours, which are numbers. */
export const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`

/**
 * A control on a tool card, lifted over the card's click area so its own hover and click reach
 * it. See `ToolCard`.
 */
const cardControl = 'relative z-10'

/** A small grey chip: an icon and a value. */
export const Chip = ({
  icon,
  label,
  className,
  onClick,
  tabbable = false,
  children,
}: {
  icon?: ReactNode
  /** What the value is, read out and shown on hover, where the icon alone says it. */
  label?: string
  className?: string
  /** On a tool card: picks the tool, as a click anywhere on the card does. */
  onClick?: () => void
  /**
   * A button the keyboard reaches. On a tool card it isn't (the card's name is its button for
   * the keyboard); elsewhere it is.
   */
  tabbable?: boolean
  children: ReactNode
}) => {
  const Element = onClick ? 'button' : 'span'
  return (
    <Element
      className={cn(
        'inline-flex h-6 min-w-0 items-center gap-1 rounded-md bg-gray-50 px-2 text-xs text-gray-500',
        onClick && !tabbable && cardControl,
        className,
      )}
      title={label}
      onClick={onClick}
      tabIndex={onClick && !tabbable ? -1 : undefined}
    >
      {icon}
      {label ? <span className="sr-only">{label}: </span> : null}
      <span className="truncate">{children}</span>
    </Element>
  )
}

/**
 * A spec, as `describe` writes it, in one evenly spaced row: each piece an icon and its value,
 * with what it is ("Flute length") on hover. The end shape ("Square end", "Bull nose") has no
 * icon and is left out: the tool's name already says it.
 */
export const SpecRow = ({ spec, onClick }: { spec: string; onClick?: () => void }) => {
  const pieces = spec.split(' · ').flatMap((piece) => readSpecPiece(piece) ?? [])
  if (pieces.length === 0) return null
  return (
    <div className="spec flex items-center justify-between gap-2 text-xs text-gray-500">
      {pieces.map(({ Icon, value, label }) => (
        <Tooltip key={label + value} tip={label}>
          {onClick ? (
            <button
              className={cn('inline-flex items-center gap-1 whitespace-nowrap', cardControl)}
              onClick={onClick}
              tabIndex={-1}
            >
              <Icon className="size-3.5 shrink-0 text-gray-300" />
              <span className="sr-only">{label}: </span>
              {value}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Icon className="size-3.5 shrink-0 text-gray-300" />
              <span className="sr-only">{label}: </span>
              {value}
            </span>
          )}
        </Tooltip>
      ))}
    </div>
  )
}

/** "2×" before a feature name, where the step makes more than one. */
const Count = ({ n }: { n: number }) =>
  n > 1 ? <span className="font-semibold text-gray-400">{n}×</span> : null

/** The holder and collet that hold the cutter, as one line. */
const heldIn = (use: ToolUse, units: Units) =>
  [use.holder, use.collet]
    .flatMap((piece) => (piece ? [describe(piece, units).name] : []))
    .join(' · ')

/** The holder line: plain on the card, not a chip, so the use rows below stand out. */
const HeldIn = ({ text, onClick }: { text: string; onClick: () => void }) => (
  <Chip
    onClick={onClick}
    className="h-auto self-start bg-transparent px-1"
    label="Held in"
    icon={<WrenchIcon className="size-3.5 shrink-0 text-gray-300" aria-hidden />}
  >
    {text}
  </Chip>
)

/**
 * One way the tool is used, on one line: the step, the features, the stick-out, and why behind
 * the ⓘ. The holder shows here only where the card's uses don't all share one.
 */
const Use = ({
  use,
  units,
  holder,
  onSelect,
}: {
  use: ToolUse
  units: Units
  holder: boolean
  onSelect: () => void
}) => {
  const why = use.reasons.map((reason) => reasonText(reason, units)).filter(Boolean)
  return (
    <li className="flex flex-col gap-1.5 rounded-lg bg-gray-50 p-1.5">
      <div className="flex items-center gap-2 text-xs text-gray-700">
        <Badge size="lg" variant={WAY_VARIANT[use.way]} className="h-5 shrink-0">
          {WAY_LABEL[use.way]}
        </Badge>
        <Count n={use.tags.length} />
        <span className="min-w-0 flex-1 truncate">{featureName(use.reading, units)}</span>
        {use.stickout === null ? null : (
          <Chip
            className="h-5 shrink-0 bg-white"
            onClick={onSelect}
            label="Stick-out"
            icon={<LengthBelowHolderIcon className="size-3.5 shrink-0 text-gray-300" />}
          >
            {length(use.stickout, units)}
          </Chip>
        )}
        {why.length > 0 ? (
          <Tooltip
            tip={
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {why.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            }
          >
            <button
              className={cn('shrink-0 text-gray-300 hover:text-gray-500', cardControl)}
              aria-label="Why this tool"
            >
              <InfoIcon className="size-4" weight="fill" />
            </button>
          </Tooltip>
        ) : null}
      </div>
      {holder ? <HeldIn text={heldIn(use, units)} onClick={onSelect} /> : null}
    </li>
  )
}

interface ToolCardProps {
  usage: ToolUsage
  color: number
  units: Units
  selected: boolean
  onSelect: () => void
  onHover: (hovered: boolean) => void
}

/** A tool the part needs: what it is, then every way the part uses it. */
export const ToolCard = ({ usage, color, units, selected, onSelect, onHover }: ToolCardProps) => {
  const { name, spec } = describe(usage.tool, units)
  const hex = cssColor(color)
  const holders = new Set(usage.uses.map((use) => heldIn(use, units)))
  const shared = holders.size === 1 ? [...holders][0] : null
  return (
    <article
      data-pick={usage.key}
      aria-current={selected || undefined}
      // `relative`: the name's click area below stretches over the whole card.
      className={cn('relative rounded-xl', selected && 'ring-2')}
      // The ring is the tool's own colour, as on the part.
      style={{ ['--tw-ring-color' as string]: hex }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <Card className="flex flex-col gap-3 p-3 transition-shadow hover:shadow-md">
        <div className="flex items-center gap-3">
          <button
            // The name is the card's button, and its `after:` box covers the whole card, so a
            // click anywhere on it picks the tool. The card's own controls sit over that box.
            className="tool-head flex min-w-0 flex-1 items-center gap-3 text-left after:absolute after:inset-0 after:rounded-xl after:content-['']"
            aria-pressed={selected}
            onClick={onSelect}
          >
            {/* The tool's colour on the part, behind its icon. */}
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: hex }}
            >
              <ToolIcon kind={usage.tool.kind} className="size-5 text-white" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-gray-800">{name}</span>
              {usage.tool.productId ? (
                <span className="text-xs text-gray-400">{usage.tool.productId}</span>
              ) : null}
            </span>
          </button>
          {usage.tool.productLink ? (
            <a
              href={usage.tool.productLink}
              className={cn('text-gray-300 hover:text-gray-500', cardControl)}
              aria-label="Product page"
            >
              <LinkSimpleIcon className="size-4" />
            </a>
          ) : null}
        </div>
        {shared ? <HeldIn text={shared} onClick={onSelect} /> : null}
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {usage.uses.map((use) => (
            <Use
              key={`${use.way}|${use.tags[0]}`}
              use={use}
              units={units}
              holder={!shared}
              onSelect={onSelect}
            />
          ))}
        </ul>
        <div className="border-t border-gray-100 px-1 pt-2.5">
          <SpecRow spec={spec} onClick={onSelect} />
        </div>
      </Card>
    </article>
  )
}

/** An unmatched step's key among a part's picks, apart from any tool's. */
export const unmatchedKey = (item: Unmatched) => `unmatched|${item.way}|${item.tags[0]}`

/**
 * A feature no tool in the library makes: the step, the feature, and the package's reason. A
 * click picks it, which isolates the feature on the part, as a tool card does its features.
 */
export const UnmatchedRow = ({
  item,
  units,
  selected,
  onSelect,
  onHover,
}: {
  item: Unmatched
  units: Units
  selected: boolean
  onSelect: () => void
  onHover: (hovered: boolean) => void
}) => {
  const gap = item.gap && gapText(item.gap, units)
  const title = gap?.title ?? item.reading.unsupported ?? 'Nothing in the library fits'
  return (
    <li
      data-pick={unmatchedKey(item)}
      className={cn(
        'relative flex items-start gap-2 rounded-lg bg-white p-2 transition-shadow hover:shadow-md',
        selected && 'ring-2 ring-danger',
      )}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <button
        // As on a tool card: the button's `after:` box covers the row, so a click anywhere on it
        // picks the feature. The ⓘ sits over that box.
        className="flex min-w-0 flex-1 items-start gap-2 text-left after:absolute after:inset-0 after:rounded-lg after:content-['']"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <WarningIcon className="mt-0.5 size-4 shrink-0 text-danger" weight="fill" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2 text-xs text-gray-700">
            {item.way ? (
              <Badge size="lg" variant="secondary" className="h-5">
                {WAY_LABEL[item.way]}
              </Badge>
            ) : null}
            <Count n={item.tags.length} />
            <span className="truncate">{featureName(item.reading, units)}</span>
          </span>
          <span className="text-xs text-gray-400">{title}</span>
        </span>
      </button>
      {gap?.body ? (
        <Tooltip tip={<span className="block max-w-64">{gap.body}</span>}>
          <button
            className={cn('text-gray-300 hover:text-gray-500', cardControl)}
            aria-label="Details"
          >
            <InfoIcon className="size-4" weight="fill" />
          </button>
        </Tooltip>
      ) : null}
    </li>
  )
}

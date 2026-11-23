import {
  CheckCircleIcon,
  CircleIcon,
  CubeIcon,
  CursorClickIcon,
  FileIcon,
  InfoIcon,
  LockSimpleIcon,
  SpinnerGapIcon,
  SwapIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react'
import { Badge, Button, Toggle, Tooltip, cn } from '@toolpath/ui'
import { StrictMode, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { JobFailedError, createToolpathClient } from '@toolpath/api'
import type { Units } from '@toolpath/tool-matching/format'
import { PartMesh, ViewCube, Viewer, type PartModel } from '@toolpath/viewer'
import { loadPartMesh, normalizePartReport } from '@toolpath/viewer/engine'
import type { BufferGeometry } from 'three'
import { ANALYSIS_STEPS, analyzePart } from './analyze-part'
import { library } from './library'
import { LibraryView } from './library-view'
import { matchPart, prepareLibrary } from './match-part'
import { listSamples, loadSample, loadedPart, type LoadedPart } from './part-report'
import { EndmillIcon, LibraryIcon } from './icons'
import { Chip, ToolCard, UnmatchedRow, unmatchedKey } from './tool-card'
import './style.css'

// Matching reads the library once, however many parts it matches.
const matching = prepareLibrary(library)

const apiKey = import.meta.env.VITE_TOOLPATH_API_KEY
/** Uploads need a key; the samples don't. `.env.example` ships a placeholder, which isn't one. */
const canUpload = Boolean(apiKey) && !apiKey.startsWith('replace-')
// The same origin as this page: `vite.config.ts` forwards `/v1` to the Toolpath API.
const client = canUpload ? createToolpathClient({ apiKey, baseUrl: window.location.origin }) : null

/**
 * The viewer's model of a part and its mesh: the report validated (`normalizePartReport`, less
 * the features matching left out), and the GLB it names loaded.
 */
const usePartMesh = (part: LoadedPart) => {
  const [mesh, setMesh] = useState<
    { model: PartModel; geometry: BufferGeometry } | { error: string } | null
  >(null)
  useEffect(() => {
    let current = true
    const load = async () => {
      const model = normalizePartReport(part.raw, { withoutFeatures: part.suppressed })
      return { model, geometry: await loadPartMesh(model.mesh) }
    }
    load().then(
      (loaded) => current && setMesh(loaded),
      (error) => current && setMesh({ error: String(error) }),
    )
    return () => {
      current = false
    }
  }, [part])
  return mesh
}

/**
 * Tools' colours on the part: blues, greens, teals and purples only. Red is for the features no
 * tool makes, so no tool is drawn in a red, orange or yellow (as the viewer's `bodyColors` would).
 */
const TOOL_PALETTE = [
  0x4e79a7, 0x59a14f, 0xb07aa1, 0x499894, 0x86bcb6, 0x8cd17d, 0xa0cbe8, 0xd4a6c8,
]

/**
 * A feature no tool in the library makes: plain red. The theme's `danger` (#ba5b4b) is a brick
 * red that reads orange on the part's lit faces.
 */
const UNTOOLED = 0xdc2626

/** A colour per tool, in order; past the palette, its colours again, lightened. */
const toolColors = (keys: ReadonlyArray<string>) =>
  new Map(
    keys.map((key, at) => {
      const base = TOOL_PALETTE[at % TOOL_PALETTE.length]!
      const lighten = Math.min(0.6, Math.floor(at / TOOL_PALETTE.length) * 0.3)
      const channels = [16, 8, 0].map((shift) => {
        const value = (base >> shift) & 0xff
        return Math.round(value + (0xff - value) * lighten) << shift
      })
      return [key, channels.reduce((a, b) => a | b)]
    }),
  )

/** One part: drawn with each feature in the colour of the tool that makes it, and its tool list. */
const PartView = ({ part, units }: { part: LoadedPart; units: Units }) => {
  const mesh = usePartMesh(part)
  // The tools the part needs, from the library alone. Memoized, so a hover never solves again.
  const match = useMemo(() => matchPart(part.report, matching), [part])
  const colors = useMemo(() => toolColors(match.tools.map((tool) => tool.key)), [match])
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  // What can be picked, by key: each tool, and each feature no tool makes. Picking one isolates
  // its features on the part.
  const picks = useMemo(
    () =>
      new Map<string, ReadonlyArray<string>>([
        ...match.tools.map((tool) => [tool.key, tool.uses.flatMap((use) => use.tags)] as const),
        ...match.unmatched.map((item) => [unmatchedKey(item), item.tags] as const),
      ]),
    [match],
  )
  const tagsOf = (key: string | null) => (key && picks.get(key)) || []
  const shown = hovered ?? selected
  const untooled = new Set(match.unmatched.flatMap((item) => item.tags))
  const unmatchedCount = untooled.size
  // With a tool shown, only its features keep a colour; the rest of the part, red included, is
  // plain and solid, so they stand out where they are. Otherwise a feature a step of which no
  // tool makes is red, though other steps have tools.
  const shownTool = shown !== null && colors.has(shown) ? shown : null
  const highlights = [
    ...match.tools
      .filter((tool) => shownTool === null || tool.key === shownTool)
      .flatMap((tool) =>
        tool.uses.flatMap((use) =>
          use.tags.flatMap((tag) =>
            untooled.has(tag) ? [] : [{ tag, color: colors.get(tool.key)! }],
          ),
        ),
      ),
    // At full strength: the viewer's usual wash (`HIGHLIGHT_WEIGHT`) leaves red a pale pink.
    ...(shownTool === null
      ? [...untooled].map((tag) => ({ tag, color: UNTOOLED, weight: 1 }))
      : []),
  ]

  /**
   * A click on the part picks what makes the face clicked, and shows it in the list: the feature
   * itself where it is red, as no tool makes it, or else its tool.
   */
  const pickAt = (owners: ReadonlyArray<string>) => {
    const owns = (tags: ReadonlyArray<string>) => tags.some((tag) => owners.includes(tag))
    const unmatched = match.unmatched.find((item) => owns(item.tags))
    const key = unmatched
      ? unmatchedKey(unmatched)
      : match.tools.find((tool) => tool.uses.some((use) => owns(use.tags)))?.key
    setSelected(key ?? null)
    if (key) {
      document
        .querySelector(`[data-pick="${CSS.escape(key)}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    }
  }
  const panel = useRef<HTMLElement>(null)
  const header = useRef<HTMLElement>(null)
  const untooledList = useRef<HTMLElement>(null)
  /** Scrolls the list down to the features no tool makes, just under the sticky header. */
  const scrollToUntooled = () => {
    const list = untooledList.current
    if (!panel.current || !list) return
    const top = list.offsetTop - (header.current?.offsetHeight ?? 0) - 12
    panel.current.scrollTo({ top, behavior: 'smooth' })
  }
  const toggle = (key: string) => setSelected(selected === key ? null : key)

  return (
    <>
      <section className="relative flex min-w-0 flex-1 bg-gray-50">
        {mesh === null ? (
          <Empty icon={<SpinnerGapIcon className="size-7 animate-spin" />}>Loading the part</Empty>
        ) : 'error' in mesh ? (
          <Empty icon={<WarningCircleIcon className="size-8" />}>
            Could not draw this part: {mesh.error}
          </Empty>
        ) : (
          // Mounted once the mesh is here: the viewer frames the part it starts with, so a mesh
          // that arrives later, as an upload's does from S3, would be left out of view.
          <Viewer style={{ height: '100%', width: '100%' }}>
            <PartMesh
              model={mesh.model}
              geometry={mesh.geometry}
              highlights={highlights}
              selection={tagsOf(shown)}
              // What is shown keeps its own colour: its tool's, or red where no tool makes it.
              theme={{ highlight: (shown && colors.get(shown)) || UNTOOLED }}
              // A feature no tool makes is isolated: the rest of the part fades back. A tool's
              // features stay in place on the solid part.
              focus={shown && !colors.has(shown) ? { opacity: 0.25 } : undefined}
              onPick={(pick) => pickAt(pick.owners)}
            />
            <ViewCube />
          </Viewer>
        )}
      </section>
      <aside
        ref={panel}
        className="relative flex w-[440px] shrink-0 flex-col overflow-auto border-l border-gray-100 bg-gray-50"
        aria-label="Tools"
      >
        {/* Over the tool cards' own controls, which sit at z-10 above each card's click area. */}
        <header
          ref={header}
          className="sticky top-0 z-20 flex flex-col gap-2 border-b border-gray-100 bg-white p-4"
        >
          <h2 className="m-0 truncate text-sm font-semibold text-gray-800">
            {match.tools.length} tools
          </h2>
          <div className="flex flex-wrap gap-1">
            <Chip icon={<CubeIcon className="size-3.5 text-gray-300" aria-hidden />}>
              {match.featureCount} features
            </Chip>
            <Chip
              className="hover:bg-gray-100"
              tabbable
              onClick={() => panel.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              icon={<CheckCircleIcon className="size-3.5 text-success" weight="fill" aria-hidden />}
            >
              {match.featureCount - unmatchedCount} tooled
            </Chip>
            {unmatchedCount > 0 ? (
              <Chip
                className="hover:bg-gray-100"
                tabbable
                onClick={scrollToUntooled}
                icon={<WarningIcon className="size-3.5 text-danger" weight="fill" aria-hidden />}
              >
                {unmatchedCount} not tooled
              </Chip>
            ) : null}
          </div>
        </header>
        <div className="flex flex-col gap-2 p-3">
          {match.tools.map((usage) => (
            <ToolCard
              key={usage.key}
              usage={usage}
              color={colors.get(usage.key)!}
              units={units}
              selected={selected === usage.key}
              onSelect={() => toggle(usage.key)}
              onHover={(over) => setHovered(over ? usage.key : null)}
            />
          ))}
          {match.unmatched.length > 0 ? (
            <section
              ref={untooledList}
              className="mt-2 flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3"
            >
              <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-gray-800">
                Not in this library
                <Badge size="lg" variant="danger" className="h-5">
                  {unmatchedCount}
                </Badge>
              </h3>
              <ul className="flex flex-col gap-1.5">
                {match.unmatched.map((item) => (
                  <UnmatchedRow
                    key={unmatchedKey(item)}
                    item={item}
                    units={units}
                    selected={selected === unmatchedKey(item)}
                    onSelect={() => toggle(unmatchedKey(item))}
                    onHover={(over) => setHovered(over ? unmatchedKey(item) : null)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </aside>
    </>
  )
}

/** A centred icon and one line, where there is nothing to show yet. */
const Empty = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-gray-50 text-gray-400">
    <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-gray-300 shadow-sm">
      {icon}
    </span>
    <p className="m-0 text-sm">{children}</p>
  </div>
)

/** A sidebar row: a sample, or the library. */
const NavButton = ({
  pressed,
  disabled,
  onClick,
  className,
  children,
}: {
  pressed: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) => (
  <button
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'flex w-full items-center gap-3 rounded-lg border py-1.5 pr-3 pl-1.5 text-left text-sm text-gray-700 transition-colors disabled:opacity-50',
      pressed
        ? 'border-gray-100 bg-white font-semibold shadow-sm'
        : 'border-transparent hover:bg-white/60',
      className,
    )}
  >
    {children}
  </button>
)

/** A part's picture in the sidebar; a plain tile where it has none, or it won't load. */
const Thumbnail = ({ src }: { src: string | null }) => {
  const [failed, setFailed] = useState(false)
  const frame = 'size-10 shrink-0 rounded-md border border-gray-100 bg-white'
  return src && !failed ? (
    <img src={src} alt="" className={cn(frame, 'object-contain')} onError={() => setFailed(true)} />
  ) : (
    <span className={cn(frame, 'flex items-center justify-center text-gray-300')}>
      <CubeIcon className="size-5" aria-hidden />
    </span>
  )
}

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <h2 className="m-0 px-1.5 text-xs font-semibold text-gray-400">{children}</h2>
)

/** An upload under way: its file, and which of `ANALYSIS_STEPS` it is on. */
interface Progress {
  file: string
  step: number
}

/** Something that went wrong: what, why in a few words, and the error itself behind the ⓘ. */
interface Problem {
  title: string
  reason: string | null
  detail: string
}

/**
 * A problem from a thrown error. A failed analysis (`JobFailedError`) carries the Engine's
 * `code: message`, so its code becomes the reason ("unreadable_file" → "Unreadable file").
 */
const problemOf = (title: string, error: unknown): Problem => {
  const message = error instanceof Error ? error.message : String(error)
  const code = error instanceof JobFailedError ? /^([a-z_]+):/.exec(message)?.[1] : undefined
  const reason = code ? code[0].toUpperCase() + code.slice(1).replaceAll('_', ' ') : null
  return { title, reason, detail: message }
}

/** What each step is called in the list, done or to do. */
const STEP_LABELS = ['Upload', 'Analyze', 'Read the report']

/** The file being analyzed, and its steps: done, under way, still to come. */
const UploadProgress = ({ progress }: { progress: Progress }) => (
  <div role="status" className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-white p-3">
    <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-800">
      <FileIcon className="size-4 shrink-0 text-gray-300" aria-hidden />
      <span className="truncate">{progress.file}</span>
    </div>
    <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
      {STEP_LABELS.map((label, index) => {
        const done = index < progress.step
        const now = index === progress.step
        return (
          <li
            key={label}
            className={cn(
              'flex items-center gap-2 text-xs',
              done ? 'text-gray-400' : now ? 'text-gray-700' : 'text-gray-300',
            )}
          >
            {done ? (
              <CheckCircleIcon className="size-4 text-success" weight="fill" aria-hidden />
            ) : now ? (
              <SpinnerGapIcon className="size-4 animate-spin text-gray-300" aria-hidden />
            ) : (
              <CircleIcon className="size-4 text-gray-200" aria-hidden />
            )}
            {label}
            {now ? <span className="sr-only">, under way</span> : null}
          </li>
        )
      })}
    </ol>
  </div>
)

const ProblemNote = ({ problem, onDismiss }: { problem: Problem; onDismiss: () => void }) => (
  <div
    role="alert"
    className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-gray-700"
  >
    <WarningCircleIcon className="size-4 shrink-0 text-danger" weight="fill" aria-hidden />
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="break-words">{problem.title}</span>
      {problem.reason ? <span className="text-gray-400">{problem.reason}</span> : null}
    </div>
    <Tooltip tip={<span className="block max-w-64 break-words">{problem.detail}</span>}>
      <button className="shrink-0 text-gray-300 hover:text-gray-500" aria-label="Details">
        <InfoIcon className="size-4" weight="fill" />
      </button>
    </Tooltip>
    <button
      className="shrink-0 text-gray-300 hover:text-gray-500"
      aria-label="Dismiss"
      onClick={onDismiss}
    >
      <XIcon className="size-4" />
    </button>
  </div>
)

/** An upload's picture: the report's own link to it, good while the page is open. */
const thumbnailOf = (part: LoadedPart) => {
  const url = (part.raw as { thumbnailUrl?: unknown } | null)?.thumbnailUrl
  return typeof url === 'string' ? url : null
}

type View = { kind: 'part'; part: LoadedPart } | { kind: 'library' } | { kind: 'none' }

const App = () => {
  const [samples, setSamples] = useState<Array<{ slug: string; name: string }>>([])
  const [view, setView] = useState<View>({ kind: 'none' })
  // An upload's progress, and the last thing that went wrong. Either shows under the button.
  const [progress, setProgress] = useState<Progress | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [units, setUnits] = useState<Units>('mm')
  const fileInput = useRef<HTMLInputElement>(null)
  // An upload takes a while; nothing else opens until it is done. A sample opens at once, so it
  // shows nothing, and only the last one clicked is shown.
  const [uploading, setUploading] = useState(false)
  const latest = useRef(0)
  // The sample being opened: it shows as picked from the click, not once it has loaded.
  const [opening, setOpening] = useState<string | null>(null)
  // The last part uploaded, kept in the sidebar to go back to, as a sample is.
  const [uploaded, setUploaded] = useState<LoadedPart | null>(null)
  /** Shows a part already loaded, dropping any sample still opening. */
  const show = (next: View) => {
    latest.current++
    setOpening(null)
    setView(next)
  }

  useEffect(() => {
    void listSamples().then(setSamples, (error) =>
      setProblem(problemOf('Could not list the samples', error)),
    )
  }, [])

  const open = async (
    load: () => Promise<LoadedPart>,
    what: string,
    slug: string | null = null,
  ) => {
    const request = ++latest.current
    setOpening(slug)
    try {
      const part = await load()
      if (request !== latest.current) return null
      setView({ kind: 'part', part })
      setProblem(null)
      return part
    } catch (error) {
      if (request === latest.current) {
        setProblem(problemOf(`Could not open ${what}`, error))
      }
    } finally {
      if (request === latest.current) setOpening(null)
    }
    return null
  }

  const upload = async (file: File) => {
    setUploading(true)
    setProblem(null)
    try {
      const part = await open(async () => {
        const { report, features } = await analyzePart(
          client!,
          { name: file.name, body: file },
          (step) => setProgress({ file: file.name, step: ANALYSIS_STEPS.indexOf(step) }),
        )
        return loadedPart(String(report.partId), file.name, report, features)
      }, file.name)
      if (part) setUploaded(part)
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  const current = opening ?? (view.kind === 'part' ? view.part.id : view.kind)

  return (
    <main className="flex h-full overflow-hidden font-body text-gray-800">
      <nav className="relative flex w-64 shrink-0 flex-col gap-5 overflow-auto border-r border-gray-100 bg-gray-50 p-3">
        <h1 className="m-0 flex items-center gap-2 px-1.5 pt-1 text-sm font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gray-800 text-white">
            <EndmillIcon className="size-4" />
          </span>
          Tool matching
        </h1>

        <div className="flex flex-col gap-1">
          <SectionLabel>Samples</SectionLabel>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {samples.map((sample) => (
              <li key={sample.slug}>
                <NavButton
                  pressed={current === sample.slug}
                  disabled={uploading}
                  onClick={() => void open(() => loadSample(sample), sample.name, sample.slug)}
                >
                  <Thumbnail src={`/parts/${sample.slug}/thumbnail.png`} />
                  <span className="truncate">{sample.name}</span>
                </NavButton>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1">
          <SectionLabel>Your part</SectionLabel>
          {canUpload ? (
            <>
              {uploaded ? (
                <div className="relative">
                  <NavButton
                    pressed={current === uploaded.id}
                    disabled={uploading}
                    onClick={() => show({ kind: 'part', part: uploaded })}
                    // Room for the swap button over its right end.
                    className="pr-11"
                  >
                    <Thumbnail src={thumbnailOf(uploaded)} />
                    <span className="truncate">{uploaded.name}</span>
                  </NavButton>
                  <span className="absolute inset-y-0 right-2 flex items-center">
                    <Tooltip tip="Upload a different part">
                      <button
                        className="flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                        aria-label="Upload a different part"
                        disabled={uploading}
                        onClick={() => fileInput.current?.click()}
                      >
                        <SwapIcon className="size-4" />
                      </button>
                    </Tooltip>
                  </span>
                </div>
              ) : (
                <Button
                  variant="success"
                  size="lg"
                  // The large button's padding, at the page's own `text-sm`.
                  className="text-sm"
                  full
                  disabled={uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  <span className="flex items-center justify-center gap-2">
                    <UploadSimpleIcon className="size-4" aria-hidden />
                    Upload CAD file
                  </span>
                </Button>
              )}
              {/* The button opens this; it stays hidden, and out of the tab order. */}
              <input
                ref={fileInput}
                type="file"
                className="sr-only"
                tabIndex={-1}
                aria-label="CAD file"
                disabled={uploading}
                accept=".step,.stp,.x_t,.x_b,.sldprt,.ipt,.prt,.3dm,.igs,.iges"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  // Cleared, so choosing the same file again uploads it again.
                  event.target.value = ''
                  if (file) void upload(file)
                }}
              />
            </>
          ) : (
            <Tooltip tip="Set VITE_TOOLPATH_API_KEY in .env">
              <span className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-400">
                <LockSimpleIcon className="size-4 text-gray-300" aria-hidden />
                Add an API key to upload
              </span>
            </Tooltip>
          )}
          {progress ? <UploadProgress progress={progress} /> : null}
          {problem ? <ProblemNote problem={problem} onDismiss={() => setProblem(null)} /> : null}
        </div>

        <div className="flex flex-col gap-1">
          <SectionLabel>Matched against</SectionLabel>
          <NavButton pressed={current === 'library'} onClick={() => show({ kind: 'library' })}>
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-md text-gray-500',
                // Darker once picked, as the button turns white around it.
                current === 'library'
                  ? 'bg-[color-mix(in_oklab,var(--color-gray-200),var(--color-gray-300)_55%)]'
                  : 'bg-gray-100',
              )}
            >
              <LibraryIcon className="size-6" />
            </span>
            <span className="flex-1">Tool library</span>
            <Badge size="lg" variant="secondary" className="h-5">
              {matching.tools.length}
            </Badge>
          </NavButton>
        </div>

        <div className="mt-auto flex items-center justify-between px-1.5">
          <SectionLabel>Units</SectionLabel>
          <Toggle
            value={units}
            onValueChange={(each) => setUnits(each as Units)}
            aria-label="Units"
          >
            <Toggle.Item value="mm">mm</Toggle.Item>
            <Toggle.Item value="in">in</Toggle.Item>
          </Toggle>
        </div>
      </nav>
      {view.kind === 'part' ? (
        <PartView key={view.part.id} part={view.part} units={units} />
      ) : view.kind === 'library' ? (
        <LibraryView library={library} units={units} />
      ) : (
        <Empty icon={<CursorClickIcon className="size-7" />}>Pick a sample part</Empty>
      )}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { Component, StrictMode, Suspense, useMemo, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { PlanResponse } from '@toolpath/api'
import { sameDirection, type Constraints, type PlanDirection } from '@toolpath/plan'
import { Grid, ViewCube, Viewer, directionColor, type RegionHighlight } from '@toolpath/viewer'
import { EnginePart } from '@toolpath/viewer/engine'
import { firstDraft, nextReading, specOf } from './draft'
import { analyzePart, planPart, type Part } from './plan-part'
import './style.css'

/** `directionColor` gives three.js colours, which are numbers. */
const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`

const label = ({ x, y, z }: PlanDirection) => [x, y, z].map((v) => +v.toFixed(3)).join(', ')

/** A direction's colour, as the viewer paints its candidate directions. */
const colorOf = (part: Part, direction: PlanDirection) =>
  directionColor(part.candidateDirections.findIndex((each) => sameDirection(each, direction)))

/** Shows why the mesh did not load, rather than an empty page. */
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) return <p className="note">{this.state.error.message}</p>
    return this.props.children
  }
}

interface SceneProps {
  part: Part
  draft: Constraints
  onPick: (owners: ReadonlyArray<string>) => void
}

/** Draws the part, each face in the colour of the setup it is assigned in. */
const Scene = ({ part, draft, onPick }: SceneProps) => {
  // Each assigned feature's regions, in its setup's colour. Faces left to Toolpath stay grey.
  const paint = useMemo(() => {
    const regionsOf = new Map(part.features.map((feature) => [feature.featureTag, feature]))
    return draft.setups.flatMap((setup): Array<RegionHighlight> => {
      const color = colorOf(part, setup.direction)
      return setup.features.flatMap((tag) =>
        regionsOf.get(tag)!.regionIdxs.map((region) => ({ region, color })),
      )
    })
  }, [part, draft])

  // `EnginePart` reads the report as the API returned it, and loads its mesh: it suspends until
  // then. A click reports every feature that holds the face, as `owners`.
  return (
    <Boundary>
      <Suspense fallback={<p className="note">Loading the mesh…</p>}>
        <Viewer style={{ height: '100%', width: '100%' }}>
          <EnginePart
            report={part}
            regionHighlights={paint}
            onPick={(pick) => onPick(pick.owners)}
          />
          <Grid />
          <ViewCube />
        </Viewer>
      </Suspense>
    </Boundary>
  )
}

const PlanSummary = ({ plan }: { plan: PlanResponse }) => (
  <>
    <h2>Plan</h2>
    <ol>
      {plan.setups.map((setup) => (
        <li key={setup.idx}>
          Setup {setup.idx + 1}
          {setup.direction ? ` (${label(setup.direction)})` : ''}: {setup.actions.length} actions
          {setup.unmachined.length > 0 ? `, ${setup.unmachined.length} features not machined` : ''}
        </li>
      ))}
    </ol>
    <p>Trimmed features: {plan.trimmedFeatures?.length ?? 0}</p>
    <details>
      <summary>Plan spec, as Toolpath completed it</summary>
      <pre>{JSON.stringify(plan.planSpec, null, 2)}</pre>
    </details>
  </>
)

const App = () => {
  const [part, setPart] = useState<Part | null>(null)
  const [draft, setDraft] = useState<Constraints | null>(null)
  // The draft the plan shown was made from: a new plan is worth asking for only once they differ.
  const [planned, setPlanned] = useState<Constraints | null>(null)
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Choose a CAD file of one part.')

  const makePlan = async (analyzed: Part, stated: Constraints) => {
    const spec = specOf(analyzed, stated)
    if (typeof spec === 'string') return setStatus(spec)
    setBusy(true)
    try {
      const made = await planPart(analyzed.partId, spec, setStatus)
      setPlan(made)
      setPlanned(stated)
      setStatus(`Setups planned: ${made.setups.length}`)
    } catch (error) {
      setStatus(`Could not plan the part: ${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const open = async (file: File) => {
    setPart(null)
    setDraft(null)
    setPlan(null)
    setBusy(true)
    try {
      const analyzed = await analyzePart(file, setStatus)
      const first = firstDraft(analyzed)
      setPart(analyzed)
      setDraft(first)
      await makePlan(analyzed, first)
    } catch (error) {
      setStatus(`Could not open ${file.name}: ${String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <aside>
        <h1>Plan by region</h1>
        <input
          type="file"
          aria-label="CAD file"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void open(file)
          }}
        />
        <p role="status">{status}</p>
        {part && draft ? (
          <>
            <h2>Draft</h2>
            <ul>
              {draft.setups.map((setup) => (
                <li key={setup.id}>
                  <span
                    className="swatch"
                    style={{ background: cssColor(colorOf(part, setup.direction)) }}
                  />
                  {label(setup.direction)}: {setup.features.length} features
                </li>
              ))}
            </ul>
            <button disabled={busy || draft === planned} onClick={() => makePlan(part, draft)}>
              Plan again
            </button>
          </>
        ) : null}
        {plan ? <PlanSummary plan={plan} /> : null}
      </aside>
      <section>
        {part && draft ? (
          <Scene
            part={part}
            draft={draft}
            onPick={(owners) => setDraft(nextReading(part, draft, owners))}
          />
        ) : null}
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

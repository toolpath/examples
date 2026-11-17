import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Grid, PartCollection, ViewCube, Viewer, bodyColors } from '@toolpath/viewer'
import { displayMeshModel, usePartCollection } from '@toolpath/viewer/engine'
import { uploadFile, type Body } from './upload-file'
import './style.css'

/** `bodyColors` gives three.js colours, which are numbers. */
const cssColor = (color: number) => `#${color.toString(16).padStart(6, '0')}`

interface SceneProps {
  bodies: Array<Body>
  colors: Map<string, number>
  /** The part shown on its own, or `null` to show every body. */
  shown: string | null
  onPick: (partId: string) => void
}

/** Draws every body where the file puts it, each in its own colour. */
const Scene = ({ bodies, colors, shown, onPick }: SceneProps) => {
  // 1. Turn each display mesh into a model. Keep the models stable: new ones load again.
  const models = useMemo(
    () => bodies.map((body) => ({ id: body.partId, model: displayMeshModel(body.mesh) })),
    [bodies],
  )

  // 2. Load every mesh. `items` stays `null` until they have all loaded.
  const collection = usePartCollection(models)
  if (!collection.items) {
    if (collection.failures.length === 0) return <p className="note">Loading the meshes…</p>
    return (
      <p className="note">
        Some meshes did not load. <button onClick={() => collection.retry()}>Retry</button>
      </p>
    )
  }

  // 3. Each item is a loaded mesh plus `PartMesh` props, so the app decides how each body looks.
  const items = collection.items.map((item) => {
    const color = colors.get(item.id)
    return {
      ...item,
      theme: { part: color, hover: color },
      visible: shown === null || shown === item.id,
    }
  })

  return (
    <Viewer style={{ height: '100%', width: '100%' }}>
      <PartCollection items={items} onPick={onPick}>
        <Grid />
        <ViewCube />
      </PartCollection>
    </Viewer>
  )
}

const App = () => {
  const [bodies, setBodies] = useState<Array<Body>>([])
  // The body chosen by a click, and the one whose row the pointer is on, which wins while it is.
  const [shown, setShown] = useState<string | null>(null)
  const [peek, setPeek] = useState<string | null>(null)
  const [status, setStatus] = useState('Choose a CAD file with several bodies.')
  const colors = useMemo(() => bodyColors(bodies.map((body) => body.partId)), [bodies])

  const open = async (file: File) => {
    setBodies([])
    setShown(null)
    setPeek(null)
    try {
      const uploaded = await uploadFile(file, setStatus)
      setBodies(uploaded)
      setStatus(`Bodies in ${file.name}: ${uploaded.length}`)
    } catch (error) {
      setStatus(`Could not open ${file.name}: ${String(error)}`)
    }
  }

  return (
    <main>
      <aside>
        <h1>Multi-body files</h1>
        <input
          type="file"
          aria-label="CAD file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void open(file)
          }}
        />
        <p role="status">{status}</p>
        <ul>
          {bodies.map(({ info, partId }) => (
            <li key={partId}>
              <button
                aria-pressed={shown === partId}
                onClick={() => setShown(shown === partId ? null : partId)}
                onPointerEnter={() => setPeek(partId)}
                onPointerLeave={() => setPeek(null)}
              >
                <span className="swatch" style={{ background: cssColor(colors.get(partId)!) }} />
                {info.name ?? `Body ${info.index + 1}`}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        {bodies.length > 0 ? (
          <Scene bodies={bodies} colors={colors} shown={peek ?? shown} onPick={setShown} />
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

/**
 * Makes the sample parts this example ships: analyzes each STEP file and saves what the page reads
 * into `public/parts/<slug>/`. You only need it to add or refresh a sample.
 *
 *   TOOLPATH_API_KEY=... pnpm --filter @toolpath/example-tool-matching analyze-samples -- a.step
 *
 * Analysis is billed: one analysis per file.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { createToolpathClient } from '@toolpath/api'
import { analyzePart } from '../src/analyze-part'

const apiKey = process.env.TOOLPATH_API_KEY
const baseUrl = process.env.TOOLPATH_API_URL ?? 'https://api.toolpath.com'
const out = new URL('../public/parts/', import.meta.url).pathname

/** What `public/parts/index.json` lists: each sample's folder and the name the page shows. */
interface SampleEntry {
  slug: string
  name: string
}

const slugOf = (file: string) =>
  basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const nameOf = (slug: string) => slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())

const download = async (url: string, to: string) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`GET ${new URL(url).pathname}: ${response.status}`)
  await writeFile(to, new Uint8Array(await response.arrayBuffer()))
}

const save = async (file: string): Promise<SampleEntry> => {
  const client = createToolpathClient({ apiKey: apiKey!, baseUrl })
  const slug = slugOf(file)
  const dir = join(out, slug)
  await mkdir(dir, { recursive: true })
  const { report, features } = await analyzePart(
    client,
    { name: basename(file), body: await readFile(file) },
    (status) => console.error(`${slug}: ${status}`),
  )

  // The report's URLs are presigned and expire, so the mesh and thumbnail are saved beside it and
  // the URLs dropped: the page points at the saved copies.
  if (report.meshGlbUrl) await download(report.meshGlbUrl, join(dir, 'mesh.glb'))
  if (typeof report.thumbnailUrl === 'string') {
    await download(report.thumbnailUrl, join(dir, 'thumbnail.png'))
  }
  const saved = { ...report, meshGlbUrl: null, meshStlUrl: null, thumbnailUrl: null }
  await writeFile(join(dir, 'report.json'), `${JSON.stringify(saved, null, 2)}\n`)
  await writeFile(join(dir, 'features.json'), `${JSON.stringify(features, null, 2)}\n`)
  return { slug, name: nameOf(slug) }
}

const files = process.argv.slice(2).filter((arg) => arg !== '--')
if (!apiKey || files.length === 0) {
  throw new Error('Usage: TOOLPATH_API_KEY=... pnpm analyze-samples -- part.step [more.step …]')
}

const index = join(out, 'index.json')
const existing: Array<SampleEntry> = JSON.parse(await readFile(index, 'utf8').catch(() => '[]'))
const made = await Promise.all(files.map((file) => save(resolve(file))))
// A sample analyzed again keeps the name it has.
const bySlug = new Map([...made, ...existing].map((entry) => [entry.slug, entry]))
await writeFile(index, `${JSON.stringify([...bySlug.values()], null, 2)}\n`)

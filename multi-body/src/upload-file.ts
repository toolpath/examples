import {
  Configuration,
  FilesApi,
  createToolpathClient,
  uploadToPresignedUrl,
  waitForJob,
  type FileBody,
  type PartMeshResponse,
} from '@toolpath/api'

const apiKey = import.meta.env.VITE_TOOLPATH_API_KEY
// The same origin as this page: `vite.config.ts` forwards `/v1` to the Toolpath API.
const baseUrl = window.location.origin

const client = createToolpathClient({ apiKey, baseUrl })
const files = new FilesApi(new Configuration({ basePath: baseUrl, accessToken: apiKey }))

/** One solid body of a file: what the file says about it, and the mesh to draw it with. */
export interface Body {
  info: FileBody
  partId: string
  mesh: PartMeshResponse
}

/** The whole flow, from a CAD file on disk to a display mesh of each of its bodies. */
export const uploadFile = async (
  file: File,
  onStatus: (status: string) => void,
): Promise<Array<Body>> => {
  // 1. Create the file, and upload it straight to the URL that returns.
  onStatus('Uploading the file')
  const { fileId, uploadUrl } = await files.createFile({ filename: file.name })
  await uploadToPresignedUrl(uploadUrl, file)

  // 2. Inspect it. Once the job succeeds, the file lists its solid bodies.
  onStatus('Inspecting the file')
  const inspection = await files.updateFile({ id: fileId })
  await waitForJob(client, inspection.jobId)
  const { bodies } = await files.getFile({ id: fileId })

  // 3. Make a part of each body, at most 100 to a call. A part is one body from here on.
  onStatus('Making a part of each body')
  const partIds = new Map<number, string>()
  for (let start = 0; start < bodies.length; start += 100) {
    const indexes = bodies.slice(start, start + 100).map((body) => body.index)
    const { parts } = await files.createFileParts({
      id: fileId,
      createFilePartsRequest: { bodies: indexes },
    })
    parts.forEach((part) => partIds.set(part.bodyIndex, part.partId))
  }

  // 4. Mesh each part. Every step so far, and this one, is free: only analysis is billed.
  onStatus('Meshing each body')
  return Promise.all(
    bodies.map(async (info) => {
      const partId = partIds.get(info.index)!
      const { jobId } = await client.parts.createPartMesh({ id: partId })
      await waitForJob(client, jobId)
      return { info, partId, mesh: await client.parts.getPartMesh({ id: partId, jobId }) }
    }),
  )
}

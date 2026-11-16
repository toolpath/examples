import { FetchError, ResponseError, createToolpathClient, type ToolpathClient } from '@toolpath/api'

export type { ToolpathClient }

export const createClient = (apiKey: string, apiUrl: string): ToolpathClient =>
  createToolpathClient({ apiKey, baseUrl: apiUrl })

export const errorStatus = (error: unknown): number | null =>
  error instanceof ResponseError ? error.response.status : null

export const describeError = async (error: unknown, apiUrl: string): Promise<string> => {
  if (error instanceof FetchError) {
    return `Couldn't reach the Toolpath API at ${apiUrl}. Check your connection, that the key was made for this API, and that it lists ${window.location.origin} as an allowed browser origin.`
  }
  if (error instanceof ResponseError) {
    const problem = (await error.response
      .clone()
      .json()
      .catch(() => null)) as { title?: string; detail?: string; code?: string } | null
    if (error.response.status === 401) {
      return "That doesn't look like a valid Toolpath API key."
    }
    if (problem?.code === 'product_mismatch') {
      return `This key can't do that: ${problem.detail ?? 'give it Core, DFM and Quoting access in the portal.'}`
    }
    return (
      problem?.detail ||
      problem?.title ||
      `The Toolpath API returned HTTP ${error.response.status}.`
    )
  }
  return error instanceof Error ? error.message : String(error)
}

export const checkKey = async (client: ToolpathClient) => {
  await client.jobs.listJobs({ pageSize: 1 })
}

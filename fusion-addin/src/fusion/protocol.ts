// Mirrors ToolpathCam/lib/router.py; change both together.

import type { PlanResponseStockResolved, Vec3 } from '@toolpath/api'

export type Role = 'main' | 'worker'

export interface FusionBody {
  token: string
  name: string
  /** "Bracket / Body1" for a body inside an occurrence. */
  path: string
  isVisible: boolean
}

export interface FusionDocument {
  hasDocument: boolean
  id?: string
  name?: string
  isDesign?: boolean
  units?: string | null
  bodies?: Array<FusionBody>
  selectedBodyToken?: string | null
}

export type JobKind = 'analysis' | 'toolpaths'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'
export type ImportStatus = 'pending' | 'importing' | 'imported' | 'failed'

export interface ImportSummary {
  setups: number
  actions: number
  sketchLines: number
  thinned: boolean
  warnings: Array<string>
}

export interface WatchedJob {
  jobId: string
  runId: string
  kind: JobKind
  partId: string
  planId?: string | null
  bodyToken: string
  bodyName: string
  documentId: string | null
  /** Toolpath jobs: the directions requested, in setup order. */
  directions?: Array<Vec3> | null
  status: JobStatus
  progress: number | null
  error: string | null
  createdAt: string
  importStatus?: ImportStatus | null
  importError?: string | null
  importSummary?: ImportSummary | null
}

/** One body sent to Toolpath: its analysis and each toolpaths request. Saved by the add-in. */
export interface Run {
  runId: string
  createdAt: string
  updatedAt?: string
  bodyName: string
  bodyToken: string
  documentId: string | null
  documentName: string | null
  partId: string | null
  jobs: Array<WatchedJob>
}

export interface FusionContext {
  version: string
  theme: 'light' | 'dark'
  apiUrl: string
  portalUrl: string
  document: FusionDocument
  jobs: Array<WatchedJob>
  /** Worker only: the key the main palette is signed in with. */
  apiKey?: string | null
}

export interface ExportedBody {
  fileName: string
  bodyName: string
  bodyToken: string
  size: number
  /** STEP file contents, base64 encoded. */
  data: string
}

export interface ImportAction {
  idx: number
  actionId: string
  intent: string
  toolName: string
  machiningTime: number | null
}

export interface ImportBegin {
  importId: string
  jobId: string
  partId: string
  planId: string
  partName: string
  bodyToken: string
  documentId: string | null
  stock: PlanResponseStockResolved | null
  setups: Array<{ idx: number; direction: Vec3 | null; actions: Array<ImportAction> }>
}

export interface ToolpathFile {
  points: Array<number>
  sections: Array<{ start: number; end: number; kind: string }>
}

export interface ImportActionMessage {
  importId: string
  setupIdx: number
  actionIdx: number
  toolpath: ToolpathFile | null
}

export interface RequestMap {
  getContext: undefined
  getDocumentInfo: undefined
  exportBody: { token: string | null }
  enableBodySelection: undefined
  disableBodySelection: undefined
  setApiKey: { apiKey: string | null }
  listRuns: undefined
  saveRun: { run: Omit<Run, 'jobs'> }
  deleteRun: { runId: string }
  watchJob: { job: WatchedJob }
  retryImport: { jobId: string }
  jobUpdate: { job: Partial<WatchedJob> & { jobId: string } }
  importBegin: ImportBegin
  importAction: ImportActionMessage
  importEnd: { importId: string }
  openExternal: string
  log: string
}

export interface ResponseMap {
  getContext: FusionContext
  getDocumentInfo: FusionDocument
  exportBody: ExportedBody
  enableBodySelection: { success: true }
  disableBodySelection: { success: true }
  setApiKey: { success: true }
  listRuns: { runs: Array<Run> }
  saveRun: { run: Run }
  deleteRun: { success: true }
  watchJob: { job: WatchedJob }
  retryImport: { job: WatchedJob }
  jobUpdate: { job: WatchedJob }
  importBegin: { success: true }
  importAction: { sketched: number }
  importEnd: { summary: ImportSummary }
  openExternal: { success: true }
  log: { success: true }
}

export type FusionEvent =
  | { action: 'documentChanged'; data: FusionDocument }
  | { action: 'bodySelected'; data: { token: string; name: string } }
  | { action: 'themeChanged'; data: { theme: FusionContext['theme'] } }
  | { action: 'jobUpdated'; data: { job: WatchedJob } }
  | { action: 'importCompleted'; data: { job: WatchedJob; summary: ImportSummary } }
  | { action: 'watchJob'; data: { job: WatchedJob } }
  | { action: 'apiKeyChanged'; data: { apiKey: string | null } }

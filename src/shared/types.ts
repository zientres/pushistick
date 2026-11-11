export type WorkflowStep = {
  id: string
  prompt: string
}

export type Workflow = {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  createdAt: string
  updatedAt: string
}

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopped'

export type RunRecord = {
  id: string
  workflowId: string
  workflowName: string
  status: RunStatus
  startedAt: string
  finishedAt: string | null
  error: string | null
  results: string[]
}

export type RunEvent = {
  runId: string
  type: 'status' | 'step-start' | 'step-complete' | 'output' | 'error'
  status?: RunStatus
  stepIndex?: number
  stepCount?: number
  prompt?: string
  response?: string
  message?: string
}

export type CliStatus = {
  installed: boolean
  version: string | null
  error: string | null
}

export type PushistickApi = {
  getWorkflows: () => Promise<Workflow[]>
  saveWorkflow: (workflow: Pick<Workflow, 'id' | 'name' | 'description' | 'steps'>) => Promise<Workflow[]>
  deleteWorkflow: (id: string) => Promise<Workflow[]>
  getRuns: () => Promise<RunRecord[]>
  checkAntigravity: () => Promise<CliStatus>
  runWorkflow: (id: string, initialPrompt?: string) => Promise<{ runId: string }>
  stopRun: (runId: string) => Promise<void>
  onRunEvent: (callback: (event: RunEvent) => void) => () => void
}

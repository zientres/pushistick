import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import Database from 'better-sqlite3'
import type { Workflow, WorkflowStep, RunEvent, RunRecord } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let db: Database.Database
const activeRuns = new Map<string, { child: ReturnType<typeof spawn>; stopped: boolean }>()

function now() {
  return new Date().toISOString()
}

function openDatabase() {
  const file = path.join(app.getPath('userData'), 'pushistick.db')
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      steps_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      workflow_name TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      error TEXT
    );
  `)
}

function emit(event: RunEvent) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('run:event', event)
}

function listWorkflows(): Workflow[] {
  const rows = db.prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all() as Array<Record<string, string>>
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    steps: JSON.parse(row.steps_json) as WorkflowStep[],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

function listRuns(): RunRecord[] {
  return db.prepare('SELECT id, workflow_id as workflowId, workflow_name as workflowName, status, started_at as startedAt, finished_at as finishedAt, error FROM runs ORDER BY started_at DESC LIMIT 100').all() as RunRecord[]
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0b0d12',
    title: 'Pushistick',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function commandForAgy(args: string[]) {
  if (process.platform === 'win32') {
    return spawn('agy', args, { windowsHide: true, shell: true, stdio: ['pipe', 'pipe', 'pipe'] })
  }
  return spawn('agy', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
}

async function executeWorkflow(runId: string, workflow: Workflow, initialPrompt = '') {
  const child = commandForAgy(['--input-format', 'stream-json', '--output-format', 'stream-json'])
  const state = { child, stopped: false }
  activeRuns.set(runId, state)
  const updateStatus = (status: string, error: string | null = null) => {
    db.prepare('UPDATE runs SET status = ?, finished_at = ?, error = ? WHERE id = ?')
      .run(status, status === 'running' ? null : now(), error, runId)
    emit({ runId, type: 'status', status: status as RunRecord['status'], message: error ?? undefined })
  }

  const stderr: string[] = []
  child.stderr?.on('data', (chunk: Buffer) => {
    const value = chunk.toString()
    stderr.push(value)
    if (stderr.join('').length > 6000) stderr.shift()
  })

  const lines = createInterface({ input: child.stdout! })
  const iterator = lines[Symbol.asyncIterator]()
  let processError: Error | null = null
  child.on('error', (error) => { processError = error })

  try {
    updateStatus('running')
    for (let index = 0; index < workflow.steps.length; index += 1) {
      if (state.stopped) throw new Error('Запуск остановлен пользователем.')
      const step = workflow.steps[index]
      emit({ runId, type: 'step-start', stepIndex: index, stepCount: workflow.steps.length, prompt: step.prompt })
      child.stdin?.write(JSON.stringify({ event: 'user', message: { content: step.prompt } }) + '\n')

      let result: { status?: string; response?: string; error?: string } | null = null
      while (true) {
        const next = await iterator.next()
        if (next.done) {
          if (processError) throw processError
          throw new Error(stderr.join('').trim() || 'Antigravity CLI завершил поток без результата.')
        }
        let event: any
        try { event = JSON.parse(next.value) } catch { continue }
        if (event.event === 'result') {
          result = event.result
          break
        }
      }

      if (!result || result.status !== 'SUCCESS') {
        throw new Error(result?.error || 'Antigravity вернул ошибку или незавершённый результат.')
      }
      emit({ runId, type: 'step-complete', stepIndex: index, stepCount: workflow.steps.length, response: result.response ?? '' })
    }
    updateStatus('completed')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stopped = state.stopped
    updateStatus(stopped ? 'stopped' : 'failed', message)
    emit({ runId, type: 'error', message })
  } finally {
    try { child.stdin?.end() } catch { /* process may already be closed */ }
    if (state.stopped && child.exitCode === null) child.kill()
    activeRuns.delete(runId)
  }
}

app.whenReady().then(() => {
  openDatabase()
  createWindow()

  ipcMain.handle('workflows:list', () => listWorkflows())
  ipcMain.handle('workflows:save', (_event, input: Pick<Workflow, 'id' | 'name' | 'description' | 'steps'>) => {
    const name = String(input.name ?? '').trim()
    if (!name) throw new Error('У шаблона должно быть название.')
    if (!Array.isArray(input.steps) || input.steps.length === 0) throw new Error('Добавьте хотя бы один шаг.')
    const steps = input.steps.map((step) => ({ id: String(step.id || randomUUID()), prompt: String(step.prompt ?? '').trim() }))
    if (steps.some((step) => !step.prompt)) throw new Error('Промпты шагов не могут быть пустыми.')
    const existing = db.prepare('SELECT created_at FROM workflows WHERE id = ?').get(input.id) as { created_at?: string } | undefined
    const timestamp = now()
    db.prepare(`INSERT INTO workflows (id, name, description, steps_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, steps_json=excluded.steps_json, updated_at=excluded.updated_at`)
      .run(input.id || randomUUID(), name, String(input.description ?? ''), JSON.stringify(steps), existing?.created_at ?? timestamp, timestamp)
    return listWorkflows()
  })
  ipcMain.handle('workflows:delete', (_event, id: string) => {
    db.prepare('DELETE FROM workflows WHERE id = ?').run(id)
    return listWorkflows()
  })
  ipcMain.handle('runs:list', () => listRuns())
  ipcMain.handle('antigravity:check', () => new Promise((resolve) => {
    const child = commandForAgy(['--version'])
    let output = ''
    let errorOutput = ''
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { errorOutput += chunk.toString() })
    child.on('error', (error) => resolve({ installed: false, version: null, error: error.message }))
    child.on('close', (code) => resolve(code === 0
      ? { installed: true, version: output.trim() || 'Версия не определена', error: null }
      : { installed: false, version: null, error: errorOutput.trim() || `Команда завершилась с кодом ${code}` }))
  }))
  ipcMain.handle('runs:start', (_event, workflowId: string, initialPrompt = '') => {
    const workflow = listWorkflows().find((item) => item.id === workflowId)
    if (!workflow) throw new Error('Шаблон не найден.')
    if (!workflow.steps.length) throw new Error('В шаблоне нет шагов.')
    if (activeRuns.size > 0) throw new Error('Сейчас уже выполняется другой сценарий. Дождись его завершения.')
    const id = randomUUID()
    db.prepare('INSERT INTO runs (id, workflow_id, workflow_name, status, started_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, workflow.id, workflow.name, 'queued', now())
    void executeWorkflow(id, workflow, String(initialPrompt ?? ''))
    return { runId: id }
  })
  ipcMain.handle('runs:stop', (_event, runId: string) => {
    const run = activeRuns.get(runId)
    if (run) {
      run.stopped = true
      run.child.kill()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  for (const run of activeRuns.values()) run.child.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  for (const run of activeRuns.values()) run.child.kill()
  if (db?.open) db.close()
})

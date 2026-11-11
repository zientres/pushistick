import { contextBridge, ipcRenderer } from 'electron'
import type { PushistickApi, RunEvent } from '../shared/types'

const api: PushistickApi = {
  getWorkflows: () => ipcRenderer.invoke('workflows:list'),
  saveWorkflow: (workflow) => ipcRenderer.invoke('workflows:save', workflow),
  deleteWorkflow: (id) => ipcRenderer.invoke('workflows:delete', id),
  getRuns: () => ipcRenderer.invoke('runs:list'),
  checkAntigravity: () => ipcRenderer.invoke('antigravity:check'),
  runWorkflow: (id, initialPrompt) => ipcRenderer.invoke('runs:start', id, initialPrompt),
  stopRun: (runId) => ipcRenderer.invoke('runs:stop', runId),
  onRunEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: RunEvent) => callback(payload)
    ipcRenderer.on('run:event', listener)
    return () => ipcRenderer.removeListener('run:event', listener)
  }
}

contextBridge.exposeInMainWorld('pushistick', api)

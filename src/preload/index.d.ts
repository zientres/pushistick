import type { PushistickApi } from '../shared/types'

declare global {
  interface Window {
    pushistick: PushistickApi
  }
}

export {}

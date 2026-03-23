declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: unknown) => void
  }

  export type SWUpdateOptions = {
    type?: 'SKIP_WAITING' | 'UPDATE'
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean | SWUpdateOptions) => Promise<void>
  export function register(options?: RegisterSWOptions): (reloadPage?: boolean | SWUpdateOptions) => Promise<void>
  export function unregister(): Promise<void>
}

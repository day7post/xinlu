export interface RemoteFileInfo {
  etag: string | null
  size: number
  modified: string
}

export interface SyncProvider {
  head(path: string): Promise<RemoteFileInfo | null>
  get(path: string): Promise<{ blob: Blob; etag: string | null }>
  put(path: string, blob: Blob): Promise<{ etag: string | null }>
  ensureDir(): Promise<void>
  testConnection(): Promise<void>
}

export interface SyncConfig {
  server: string
  username: string
  dir: string
  rememberPassword: boolean
  appPassword?: string
}

export interface SyncState {
  lastEtag: string | null
  lastSyncAt: string | null
  deviceId: string
}

export type SyncDecision = 'push-first' | 'push' | 'pull' | 'conflict' | 'up-to-date'

export function decideSync(input: {
  remoteExists: boolean
  remoteChanged: boolean
  localDirty: boolean
}): SyncDecision {
  if (!input.remoteExists) return 'push-first'
  if (input.remoteChanged && input.localDirty) return 'conflict'
  if (input.remoteChanged) return 'pull'
  if (input.localDirty) return 'push'
  return 'up-to-date'
}

const CONFIG_KEY = 'xinlu-sync-config'
const STATE_KEY = 'xinlu-sync-state'

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SyncConfig>
      return {
        server: parsed.server ?? 'https://dav.jianguoyun.com/dav/',
        username: parsed.username ?? '',
        dir: parsed.dir ?? 'xinlu',
        rememberPassword: Boolean(parsed.rememberPassword),
        appPassword: parsed.rememberPassword ? parsed.appPassword : undefined,
      }
    }
  } catch {
    // corrupted config falls back to defaults
  }
  return { server: 'https://dav.jianguoyun.com/dav/', username: '', dir: 'xinlu', rememberPassword: false }
}

export function saveSyncConfig(config: SyncConfig): void {
  const toStore: SyncConfig = { ...config }
  if (!config.rememberPassword) delete toStore.appPassword
  localStorage.setItem(CONFIG_KEY, JSON.stringify(toStore))
}

function createDeviceId(): string {
  return `device_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function loadSyncState(): SyncState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SyncState>
      return {
        lastEtag: parsed.lastEtag ?? null,
        lastSyncAt: parsed.lastSyncAt ?? null,
        deviceId: parsed.deviceId ?? createDeviceId(),
      }
    }
  } catch {
    // corrupted state falls back to fresh state
  }
  return { lastEtag: null, lastSyncAt: null, deviceId: createDeviceId() }
}

export function saveSyncState(state: SyncState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state))
}

/** Session-only secrets. The sync passphrase is never persisted anywhere. */
let sessionSecrets: { appPassword: string; passphrase: string } | null = null

export function setSessionSecrets(secrets: { appPassword: string; passphrase: string }): void {
  sessionSecrets = secrets
}

export function getSessionSecrets(): { appPassword: string; passphrase: string } | null {
  return sessionSecrets
}

export function clearSessionSecrets(): void {
  sessionSecrets = null
}

export const REMOTE_VAULT_FILE = 'vault.xinlu'

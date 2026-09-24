export type MemoryPrecision = 'exact' | 'month' | 'year' | 'range' | 'unknown'
export type AnchorForm = 'note' | 'photo' | 'scene'
export type HeartlineType = 'person' | 'time' | 'cause'
export type RevisionSource = 'user' | 'restore' | 'manual' | 'import'

export interface MemoryTime {
  precision: MemoryPrecision
  date?: string
  month?: string
  year?: number
  startYear?: number
  endYear?: number
}

export interface EmotionObservation {
  id: string
  label: string
  intensity?: number
  note?: string
}

export interface AnchorContent {
  form: AnchorForm
  summary: string
  text: string
  memoryTime: MemoryTime
  tags: string[]
  emotionsThen: EmotionObservation[]
  emotionsNow: EmotionObservation[]
  mediaIds: string[]
}

export interface AnchorRevision {
  id: string
  anchorId: string
  content: AnchorContent
  createdAt: string
  committedAt?: string
  source: RevisionSource
  restoredFromRevisionId?: string
}

export interface Anchor {
  id: string
  createdAt: string
  updatedAt: string
  latestRevisionId: string
  workingRevisionId?: string
  status: 'draft' | 'active'
  deletedAt?: string
}

export interface MediaRecord {
  id: string
  name: string
  mime: string
  size: number
  createdAt: string
  thumbnailDataUrl: string
  width?: number
  height?: number
}

export interface Person {
  id: string
  name: string
  note: string
  createdAt: string
}

export interface Heartline {
  id: string
  anchorAId: string
  anchorBId: string
  type: HeartlineType
  personIds: string[]
  note: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  promotedAnchorId?: string
}

export interface VaultData {
  schemaVersion: 1
  vaultId: string
  anchors: Anchor[]
  revisions: AnchorRevision[]
  heartlines: Heartline[]
  persons: Person[]
  createdAt: string
  updatedAt: string
}

export interface AnchorWithRevision {
  anchor: Anchor
  revision: AnchorRevision
}

export interface BackupMedia {
  record: MediaRecord
  originalBase64: string
}

export interface BackupPayload {
  format: 'xinlu-backup'
  version: 1
  exportedAt: string
  vault: VaultData
  media: BackupMedia[]
}

export interface EncryptedBackup {
  format: 'xinlu-encrypted-backup'
  version: 1
  exportedAt: string
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
  }
  cipher: {
    name: 'AES-GCM'
    iv: string
  }
  data: string
}

export const HEARTLINE_META: Record<
  HeartlineType,
  { label: string; color: string; description: string }
> = {
  person: {
    label: '人物',
    color: '#c96f5b',
    description: '两段记忆都与同一个人或同一组人有关',
  },
  time: {
    label: '时间',
    color: '#4d7f86',
    description: '两段记忆在相近或连续的时间里发生',
  },
  cause: {
    label: '因果',
    color: '#b5823a',
    description: '两段记忆之间存在影响或因果关联',
  },
}

export const PRESET_EMOTIONS = [
  '平静',
  '开心',
  '期待',
  '难过',
  '愤怒',
  '害怕',
  '羞耻',
  '愧疚',
  '困惑',
  '释然',
  '孤独',
  '感激',
]

export const FORM_LABEL: Record<AnchorForm, string> = {
  note: '一句话',
  photo: '照片',
  scene: '场景',
}

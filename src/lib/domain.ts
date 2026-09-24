import { createId } from './id'
import type {
  Anchor,
  AnchorContent,
  AnchorRevision,
  AnchorWithRevision,
  Heartline,
  HeartlineType,
  MediaRecord,
  MemoryTime,
  Person,
  VaultData,
} from '../types'

export interface CommitResult {
  vault: VaultData
  ok: boolean
  message?: string
  revisionId?: string
}

export function createEmptyContent(): AnchorContent {
  return {
    form: 'note',
    summary: '',
    text: '',
    memoryTime: { precision: 'unknown' },
    tags: [],
    emotionsThen: [],
    emotionsNow: [],
    mediaIds: [],
  }
}

export function createVault(): VaultData {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    vaultId: createId('vault'),
    anchors: [],
    revisions: [],
    heartlines: [],
    persons: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function cloneContent(content: AnchorContent): AnchorContent {
  return JSON.parse(JSON.stringify(content)) as AnchorContent
}

export function contentIsMeaningful(content: AnchorContent): boolean {
  return Boolean(content.text.trim() || content.mediaIds.length > 0)
}

export function deriveSummary(content: AnchorContent): string {
  const manual = content.summary.trim()
  if (manual) return manual
  const text = content.text.trim().replace(/\s+/g, ' ')
  if (text) {
    const match = text.match(/^.*?[。！？!?](?:\s|$)/)
    const firstSentence = match?.[0]?.trim() || text
    return firstSentence.length > 120 ? `${firstSentence.slice(0, 120)}…` : firstSentence
  }
  if (content.mediaIds.length > 0) return '照片心锚'
  if (content.form === 'scene') return '场景心锚'
  return '尚未写下内容'
}

export function getRevision(vault: VaultData, revisionId: string): AnchorRevision | undefined {
  return vault.revisions.find((revision) => revision.id === revisionId)
}

export function getLatestRevision(vault: VaultData, anchor: Anchor): AnchorRevision | undefined {
  return getRevision(vault, anchor.workingRevisionId ?? anchor.latestRevisionId)
}

export function getAnchorItem(vault: VaultData, anchorId: string): AnchorWithRevision | undefined {
  const anchor = vault.anchors.find((item) => item.id === anchorId)
  if (!anchor) return undefined
  const revision = getLatestRevision(vault, anchor)
  if (!revision) return undefined
  return { anchor, revision }
}

export function getActiveAnchorItems(vault: VaultData): AnchorWithRevision[] {
  return vault.anchors
    .filter((anchor) => anchor.status === 'active' && !anchor.deletedAt)
    .map((anchor) => {
      const revision = getLatestRevision(vault, anchor)
      return revision ? { anchor, revision } : null
    })
    .filter((item): item is AnchorWithRevision => item !== null)
}

export function getDraftAnchorItem(vault: VaultData): AnchorWithRevision | undefined {
  const anchor = vault.anchors.find((item) => item.status === 'draft' && !item.deletedAt)
  if (!anchor) return undefined
  return getAnchorItem(vault, anchor.id)
}

export function createDraftInVault(vault: VaultData): { vault: VaultData; anchorId: string } {
  const existing = getDraftAnchorItem(vault)
  if (existing) return { vault, anchorId: existing.anchor.id }

  const now = new Date().toISOString()
  const anchorId = createId('anchor')
  const revisionId = createId('revision')
  const anchor: Anchor = {
    id: anchorId,
    createdAt: now,
    updatedAt: now,
    latestRevisionId: revisionId,
    workingRevisionId: revisionId,
    status: 'draft',
  }
  const revision: AnchorRevision = {
    id: revisionId,
    anchorId,
    content: createEmptyContent(),
    createdAt: now,
    source: 'user',
  }

  return {
    anchorId,
    vault: {
      ...vault,
      anchors: [...vault.anchors, anchor],
      revisions: [...vault.revisions, revision],
      updatedAt: now,
    },
  }
}

function replaceRevision(
  vault: VaultData,
  revisionId: string,
  update: (revision: AnchorRevision) => AnchorRevision,
): VaultData {
  return {
    ...vault,
    revisions: vault.revisions.map((revision) =>
      revision.id === revisionId ? update(revision) : revision,
    ),
    updatedAt: new Date().toISOString(),
  }
}

function replaceAnchor(
  vault: VaultData,
  anchorId: string,
  update: (anchor: Anchor) => Anchor,
): VaultData {
  return {
    ...vault,
    anchors: vault.anchors.map((anchor) => (anchor.id === anchorId ? update(anchor) : anchor)),
    updatedAt: new Date().toISOString(),
  }
}

export function ensureWorkingCopy(vault: VaultData, anchorId: string): VaultData {
  const anchor = vault.anchors.find((item) => item.id === anchorId)
  if (!anchor || anchor.workingRevisionId || anchor.deletedAt) return vault
  const latest = getRevision(vault, anchor.latestRevisionId)
  if (!latest) return vault

  const now = new Date().toISOString()
  const revision: AnchorRevision = {
    id: createId('revision'),
    anchorId,
    content: cloneContent(latest.content),
    createdAt: now,
    source: 'user',
  }
  const withRevision = {
    ...vault,
    revisions: [...vault.revisions, revision],
  }
  return replaceAnchor(withRevision, anchorId, (item) => ({
    ...item,
    latestRevisionId: revision.id,
    workingRevisionId: revision.id,
    updatedAt: now,
  }))
}

export function updateAnchorContent(
  vault: VaultData,
  anchorId: string,
  update: (content: AnchorContent) => AnchorContent,
): VaultData {
  const workingVault = ensureWorkingCopy(vault, anchorId)
  const anchor = workingVault.anchors.find((item) => item.id === anchorId)
  if (!anchor?.workingRevisionId) return workingVault
  const revisionId = anchor.workingRevisionId
  return replaceRevision(workingVault, revisionId, (revision) => ({
    ...revision,
    content: update(cloneContent(revision.content)),
  }))
}

function contentEqual(left: AnchorContent, right: AnchorContent): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function commitAnchor(
  vault: VaultData,
  anchorId: string,
  mode: 'session' | 'checkpoint',
): CommitResult {
  const anchor = vault.anchors.find((item) => item.id === anchorId)
  if (!anchor) return { vault, ok: false, message: '没有找到这枚心锚。' }
  const workingId = anchor.workingRevisionId
  if (!workingId) {
    return { vault, ok: true, revisionId: anchor.latestRevisionId }
  }
  const working = getRevision(vault, workingId)
  if (!working) return { vault, ok: false, message: '当前内容不可用。' }
  if (!contentIsMeaningful(working.content)) {
    return { vault, ok: false, message: '留下一句话、一个场景或一张照片，就能封存这次记录。' }
  }

  const previous = vault.revisions
    .filter((revision) => revision.anchorId === anchorId && revision.id !== workingId && revision.committedAt)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]

  if (previous && contentEqual(previous.content, working.content)) {
    const cleanVault = {
      ...vault,
      revisions: vault.revisions.filter((revision) => revision.id !== workingId),
    }
    return {
      ok: true,
      revisionId: previous.id,
      vault: replaceAnchor(cleanVault, anchorId, (item) => ({
        ...item,
        latestRevisionId: previous.id,
        workingRevisionId: undefined,
        status: 'active',
        updatedAt: item.updatedAt,
      })),
    }
  }

  const now = new Date().toISOString()
  let nextVault = replaceRevision(vault, workingId, (revision) => ({
    ...revision,
    committedAt: now,
    source: mode === 'checkpoint' ? 'manual' : revision.source,
  }))

  if (mode === 'checkpoint') {
    const nextWorking: AnchorRevision = {
      id: createId('revision'),
      anchorId,
      content: cloneContent(working.content),
      createdAt: now,
      source: 'user',
    }
    nextVault = {
      ...nextVault,
      revisions: [...nextVault.revisions, nextWorking],
    }
    nextVault = replaceAnchor(nextVault, anchorId, (item) => ({
      ...item,
      latestRevisionId: nextWorking.id,
      workingRevisionId: nextWorking.id,
      status: 'active',
      updatedAt: now,
    }))
  } else {
    nextVault = replaceAnchor(nextVault, anchorId, (item) => ({
      ...item,
      latestRevisionId: workingId,
      workingRevisionId: undefined,
      status: 'active',
      updatedAt: now,
    }))
  }

  return { vault: nextVault, ok: true, revisionId: workingId }
}

export function discardDraft(vault: VaultData, anchorId: string): VaultData {
  const anchor = vault.anchors.find((item) => item.id === anchorId)
  if (!anchor || anchor.status !== 'draft') return vault
  return removeAnchorCompletely(vault, anchorId)
}

export function softDeleteAnchor(vault: VaultData, anchorId: string): VaultData {
  const now = new Date().toISOString()
  return replaceAnchor(vault, anchorId, (anchor) => ({ ...anchor, deletedAt: now, updatedAt: now }))
}

export function restoreAnchor(vault: VaultData, anchorId: string): VaultData {
  const now = new Date().toISOString()
  return replaceAnchor(vault, anchorId, (anchor) => ({
    ...anchor,
    deletedAt: undefined,
    status: 'active',
    updatedAt: now,
  }))
}

export function removeAnchorCompletely(vault: VaultData, anchorId: string): VaultData {
  const revisions = vault.revisions.filter((revision) => revision.anchorId !== anchorId)
  return {
    ...vault,
    anchors: vault.anchors.filter((anchor) => anchor.id !== anchorId),
    revisions,
    heartlines: vault.heartlines.filter(
      (line) => line.anchorAId !== anchorId && line.anchorBId !== anchorId,
    ),
    updatedAt: new Date().toISOString(),
  }
}

export function restoreRevision(
  vault: VaultData,
  anchorId: string,
  revisionId: string,
): VaultData {
  const source = getRevision(vault, revisionId)
  const anchor = vault.anchors.find((item) => item.id === anchorId)
  if (!source || !anchor || source.anchorId !== anchorId) return vault

  const now = new Date().toISOString()
  const restored: AnchorRevision = {
    id: createId('revision'),
    anchorId,
    content: cloneContent(source.content),
    createdAt: now,
    committedAt: now,
    source: 'restore',
    restoredFromRevisionId: source.id,
  }
  const withoutWorking = anchor.workingRevisionId
    ? vault.revisions.filter((revision) => revision.id !== anchor.workingRevisionId)
    : vault.revisions
  const next = { ...vault, revisions: [...withoutWorking, restored] }
  return replaceAnchor(next, anchorId, (item) => ({
    ...item,
    latestRevisionId: restored.id,
    workingRevisionId: undefined,
    status: 'active',
    deletedAt: undefined,
    updatedAt: now,
  }))
}

export function createHeartlineInVault(
  vault: VaultData,
  input: {
    anchorAId: string
    anchorBId: string
    type: HeartlineType
    personIds?: string[]
    note?: string
  },
): { vault: VaultData; line?: Heartline; message?: string } {
  if (input.anchorAId === input.anchorBId) {
    return { vault, message: '一枚心锚不能连接自己。' }
  }
  const endpointsExist = [input.anchorAId, input.anchorBId].every((id) =>
    vault.anchors.some((anchor) => anchor.id === id && !anchor.deletedAt),
  )
  if (!endpointsExist) return { vault, message: '心线两端的心锚不可用。' }

  const duplicate = vault.heartlines.find(
    (line) =>
      !line.deletedAt &&
      line.type === input.type &&
      ((line.anchorAId === input.anchorAId && line.anchorBId === input.anchorBId) ||
        (line.anchorAId === input.anchorBId && line.anchorBId === input.anchorAId)),
  )
  if (duplicate) return { vault, line: duplicate, message: '这两枚心锚已有同类心线。' }

  const now = new Date().toISOString()
  const line: Heartline = {
    id: createId('line'),
    anchorAId: input.anchorAId,
    anchorBId: input.anchorBId,
    type: input.type,
    personIds: input.personIds ?? [],
    note: input.note?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  }
  return {
    line,
    vault: {
      ...vault,
      heartlines: [...vault.heartlines, line],
      updatedAt: now,
    },
  }
}

export function updateHeartlineInVault(
  vault: VaultData,
  lineId: string,
  update: (line: Heartline) => Heartline,
): VaultData {
  const now = new Date().toISOString()
  return {
    ...vault,
    heartlines: vault.heartlines.map((line) =>
      line.id === lineId ? { ...update(line), updatedAt: now } : line,
    ),
    updatedAt: now,
  }
}

export function softDeleteHeartline(vault: VaultData, lineId: string): VaultData {
  return updateHeartlineInVault(vault, lineId, (line) => ({
    ...line,
    deletedAt: new Date().toISOString(),
  }))
}

export function restoreHeartline(vault: VaultData, lineId: string): VaultData {
  return updateHeartlineInVault(vault, lineId, (line) => ({ ...line, deletedAt: undefined }))
}

export function removeHeartlineCompletely(vault: VaultData, lineId: string): VaultData {
  return {
    ...vault,
    heartlines: vault.heartlines.filter((line) => line.id !== lineId),
    updatedAt: new Date().toISOString(),
  }
}

export function upsertPersons(vault: VaultData, names: string[]): { vault: VaultData; personIds: string[] } {
  const persons = [...vault.persons]
  const personIds: string[] = []
  for (const rawName of names) {
    const name = rawName.trim()
    if (!name) continue
    const existing = persons.find((person) => person.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    if (existing) {
      personIds.push(existing.id)
      continue
    }
    const person: Person = {
      id: createId('person'),
      name,
      note: '',
      createdAt: new Date().toISOString(),
    }
    persons.push(person)
    personIds.push(person.id)
  }
  return { personIds, vault: { ...vault, persons } }
}

export function purgeExpiredTrash(vault: VaultData, now = Date.now()): VaultData {
  const cutoff = now - 30 * 24 * 60 * 60 * 1000
  const expiredAnchorIds = new Set(
    vault.anchors
      .filter((anchor) => anchor.deletedAt && Date.parse(anchor.deletedAt) <= cutoff)
      .map((anchor) => anchor.id),
  )
  if (expiredAnchorIds.size === 0) {
    const heartlines = vault.heartlines.filter(
      (line) => !line.deletedAt || Date.parse(line.deletedAt) > cutoff,
    )
    return heartlines.length === vault.heartlines.length ? vault : { ...vault, heartlines }
  }
  return {
    ...vault,
    anchors: vault.anchors.filter((anchor) => !expiredAnchorIds.has(anchor.id)),
    revisions: vault.revisions.filter((revision) => !expiredAnchorIds.has(revision.anchorId)),
    heartlines: vault.heartlines.filter(
      (line) =>
        !expiredAnchorIds.has(line.anchorAId) &&
        !expiredAnchorIds.has(line.anchorBId) &&
        (!line.deletedAt || Date.parse(line.deletedAt) > cutoff),
    ),
    updatedAt: new Date().toISOString(),
  }
}

export function getAllReferencedMediaIds(vault: VaultData): Set<string> {
  return new Set(
    vault.revisions.flatMap((revision) => revision.content.mediaIds),
  )
}

export function isMediaRecord(value: unknown): value is MediaRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<MediaRecord>
  return typeof record.id === 'string' && typeof record.mime === 'string'
}

export function normalizeTag(value: string): string {
  return value.trim().replace(/^#/, '')
}

export function sanitizeTime(time: MemoryTime): MemoryTime {
  if (time.precision === 'unknown') return { precision: 'unknown' }
  if (time.precision === 'exact') return { precision: 'exact', date: time.date }
  if (time.precision === 'month') return { precision: 'month', month: time.month }
  if (time.precision === 'year') return { precision: 'year', year: time.year }
  return {
    precision: 'range',
    startYear: time.startYear,
    endYear: time.endYear,
  }
}

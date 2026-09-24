/* oxlint-disable react/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Heartline, HeartlineType, MediaRecord, VaultData } from '../types'
import {
  commitAnchor,
  createDraftInVault,
  createHeartlineInVault,
  createVault,
  discardDraft,
  getAllReferencedMediaIds,
  purgeExpiredTrash,
  removeAnchorCompletely,
  removeHeartlineCompletely,
  restoreAnchor,
  restoreHeartline,
  restoreRevision,
  softDeleteAnchor,
  softDeleteHeartline,
  updateAnchorContent,
  updateHeartlineInVault,
  upsertPersons,
  type CommitResult,
} from '../lib/domain'
import {
  clearLocalData,
  deleteStoredMedia,
  getAllStoredMedia,
  loadVault,
  putStoredMedia,
  replaceLocalData,
  saveVault,
  type StoredMedia,
} from '../lib/db'
import { createEncryptedBackup, decryptBackup } from '../lib/backup'
import { base64ToBlob, prepareMediaFile } from '../lib/media'
import { createId } from '../lib/id'

interface CreateLineInput {
  anchorAId: string
  anchorBId: string
  type: HeartlineType
  personNames?: string[]
  personIds?: string[]
  note?: string
}

interface VaultContextValue {
  data: VaultData | null
  loading: boolean
  createDraft: () => string | null
  updateContent: (
    anchorId: string,
    update: Parameters<typeof updateAnchorContent>[2],
  ) => void
  commit: (anchorId: string, mode?: 'session' | 'checkpoint') => CommitResult
  discard: (anchorId: string) => void
  deleteAnchor: (anchorId: string) => void
  restoreDeletedAnchor: (anchorId: string) => void
  permanentlyDeleteAnchor: (anchorId: string) => void
  restoreHistoricalRevision: (anchorId: string, revisionId: string) => void
  createLine: (input: CreateLineInput) => { ok: boolean; lineId?: string; message?: string }
  updateLine: (
    lineId: string,
    update: { type?: HeartlineType; note?: string; personNames?: string[] },
  ) => void
  deleteLine: (lineId: string) => void
  restoreDeletedLine: (lineId: string) => void
  permanentlyDeleteLine: (lineId: string) => void
  addMediaFiles: (files: File[]) => Promise<MediaRecord[]>
  exportBackup: (passphrase: string) => Promise<Blob>
  importBackup: (file: File, passphrase: string) => Promise<void>
  clearEverything: () => Promise<void>
}

const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<VaultData | null>(null)
  const [loading, setLoading] = useState(true)
  const dataRef = useRef<VaultData | null>(null)
  const hydratedRef = useRef(false)

  const setVault = (next: VaultData) => {
    dataRef.current = next
    setData(next)
  }

  const mutate = (update: (current: VaultData) => VaultData) => {
    const current = dataRef.current
    if (!current) return
    setVault(update(current))
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await loadVault()
      let next = purgeExpiredTrash(stored ?? createVault())
      if (next) {
        const referenced = getAllReferencedMediaIds(next)
        const storedMedia = await getAllStoredMedia()
        const orphanIds = storedMedia
          .map((item) => item.record.id)
          .filter((id) => !referenced.has(id))
        await deleteStoredMedia(orphanIds)
      }
      if (cancelled) return
      if (next) setVault(next)
      dataRef.current = next
      hydratedRef.current = true
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!data || !hydratedRef.current) return
    const timer = window.setTimeout(() => {
      void saveVault(data)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [data])

  const createDraft = (): string | null => {
    if (!dataRef.current) return null
    const result = createDraftInVault(dataRef.current)
    setVault(result.vault)
    return result.anchorId
  }

  const updateContent: VaultContextValue['updateContent'] = (anchorId, update) => {
    mutate((current) => updateAnchorContent(current, anchorId, update))
  }

  const commit = (anchorId: string, mode: 'session' | 'checkpoint' = 'session') => {
    const current = dataRef.current
    if (!current) return { vault: current ?? ({} as VaultData), ok: false }
    const result = commitAnchor(current, anchorId, mode)
    if (result.vault !== current) setVault(result.vault)
    return result
  }

  const discard = (anchorId: string) => {
    const current = dataRef.current
    if (!current) return
    const mediaIds = current.revisions
      .filter((revision) => revision.anchorId === anchorId)
      .flatMap((revision) => revision.content.mediaIds)
    const next = discardDraft(current, anchorId)
    const referenced = getAllReferencedMediaIds(next)
    const orphanIds = mediaIds.filter((id) => !referenced.has(id))
    setVault(next)
    void deleteStoredMedia(orphanIds)
  }

  const deleteAnchor = (anchorId: string) => mutate((current) => softDeleteAnchor(current, anchorId))
  const restoreDeletedAnchor = (anchorId: string) =>
    mutate((current) => restoreAnchor(current, anchorId))

  const permanentlyDeleteAnchor = (anchorId: string) => {
    const current = dataRef.current
    if (!current) return
    const mediaIds = current.revisions
      .filter((revision) => revision.anchorId === anchorId)
      .flatMap((revision) => revision.content.mediaIds)
    const next = removeAnchorCompletely(current, anchorId)
    const referenced = getAllReferencedMediaIds(next)
    setVault(next)
    void deleteStoredMedia(mediaIds.filter((id) => !referenced.has(id)))
  }

  const restoreHistoricalRevision = (anchorId: string, revisionId: string) =>
    mutate((current) => restoreRevision(current, anchorId, revisionId))

  const createLine: VaultContextValue['createLine'] = (input) => {
    const current = dataRef.current
    if (!current) return { ok: false, message: '资料尚未准备好。' }
    const personResult = upsertPersons(current, [...(input.personNames ?? [])])
    const result = createHeartlineInVault(personResult.vault, {
      anchorAId: input.anchorAId,
      anchorBId: input.anchorBId,
      type: input.type,
      personIds: [...(input.personIds ?? []), ...personResult.personIds],
      note: input.note,
    })
    if (result.vault !== current) setVault(result.vault)
    return {
      ok: Boolean(result.line),
      lineId: result.line?.id,
      message: result.message,
    }
  }

  const updateLine: VaultContextValue['updateLine'] = (lineId, update) => {
    mutate((current) => {
      const personNames = update.personNames ?? []
      const personResult = upsertPersons(current, personNames)
      return updateHeartlineInVault(personResult.vault, lineId, (line) => ({
        ...line,
        type: update.type ?? line.type,
        note: update.note ?? line.note,
        personIds:
          update.personNames !== undefined ? personResult.personIds : line.personIds,
      }))
    })
  }

  const deleteLine = (lineId: string) => mutate((current) => softDeleteHeartline(current, lineId))
  const restoreDeletedLine = (lineId: string) =>
    mutate((current) => restoreHeartline(current, lineId))
  const permanentlyDeleteLine = (lineId: string) =>
    mutate((current) => removeHeartlineCompletely(current, lineId))

  const addMediaFiles: VaultContextValue['addMediaFiles'] = async (files) => {
    const prepared = (await Promise.all(files.map((file) => prepareMediaFile(file)))).filter(
      (item): item is NonNullable<typeof item> => item !== null,
    )
    await Promise.all(prepared.map((item) => putStoredMedia(item.record, item.blob)))
    return prepared.map((item) => item.record)
  }

  const exportBackup = async (passphrase: string) => {
    const current = dataRef.current
    if (!current) throw new Error('还没有可备份的内容。')
    const media = await getAllStoredMedia()
    return createEncryptedBackup(current, media, passphrase)
  }

  const importBackup = async (file: File, passphrase: string) => {
    const payload = await decryptBackup(file, passphrase)
    const media: StoredMedia[] = payload.media.map((item) => ({
      record: item.record,
      blob: base64ToBlob(item.originalBase64, item.record.mime),
    }))
    const next = {
      ...payload.vault,
      vaultId: payload.vault.vaultId || createId('vault'),
    }
    await replaceLocalData(next, media)
    setVault(next)
  }

  const clearEverything = async () => {
    await clearLocalData()
    setVault({
      schemaVersion: 1,
      vaultId: createId('vault'),
      anchors: [],
      revisions: [],
      heartlines: [],
      persons: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <VaultContext.Provider
      value={{
        data,
        loading,
        createDraft,
        updateContent,
        commit,
        discard,
        deleteAnchor,
        restoreDeletedAnchor,
        permanentlyDeleteAnchor,
        restoreHistoricalRevision,
        createLine,
        updateLine,
        deleteLine,
        restoreDeletedLine,
        permanentlyDeleteLine,
        addMediaFiles,
        exportBackup,
        importBackup,
        clearEverything,
      }}
    >
      {children}
    </VaultContext.Provider>
  )
}

export function useVault(): VaultContextValue {
  const context = useContext(VaultContext)
  if (!context) throw new Error('useVault must be used inside VaultProvider')
  return context
}

export function useAnchor(anchorId: string | undefined) {
  const { data } = useVault()
  if (!data || !anchorId) return undefined
  const anchor = data.anchors.find((item) => item.id === anchorId)
  if (!anchor) return undefined
  const revision = data.revisions.find(
    (item) => item.id === (anchor.workingRevisionId ?? anchor.latestRevisionId),
  )
  return revision ? { anchor, revision } : undefined
}

export function useHeartline(lineId: string | undefined): Heartline | undefined {
  const { data } = useVault()
  return data?.heartlines.find((line) => line.id === lineId)
}



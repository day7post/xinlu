import { describe, expect, it } from 'vitest'
import {
  commitAnchor,
  createDraftInVault,
  createHeartlineInVault,
  createVault,
  getActiveAnchorItems,
  getDraftAnchorItem,
  purgeExpiredTrash,
  restoreAnchor,
  softDeleteAnchor,
  updateAnchorContent,
} from '../lib/domain'
import { sortTimeline } from '../lib/date'

describe('心锚领域规则', () => {
  it('保留未完成草稿，并在达到最小内容后完成', () => {
    const vault = createVault()
    const draft = createDraftInVault(vault)
    expect(getDraftAnchorItem(draft.vault)?.anchor.id).toBe(draft.anchorId)

    const invalid = commitAnchor(draft.vault, draft.anchorId, 'session')
    expect(invalid.ok).toBe(false)

    const filled = updateAnchorContent(draft.vault, draft.anchorId, (content) => ({
      ...content,
      text: '那天下午下了很久的雨。',
    }))
    const completed = commitAnchor(filled, draft.anchorId, 'session')
    expect(completed.ok).toBe(true)
    expect(getActiveAnchorItems(completed.vault)).toHaveLength(1)
    expect(getDraftAnchorItem(completed.vault)).toBeUndefined()
  })

  it('再次编辑时创建新的工作版本，不覆盖旧历史', () => {
    const vault = createVault()
    const draft = createDraftInVault(vault)
    const first = updateAnchorContent(draft.vault, draft.anchorId, (content) => ({
      ...content,
      text: '第一次写下这件事。',
    }))
    const completed = commitAnchor(first, draft.anchorId, 'session').vault
    const second = updateAnchorContent(completed, draft.anchorId, (content) => ({
      ...content,
      text: '后来我又补充了细节。',
    }))
    const checkpoint = commitAnchor(second, draft.anchorId, 'checkpoint')
    const committed = checkpoint.vault.revisions.filter((revision) => revision.committedAt)
    expect(committed).toHaveLength(2)
    expect(checkpoint.vault.anchors[0].workingRevisionId).toBeTruthy()
  })

  it('未知时间始终排在底部，已知时间按方向排序', () => {
    const vault = createVault()
    const firstDraft = createDraftInVault(vault)
    const firstFilled = updateAnchorContent(firstDraft.vault, firstDraft.anchorId, (content) => ({
      ...content,
      text: '2020 年的事',
      memoryTime: { precision: 'year', year: 2020 },
    }))
    const firstDone = commitAnchor(firstFilled, firstDraft.anchorId, 'session').vault
    const secondDraft = createDraftInVault(firstDone)
    const secondFilled = updateAnchorContent(secondDraft.vault, secondDraft.anchorId, (content) => ({
      ...content,
      text: '不知道时间的事',
    }))
    const secondDone = commitAnchor(secondFilled, secondDraft.anchorId, 'session').vault

    const newest = sortTimeline(getActiveAnchorItems(secondDone), 'newest')
    expect(newest.at(-1)?.revision.content.text).toBe('不知道时间的事')
  })

  it('拒绝自连接和重复的同类关系', () => {
    const vault = createVault()
    const draft = createDraftInVault(vault)
    const one = updateAnchorContent(draft.vault, draft.anchorId, (content) => ({
      ...content,
      text: '第一件事',
    }))
    const doneOne = commitAnchor(one, draft.anchorId, 'session').vault
    const draftTwo = createDraftInVault(doneOne)
    const two = updateAnchorContent(draftTwo.vault, draftTwo.anchorId, (content) => ({
      ...content,
      text: '第二件事',
    }))
    const doneTwo = commitAnchor(two, draftTwo.anchorId, 'session').vault

    const self = createHeartlineInVault(doneTwo, {
      anchorAId: draft.anchorId,
      anchorBId: draft.anchorId,
      type: 'cause',
    })
    expect(self.line).toBeUndefined()

    const linked = createHeartlineInVault(doneTwo, {
      anchorAId: draft.anchorId,
      anchorBId: draftTwo.anchorId,
      type: 'cause',
    })
    expect(linked.line).toBeTruthy()
    const duplicate = createHeartlineInVault(linked.vault, {
      anchorAId: draftTwo.anchorId,
      anchorBId: draft.anchorId,
      type: 'cause',
    })
    expect(duplicate.line?.id).toBe(linked.line?.id)
    expect(duplicate.message).toContain('已有')
  })

  it('软删除后恢复，过期联系会按 30 天清理', () => {
    const vault = createVault()
    const draft = createDraftInVault(vault)
    const filled = updateAnchorContent(draft.vault, draft.anchorId, (content) => ({
      ...content,
      text: '一枚会被删除的心锚',
    }))
    const completed = commitAnchor(filled, draft.anchorId, 'session').vault
    const deleted = softDeleteAnchor(completed, draft.anchorId)
    expect(deleted.anchors[0].deletedAt).toBeTruthy()
    expect(restoreAnchor(deleted, draft.anchorId).anchors[0].deletedAt).toBeUndefined()

    const expired = {
      ...deleted,
      anchors: deleted.anchors.map((anchor) => ({
        ...anchor,
        deletedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      })),
    }
    expect(purgeExpiredTrash(expired).anchors).toHaveLength(0)
  })
})

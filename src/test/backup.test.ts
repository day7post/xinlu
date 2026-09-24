import { describe, expect, it } from 'vitest'
import { createEncryptedBackup, decryptBackup } from '../lib/backup'
import { createDraftInVault, createVault, updateAnchorContent } from '../lib/domain'

describe('加密备份', () => {
  it('可以用正确口令完整恢复，并在错误口令时拒绝解密', async () => {
    const draft = createDraftInVault(createVault())
    const vault = updateAnchorContent(draft.vault, draft.anchorId, (content) => ({
      ...content,
      text: '这是只属于我的记忆。',
    }))
    const blob = await createEncryptedBackup(vault, [], 'a-strong-passphrase')
    const file = new File([blob], 'backup.xinlu', { type: 'application/json' })

    const restored = await decryptBackup(file, 'a-strong-passphrase')
    expect(restored.vault.revisions[0].content.text).toBe('这是只属于我的记忆。')
    await expect(decryptBackup(file, 'wrong-passphrase')).rejects.toThrow('口令不正确')
  }, 20_000)
})

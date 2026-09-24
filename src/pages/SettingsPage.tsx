import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { HEARTLINE_META } from '../types'
import { deriveSummary, getLatestRevision } from '../lib/domain'
import { downloadBlob } from '../lib/media'
import { useVault } from '../state/VaultContext'
import { LoadingScreen } from '../components/LoadingScreen'

export function SettingsPage() {
  const {
    data,
    loading,
    exportBackup,
    importBackup,
    clearEverything,
    restoreDeletedAnchor,
    permanentlyDeleteAnchor,
    restoreDeletedLine,
    permanentlyDeleteLine,
  } = useVault()
  const [passphrase, setPassphrase] = useState('')
  const [importPassphrase, setImportPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [estimate, setEstimate] = useState<{ usage: number; quota: number } | null>(null)
  const [persistent, setPersistent] = useState(false)

  useEffect(() => {
    void navigator.storage?.estimate?.().then((result) => {
      setEstimate({ usage: result.usage ?? 0, quota: result.quota ?? 0 })
    })
    void navigator.storage?.persisted?.().then(setPersistent)
  }, [])

  if (loading || !data) return <LoadingScreen />

  const deletedAnchors = data.anchors.filter((anchor) => anchor.deletedAt)
  const deletedLines = data.heartlines.filter((line) => line.deletedAt)
  const activeAnchors = data.anchors.filter((anchor) => !anchor.deletedAt && anchor.status === 'active')
  const activeLines = data.heartlines.filter((line) => !line.deletedAt && line.anchorAId !== line.anchorBId)

  const createBackup = async () => {
    setError('')
    setMessage('')
    if (passphrase.length < 8) {
      setError('备份口令至少需要 8 个字符。')
      return
    }
    setBusy(true)
    try {
      const blob = await exportBackup(passphrase)
      const date = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `心络备份-${date}.xinlu`)
      setMessage('加密备份已经下载到这台设备。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '备份没有成功。')
    } finally {
      setBusy(false)
    }
  }

  const restoreBackup = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setMessage('')
    if (!importPassphrase) {
      setError('请先输入这份备份使用的口令。')
      return
    }
    if (!window.confirm('恢复会替换当前全部本地资料。确认继续吗？')) return
    setBusy(true)
    try {
      await importBackup(file, importPassphrase)
      setMessage('备份已恢复，当前资料已经完整替换。')
      setImportPassphrase('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '恢复失败。')
    } finally {
      setBusy(false)
    }
  }

  const requestPersistence = async () => {
    if (!navigator.storage?.persist) return
    const accepted = await navigator.storage.persist()
    setPersistent(accepted)
  }

  const clearAll = async () => {
    const answer = window.prompt('这会永久删除本机上的全部心锚、心线和照片。请输入“清空心络”确认：')
    if (answer !== '清空心络') return
    await clearEverything()
    setMessage('本机资料已经全部清空。')
  }

  return (
    <div className="page settings-page">
      <header className="page-header">
        <p className="eyebrow">所有权与安全</p>
        <h1>我的资料</h1>
        <p>这里没有账号，也没有陌生人。资料默认只属于当前设备。</p>
      </header>

      <section className="metric-grid">
        <div>
          <Archive size={19} />
          <strong>{activeAnchors.length}</strong>
          <span>枚心锚</span>
        </div>
        <div>
          <Database size={19} />
          <strong>{activeLines.length}</strong>
          <span>条心线</span>
        </div>
        <div>
          <HardDrive size={19} />
          <strong>{formatBytes(estimate?.usage ?? 0)}</strong>
          <span>本机占用</span>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">
          <ShieldCheck size={19} />
          <h2>本地与备份</h2>
        </div>
        <div className="privacy-callout">
          <LockKeyhole size={20} />
          <div>
            <strong>备份使用口令加密</strong>
            <p>平台和开发者看不到口令。口令遗失后，无法替你解开备份。</p>
          </div>
        </div>

        <label className="field">
          <span>
            <KeyRound size={15} />
            设置备份口令
          </span>
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="至少 8 个字符"
            autoComplete="new-password"
          />
        </label>
        <button className="primary-button wide" type="button" onClick={createBackup} disabled={busy}>
          <Download size={17} />
          {busy ? '正在整理…' : '下载加密备份'}
        </button>

        <div className="backup-divider">
          <span>或者</span>
        </div>

        <label className="field">
          <span>输入备份口令</span>
          <input
            type="password"
            value={importPassphrase}
            onChange={(event) => setImportPassphrase(event.target.value)}
            placeholder="用来恢复已有备份"
            autoComplete="current-password"
          />
        </label>
        <label className={`secondary-button wide file-button ${busy ? 'disabled' : ''}`}>
          <input
            type="file"
            accept=".xinlu,application/json"
            disabled={busy}
            onChange={(event) => {
              void restoreBackup(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <Upload size={17} />
          从备份恢复
        </label>

        {message && (
          <p className="form-success">
            <CheckCircle2 size={16} />
            {message}
          </p>
        )}
        {error && (
          <p className="form-error">
            <AlertTriangle size={16} />
            {error}
          </p>
        )}

        <div className="storage-row">
          <div>
            <strong>防止浏览器自动清理</strong>
            <small>申请持久存储后，空间紧张时更不容易被系统移除。</small>
          </div>
          <button type="button" onClick={requestPersistence} disabled={persistent}>
            {persistent ? '已经保护' : '申请保护'}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">
          <Trash2 size={19} />
          <h2>回收站</h2>
        </div>
        <p className="settings-description">删除后保留 30 天。恢复心锚时，原来的心线也会重新出现。</p>

        {deletedAnchors.length === 0 && deletedLines.length === 0 ? (
          <div className="empty-inline">
            <p>回收站是空的。</p>
          </div>
        ) : (
          <div className="trash-list">
            {deletedAnchors.map((anchor) => {
              const revision = getLatestRevision(data, anchor)
              return (
                <div className="trash-item" key={anchor.id}>
                  <span>
                    <strong>{revision ? deriveSummary(revision.content) : '已删除的心锚'}</strong>
                    <small>心锚 · {formatRemaining(anchor.deletedAt)}</small>
                  </span>
                  <button type="button" onClick={() => restoreDeletedAnchor(anchor.id)}>
                    <RotateCcw size={15} />
                    恢复
                  </button>
                  <button
                    type="button"
                    className="danger-text"
                    onClick={() => {
                      if (window.confirm('永久删除这枚心锚、其照片和所有相关心线？此操作不能撤销。')) {
                        permanentlyDeleteAnchor(anchor.id)
                      }
                    }}
                  >
                    永久删除
                  </button>
                </div>
              )
            })}
            {deletedLines.map((line) => (
              <div className="trash-item" key={line.id}>
                <span>
                  <strong>{HEARTLINE_META[line.type].label}心线</strong>
                  <small>心线 · {formatRemaining(line.deletedAt)}</small>
                </span>
                <button type="button" onClick={() => restoreDeletedLine(line.id)}>
                  <RotateCcw size={15} />
                  恢复
                </button>
                <button
                  type="button"
                  className="danger-text"
                  onClick={() => {
                    if (window.confirm('永久删除这条心线？此操作不能撤销。')) {
                      permanentlyDeleteLine(line.id)
                    }
                  }}
                >
                  永久删除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="settings-section danger-zone">
        <div className="section-title">
          <AlertTriangle size={19} />
          <h2>清空本地资料</h2>
        </div>
        <p>删除全部心锚、心线、版本和照片。请先下载备份。</p>
        <button type="button" className="danger-button" onClick={clearAll}>
          清空这台设备上的心络
        </button>
      </section>

      <footer className="app-version">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <p>心络 MVP · 本地匿名版</p>
        <small>你的感受不是诊断结果，这里也不替你定义完成。</small>
      </footer>
    </div>
  )
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatRemaining(deletedAt?: string): string {
  if (!deletedAt) return '等待清理'
  const remaining = Math.max(
    0,
    Math.ceil((Date.parse(deletedAt) + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000)),
  )
  return `还剩 ${remaining} 天`
}

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Database,
  Download,
  FileText,
  HardDrive,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { HEARTLINE_META } from '../types'
import { deriveSummary, getLatestRevision } from '../lib/domain'
import { formatShortDate } from '../lib/date'
import { buildMarkdownExport, buildPlainExport } from '../lib/export'
import { hasDemoData } from '../lib/demo'
import { downloadBlob } from '../lib/media'
import {
  decideSync,
  loadSyncConfig,
  loadSyncState,
  REMOTE_VAULT_FILE,
  saveSyncConfig,
  saveSyncState,
  setSessionSecrets,
  type SyncConfig,
} from '../lib/sync'
import { WebDavProvider } from '../lib/webdav'
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
    seedDemo,
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

  const downloadPlain = (kind: 'json' | 'markdown') => {
    setError('')
    setMessage('')
    try {
      const date = new Date().toISOString().slice(0, 10)
      if (kind === 'json') {
        downloadBlob(
          new Blob([JSON.stringify(buildPlainExport(data), null, 2)], { type: 'application/json' }),
          `心络导出-${date}.json`,
        )
      } else {
        downloadBlob(
          new Blob([buildMarkdownExport(data)], { type: 'text/markdown' }),
          `心络导出-${date}.md`,
        )
      }
      setMessage('明文导出已经下载。注意：明文没有加密，请妥善保管，不要随手转发。')
    } catch {
      setError('导出没有成功。')
    }
  }

  const loadDemo = () => {
    setError('')
    setMessage('')
    const result = seedDemo()
    if (result.ok) setMessage('示例已经载入。去时间轴或心图看看，示例都带「示例」标签，可随时删除。')
    else setError(result.message ?? '示例载入失败。')
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
        <p>本地使用不需要账号。资料默认只属于当前设备；跨端同步完全可选，同步的也只是密文。</p>
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

      <SyncSection />

      <section className="settings-section">
        <div className="section-title">
          <FileText size={19} />
          <h2>明文导出</h2>
        </div>
        <p className="settings-description">
          把文字内容导出成能直接打开阅读的文件。明文没有加密，请妥善保管；照片不在明文导出里，包含照片的完整恢复请用上面的加密备份。
        </p>
        <div className="export-actions">
          <button className="secondary-button wide" type="button" onClick={() => downloadPlain('markdown')}>
            <Download size={17} />
            导出 Markdown（适合阅读与打印）
          </button>
          <button className="secondary-button wide" type="button" onClick={() => downloadPlain('json')}>
            <Download size={17} />
            导出 JSON（适合留存与迁移）
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">
          <Sparkles size={19} />
          <h2>示例数据</h2>
        </div>
        <p className="settings-description">
          载入一组虚构的心锚与心线，先看清时间轴和心图长什么样。示例都带「示例」标签，可随时逐条删除。
        </p>
        <button className="secondary-button wide" type="button" onClick={loadDemo} disabled={hasDemoData(data)}>
          {hasDemoData(data) ? '示例已经在了' : '载入示例'}
        </button>
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

function SyncSection() {
  const { data, exportBackup, importBackup, vaultUpdatedAt } = useVault()
  const [config, setConfig] = useState<SyncConfig>(() => loadSyncConfig())
  const [appPassword, setAppPassword] = useState(() => loadSyncConfig().appPassword ?? '')
  const [passphrase, setPassphrase] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => loadSyncState().lastSyncAt)
  const conflictBlobRef = useRef<Blob | null>(null)
  const conflictEtagRef = useRef<string | null>(null)

  const buildProvider = () =>
    new WebDavProvider({
      server: config.server.trim(),
      username: config.username.trim(),
      appPassword,
      dir: config.dir.trim() || 'xinlu',
    })

  const validate = (): string | null => {
    if (!config.server.trim()) return '请先填写 WebDAV 服务器地址。'
    if (!config.username.trim()) return '请先填写账号（坚果云为注册邮箱）。'
    if (!appPassword) return '请先填写应用密码。'
    if (passphrase.length < 8) return '同步口令至少需要 8 个字符（与备份口令同一套规则）。'
    return null
  }

  const finishSync = (etag: string | null, message: string) => {
    const state = loadSyncState()
    const now = new Date().toISOString()
    saveSyncState({ ...state, lastEtag: etag, lastSyncAt: now })
    setLastSyncAt(now)
    setSessionSecrets({ appPassword, passphrase })
    setConflict(false)
    conflictBlobRef.current = null
    setStatus(message)
  }

  const doPush = async (provider: WebDavProvider) => {
    const blob = await exportBackup(passphrase)
    const result = await provider.put(REMOTE_VAULT_FILE, blob)
    const etag = result.etag ?? (await provider.head(REMOTE_VAULT_FILE))?.etag ?? null
    finishSync(etag, '已把本机密文推送到云端。在另一台设备上用同一账号与同步口令即可拉取。')
  }

  const doPull = async (blob: Blob, etag: string | null) => {
    await importBackup(new File([blob], REMOTE_VAULT_FILE), passphrase)
    finishSync(etag, '已从云端拉取并解密，本机资料已更新为云端版本。')
  }

  const runSync = async (force?: 'push' | 'pull') => {
    const invalid = validate()
    if (invalid) {
      setError(invalid)
      setStatus('')
      return
    }
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const provider = buildProvider()
      await provider.ensureDir()
      const state = loadSyncState()

      if (force === 'push') {
        await doPush(provider)
        return
      }
      if (force === 'pull' && conflictBlobRef.current) {
        await doPull(conflictBlobRef.current, conflictEtagRef.current)
        return
      }

      const info = await provider.head(REMOTE_VAULT_FILE)
      const remoteExists = Boolean(info)
      const remoteChanged = remoteExists && info?.etag !== state.lastEtag
      const hasContent = Boolean(
        data && (data.anchors.length > 0 || data.heartlines.length > 0 || data.persons.length > 0),
      )
      const updatedAt = vaultUpdatedAt()
      const localDirty = state.lastSyncAt
        ? Boolean(updatedAt && updatedAt > state.lastSyncAt)
        : hasContent
      const decision = decideSync({ remoteExists, remoteChanged, localDirty })

      if (decision === 'push-first' || decision === 'push') {
        await doPush(provider)
      } else if (decision === 'pull') {
        const { blob, etag } = await provider.get(REMOTE_VAULT_FILE)
        await doPull(blob, etag ?? info?.etag ?? null)
      } else if (decision === 'conflict') {
        const { blob, etag } = await provider.get(REMOTE_VAULT_FILE)
        conflictBlobRef.current = blob
        conflictEtagRef.current = etag ?? info?.etag ?? null
        setConflict(true)
        setStatus('两边都改过。为了不丢数据，请选一个为准：以本机为准会用本机密文覆盖云端；以云端为准会用云端密文覆盖本机。')
      } else {
        setStatus('已是最新，本机与云端没有差异。')
        setSessionSecrets({ appPassword, passphrase })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '同步没有成功。')
    } finally {
      setBusy(false)
    }
  }

  const testConnection = async () => {
    if (!config.server.trim() || !config.username.trim() || !appPassword) {
      setError('先填写服务器地址、账号和应用密码，再测试连接。')
      setStatus('')
      return
    }
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await buildProvider().testConnection()
      setStatus('连接成功，账号与应用密码可用。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '连接失败。')
    } finally {
      setBusy(false)
    }
  }

  const persistConfig = () => {
    saveSyncConfig({ ...config, appPassword: config.rememberPassword ? appPassword : undefined })
    setStatus('同步设置已保存在这台设备上。同步口令不会保存，每次同步时输入。')
    setError('')
  }

  return (
    <section className="settings-section">
      <div className="section-title">
        <RefreshCw size={19} />
        <h2>跨端同步（WebDAV）</h2>
      </div>
      <p className="settings-description">
        可选功能。用你自己的 WebDAV 网盘（例如坚果云）在多台设备间同步：上传的始终是与加密备份同一种密文，服务器看不到内容。注意：坚果云没有开放浏览器跨域，网页直连会被拦截，需要改用支持跨域的 WebDAV，或把你自己的代理地址填在服务器地址里。
      </p>

      <label className="field">
        <span>服务器地址</span>
        <input
          value={config.server}
          onChange={(event) => setConfig({ ...config, server: event.target.value })}
          placeholder="https://dav.jianguoyun.com/dav/"
          autoComplete="url"
        />
      </label>
      <label className="field">
        <span>账号</span>
        <input
          value={config.username}
          onChange={(event) => setConfig({ ...config, username: event.target.value })}
          placeholder="坚果云为注册邮箱"
          autoComplete="username"
        />
      </label>
      <label className="field">
        <span>应用密码</span>
        <input
          type="password"
          value={appPassword}
          onChange={(event) => setAppPassword(event.target.value)}
          placeholder="在网盘网页版生成，不是登录密码"
          autoComplete="current-password"
        />
      </label>
      <label className="field">
        <span>远程目录</span>
        <input
          value={config.dir}
          onChange={(event) => setConfig({ ...config, dir: event.target.value })}
          placeholder="xinlu"
        />
      </label>
      <label className="field">
        <span>
          <KeyRound size={15} />
          同步口令
        </span>
        <input
          type="password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          placeholder="至少 8 个字符，每台设备用同一个"
          autoComplete="new-password"
        />
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          checked={config.rememberPassword}
          onChange={(event) => setConfig({ ...config, rememberPassword: event.target.checked })}
        />
        <span>记住应用密码（保存在这台设备的浏览器里，方便下次同步；同步口令永不保存）</span>
      </label>

      <div className="export-actions">
        <button className="secondary-button wide" type="button" onClick={persistConfig} disabled={busy}>
          保存设置
        </button>
        <button className="secondary-button wide" type="button" onClick={testConnection} disabled={busy}>
          测试连接
        </button>
        <button className="primary-button wide" type="button" onClick={() => void runSync()} disabled={busy}>
          <RefreshCw size={17} />
          {busy ? '正在同步…' : '立即同步'}
        </button>
      </div>

      {conflict && (
        <div className="export-actions">
          <button className="secondary-button wide" type="button" onClick={() => void runSync('push')} disabled={busy}>
            以本机为准（覆盖云端）
          </button>
          <button className="secondary-button wide" type="button" onClick={() => void runSync('pull')} disabled={busy}>
            以云端为准（覆盖本机）
          </button>
        </div>
      )}

      {lastSyncAt && <p className="settings-description">上次同步：{formatShortDate(lastSyncAt)}</p>}
      {status && (
        <p className="form-success">
          <CheckCircle2 size={16} />
          {status}
        </p>
      )}
      {error && (
        <p className="form-error">
          <AlertTriangle size={16} />
          {error}
        </p>
      )}
    </section>
  )
}

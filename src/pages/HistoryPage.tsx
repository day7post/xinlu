import { ArrowLeft, Clock3, History, RotateCcw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { deriveSummary } from '../lib/domain'
import { formatShortDate } from '../lib/date'
import { useAnchor, useVault } from '../state/VaultContext'
import { LoadingScreen } from '../components/LoadingScreen'

const SOURCE_LABEL = {
  user: '记录会话',
  manual: '手动留档',
  restore: '恢复历史',
  import: '导入',
}

export function HistoryPage() {
  const { anchorId } = useParams()
  const navigate = useNavigate()
  const item = useAnchor(anchorId)
  const { data, loading, restoreHistoricalRevision } = useVault()

  if (loading) return <LoadingScreen />
  if (!data || !anchorId || !item) {
    return (
      <div className="center-page">
        <p>没有找到这枚心锚。</p>
      </div>
    )
  }

  const history = data.revisions
    .filter((revision) => revision.anchorId === anchorId && revision.committedAt)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))

  return (
    <div className="page history-page">
      <header className="detail-topbar">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="返回">
          <ArrowLeft size={21} />
        </button>
        <span>历史版本</span>
        <History size={20} />
      </header>

      <section className="history-intro">
        <h1>心锚可以变化</h1>
        <p>旧版本不会消失。恢复某次记录时，会生成一个新的版本。</p>
      </section>

      <div className="history-list">
        {history.map((revision, index) => {
          const isCurrent = revision.id === item.revision.id
          return (
            <article className={isCurrent ? 'history-item current' : 'history-item'} key={revision.id}>
              <div className="history-marker">
                <span />
                {index < history.length - 1 && <i />}
              </div>
              <div className="history-card">
                <div className="history-meta">
                  <span>{isCurrent ? '当前版本' : SOURCE_LABEL[revision.source]}</span>
                  <time>
                    <Clock3 size={14} />
                    {formatShortDate(revision.committedAt ?? revision.createdAt)}
                  </time>
                </div>
                <strong>{deriveSummary(revision.content)}</strong>
                {revision.content.text && <p>{revision.content.text}</p>}
                {revision.restoredFromRevisionId && <small>由更早的版本恢复而来</small>}
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => {
                      restoreHistoricalRevision(anchorId, revision.id)
                      navigate(`/anchor/${anchorId}`)
                    }}
                  >
                    <RotateCcw size={15} />
                    恢复为新版本
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

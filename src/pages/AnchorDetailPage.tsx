import { useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Edit3,
  History,
  Link2,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { HEARTLINE_META } from '../types'
import { deriveSummary, getAnchorItem, getLatestRevision } from '../lib/domain'
import { formatMemoryTime, formatShortDate } from '../lib/date'
import { useAnchor, useVault } from '../state/VaultContext'
import { MediaImage } from '../components/MediaImage'
import { LoadingScreen } from '../components/LoadingScreen'

export function AnchorDetailPage() {
  const { anchorId } = useParams()
  const navigate = useNavigate()
  const item = useAnchor(anchorId)
  const { data, loading, deleteAnchor, restoreDeletedAnchor } = useVault()
  const [expanded, setExpanded] = useState(false)

  if (loading) return <LoadingScreen />
  if (!data || !anchorId || !item) {
    return (
      <div className="center-page">
        <p>这枚心锚不存在，可能已经被永久删除。</p>
        <button className="primary-button" type="button" onClick={() => navigate('/')}>
          返回时间轴
        </button>
      </div>
    )
  }

  const { anchor, revision } = item
  if (anchor.deletedAt) {
    return (
      <div className="center-page">
        <Trash2 size={28} />
        <h1>它在回收站里</h1>
        <p>恢复后，相关心线会重新出现在时间轴上。</p>
        <button className="primary-button" type="button" onClick={() => restoreDeletedAnchor(anchor.id)}>
          <RotateCcw size={17} />
          恢复这枚心锚
        </button>
      </div>
    )
  }

  const content = revision.content
  const summary = deriveSummary(content)
  const hasFullText = Boolean(content.text.trim()) && content.text.trim() !== summary
  const relatedLines = data.heartlines.filter(
    (line) =>
      !line.deletedAt && (line.anchorAId === anchor.id || line.anchorBId === anchor.id),
  )

  return (
    <div className="page detail-page">
      <header className="detail-topbar">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="返回">
          <ArrowLeft size={21} />
        </button>
        <span>心锚</span>
        <button
          type="button"
          className="icon-button danger-hover"
          onClick={() => {
            if (window.confirm('移入回收站？30 天内可以恢复。')) {
              deleteAnchor(anchor.id)
              navigate('/')
            }
          }}
          aria-label="删除心锚"
        >
          <Trash2 size={20} />
        </button>
      </header>

      <article className="anchor-detail-card">
        <div className="detail-kicker">
          <span>{content.form === 'photo' ? '照片记忆' : content.form === 'scene' ? '场景记忆' : '一段记忆'}</span>
          <time>{formatMemoryTime(content.memoryTime)}</time>
        </div>
        <h1>{summary}</h1>

        {hasFullText && (
          <>
            <button
              className="expand-copy"
              type="button"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? '收起全文' : '展开全文'}
              {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            {expanded && <div className="full-memory-copy">{content.text}</div>}
          </>
        )}

        {content.mediaIds.length > 0 && (
          <div className="detail-photos">
            {content.mediaIds.map((mediaId, index) => (
              <MediaImage
                key={mediaId}
                mediaId={mediaId}
                alt={`心锚照片 ${index + 1}`}
                useOriginal
              />
            ))}
          </div>
        )}

        <div className="detail-meta">
          <span>
            <CalendarDays size={16} />
            记录于 {formatShortDate(anchor.createdAt)}
          </span>
          {anchor.updatedAt !== anchor.createdAt && (
            <span>
              <History size={16} />
              最近修改 {formatShortDate(anchor.updatedAt)}
            </span>
          )}
        </div>

        {content.tags.length > 0 && (
          <div className="chip-cloud detail-tags">
            {content.tags.map((tag) => (
              <Link className="chip" to={`/search?tag=${encodeURIComponent(tag)}`} key={tag}>
                {tag}
              </Link>
            ))}
          </div>
        )}
      </article>

      {(content.emotionsThen.length > 0 || content.emotionsNow.length > 0) && (
        <section className="detail-section">
          <div className="section-title">
            <Clock3 size={18} />
            <h2>情绪</h2>
          </div>
          <div className="emotion-columns">
            <EmotionList title="当时" items={content.emotionsThen} />
            <EmotionList title="现在" items={content.emotionsNow} />
          </div>
        </section>
      )}

      <section className="detail-section">
        <div className="section-title split">
          <span>
            <Link2 size={18} />
            <h2>心线</h2>
          </span>
          <button type="button" onClick={() => navigate(`/connect/${anchor.id}`)}>
            <Plus size={16} />
            连一条心线
          </button>
        </div>
        {relatedLines.length === 0 ? (
          <div className="empty-inline">
            <p>这段记忆还没有和其他经历连起来。</p>
            <small>以后想起关联时，再连也不迟。</small>
          </div>
        ) : (
          <div className="related-lines">
            {relatedLines.map((line) => {
              const otherId = line.anchorAId === anchor.id ? line.anchorBId : line.anchorAId
              const other = getAnchorItem(data, otherId)
              const otherRevision = other ? getLatestRevision(data, other.anchor) : undefined
              return (
                <Link className="related-line" to={`/line/${line.id}`} key={line.id}>
                  <span
                    className="relation-dot"
                    style={{ backgroundColor: HEARTLINE_META[line.type].color }}
                  />
                  <span>
                    <small>{HEARTLINE_META[line.type].label}心线</small>
                    <strong>{otherRevision ? deriveSummary(otherRevision.content) : '已不可见的心锚'}</strong>
                    {line.note && <em>{line.note}</em>}
                  </span>
                  <ChevronDown className="related-arrow" size={17} />
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <div className="detail-actions">
        <button className="secondary-button" type="button" onClick={() => navigate(`/anchor/${anchor.id}/history`)}>
          <History size={17} />
          历史版本
        </button>
        <button className="primary-button" type="button" onClick={() => navigate(`/editor/${anchor.id}`)}>
          <Edit3 size={17} />
          继续补充
        </button>
      </div>
    </div>
  )
}

function EmotionList({
  title,
  items,
}: {
  title: string
  items: { id: string; label: string; intensity?: number; note?: string }[]
}) {
  return (
    <div className="emotion-list">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <small>没有记录</small>
      ) : (
        items.map((item) => (
          <div className="emotion-observation" key={item.id}>
            <span>
              {item.label}
              {item.intensity && <small>强度 {item.intensity}</small>}
            </span>
            {item.note && <p>{item.note}</p>}
          </div>
        ))
      )}
    </div>
  )
}

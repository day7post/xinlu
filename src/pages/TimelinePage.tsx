import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownUp, Link2, Plus, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { HEARTLINE_META, type AnchorWithRevision } from '../types'
import { deriveSummary, getActiveAnchorItems, getDraftAnchorItem } from '../lib/domain'
import { formatMemoryTime, sortTimeline } from '../lib/date'
import { useVault } from '../state/VaultContext'
import { MediaImage } from '../components/MediaImage'
import { LoadingScreen } from '../components/LoadingScreen'

interface Point {
  x: number
  y: number
}

export function TimelinePage() {
  const { data, loading, createDraft } = useVault()
  const navigate = useNavigate()
  const [direction, setDirection] = useState<'newest' | 'oldest'>('newest')
  const [visibleCount, setVisibleCount] = useState(80)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>())
  const [points, setPoints] = useState(new Map<string, Point>())

  const allItems = useMemo(
    () => sortTimeline(data ? getActiveAnchorItems(data) : [], direction),
    [data, direction],
  )
  const items = useMemo(() => allItems.slice(0, visibleCount), [allItems, visibleCount])
  const draft = data ? getDraftAnchorItem(data) : undefined

  const lines = useMemo(() => {
    if (!data) return []
    const visibleIds = new Set(items.map((item) => item.anchor.id))
    return data.heartlines.filter(
      (line) =>
        !line.deletedAt &&
        visibleIds.has(line.anchorAId) &&
        visibleIds.has(line.anchorBId),
    )
  }, [data, items])

  const counts = useMemo(() => {
    const result = new Map<string, number>()
    if (!data) return result
    for (const line of data.heartlines) {
      if (line.deletedAt) continue
      result.set(line.anchorAId, (result.get(line.anchorAId) ?? 0) + 1)
      result.set(line.anchorBId, (result.get(line.anchorBId) ?? 0) + 1)
    }
    return result
  }, [data])

  useLayoutEffect(() => {
    const update = () => {
      const container = trackRef.current
      if (!container) return
      const containerRect = container.getBoundingClientRect()
      const next = new Map<string, Point>()
      for (const [id, element] of nodeRefs.current) {
        const rect = element.getBoundingClientRect()
        next.set(id, {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
        })
      }
      setPoints(next)
    }
    update()
    const observer = new ResizeObserver(update)
    if (trackRef.current) observer.observe(trackRef.current)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [items])

  const addAnchor = () => {
    const id = createDraft()
    if (id) navigate(`/editor/${id}`)
  }

  if (loading) return <LoadingScreen />

  const groups = groupTimelineItems(items)

  return (
    <div className="page timeline-page">
      <header className="page-header timeline-header">
        <div>
          <p className="eyebrow">你的心图</p>
          <h1>时间轴</h1>
          <p>{allItems.length ? `已留下 ${allItems.length} 枚心锚` : '从一段真实经历开始'}</p>
        </div>
        <button
          className="sort-button"
          type="button"
          onClick={() => setDirection((value) => (value === 'newest' ? 'oldest' : 'newest'))}
        >
          <ArrowDownUp size={16} />
          {direction === 'newest' ? '最新在前' : '最早在前'}
        </button>
      </header>

      {draft && (
        <section className="draft-banner">
          <span className="draft-icon">
            <Sparkles size={17} />
          </span>
          <span>
            <strong>上次还没有写完</strong>
            <small>{deriveSummary(draft.revision.content)}</small>
          </span>
          <button type="button" onClick={() => navigate(`/editor/${draft.anchor.id}`)}>
            继续
          </button>
        </section>
      )}

      {allItems.length === 0 ? (
        <section className="empty-state">
          <div className="empty-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="eyebrow">不需要从完整故事开始</p>
          <h2>留下一句话就够了</h2>
          <p>一句话、一张照片、一个场景，都可以成为第一枚心锚。</p>
          <button className="primary-button" type="button" onClick={addAnchor}>
            <Plus size={18} />
            写下第一枚心锚
          </button>
          <small>内容只保存在这台设备上，可以随时停下。</small>
        </section>
      ) : (
        <div className="timeline-track" ref={trackRef}>
          <svg className="heartline-layer" aria-hidden="true">
            {lines.map((line) => {
              const a = points.get(line.anchorAId)
              const b = points.get(line.anchorBId)
              if (!a || !b) return null
              const active = selectedId === line.anchorAId || selectedId === line.anchorBId
              const curve = Math.min(96, Math.max(34, Math.abs(a.y - b.y) * 0.18))
              const path = `M ${a.x} ${a.y} C ${a.x + curve} ${a.y}, ${b.x + curve} ${b.y}, ${b.x} ${b.y}`
              return (
                <path
                  key={line.id}
                  d={path}
                  className={active ? 'heartline active' : 'heartline'}
                  style={{ stroke: HEARTLINE_META[line.type].color }}
                />
              )
            })}
          </svg>

          {groups.map((group) => (
            <section className="timeline-group" key={group.label}>
              <h2 className="timeline-date">{group.label}</h2>
              <div className="timeline-list">
                {group.items.map((item) => {
                  const { anchor, revision } = item
                  const selected = selectedId === anchor.id
                  const count = counts.get(anchor.id) ?? 0
                  return (
                    <article className={selected ? 'timeline-item selected' : 'timeline-item'} key={anchor.id}>
                      <button
                        ref={(element) => {
                          if (element) nodeRefs.current.set(anchor.id, element)
                          else nodeRefs.current.delete(anchor.id)
                        }}
                        type="button"
                        className={`anchor-node ${selected ? 'selected' : ''}`}
                        onClick={() => setSelectedId(selected ? null : anchor.id)}
                        aria-label={selected ? '取消高亮这枚心锚' : `高亮这枚心锚的连接，共 ${count} 条`}
                      >
                        <span />
                      </button>
                      <button
                        className="memory-card"
                        type="button"
                        onClick={() => navigate(`/anchor/${anchor.id}`)}
                      >
                        {revision.content.mediaIds[0] && (
                          <MediaImage
                            className="memory-thumb"
                            mediaId={revision.content.mediaIds[0]}
                            alt="心锚照片"
                          />
                        )}
                        <span className="memory-card-copy">
                          <strong>{deriveSummary(revision.content)}</strong>
                          {revision.content.text && revision.content.text !== deriveSummary(revision.content) && (
                            <span className="memory-preview">{revision.content.text}</span>
                          )}
                          <span className="memory-meta">
                            <time>{formatMemoryTime(revision.content.memoryTime)}</time>
                            {revision.content.tags.slice(0, 3).map((tag) => (
                              <span className="tiny-tag" key={tag}>
                                {tag}
                              </span>
                            ))}
                          </span>
                        </span>
                        {count > 0 && (
                          <span className="connection-count">
                            <Link2 size={15} />
                            {count}
                          </span>
                        )}
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}

          {visibleCount < allItems.length && (
            <button
              className="load-more"
              type="button"
              onClick={() => setVisibleCount((count) => count + 80)}
            >
              继续载入更早的记忆
            </button>
          )}
          <p className="timeline-hint">
            点一下节点，就能看清它和哪些记忆相连。
          </p>
        </div>
      )}

      <button className="floating-create" type="button" onClick={addAnchor}>
        <Plus size={21} />
        写下心锚
      </button>
    </div>
  )
}

function groupTimelineItems(items: AnchorWithRevision[]) {
  const groups: { label: string; items: AnchorWithRevision[] }[] = []
  for (const item of items) {
    const label = formatMemoryTime(item.revision.content.memoryTime)
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}


import { useMemo, useState } from 'react'
import { ArrowRight, Link2, Network, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { HEARTLINE_META, type HeartlineType } from '../types'
import { deriveSummary, getActiveAnchorItems } from '../lib/domain'
import { formatMemoryTime } from '../lib/date'
import { computeGraphLayout } from '../lib/graph'
import { useVault } from '../state/VaultContext'
import { LoadingScreen } from '../components/LoadingScreen'

const GRAPH_WIDTH = 840
const GRAPH_HEIGHT = 620

type TypeFilter = 'all' | HeartlineType

function truncate(value: string, max = 9): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

export function GraphPage() {
  const { data, loading, createDraft } = useVault()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<TypeFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const items = useMemo(() => (data ? getActiveAnchorItems(data) : []), [data])
  const itemById = useMemo(() => new Map(items.map((item) => [item.anchor.id, item])), [items])

  const allLines = useMemo(() => {
    if (!data) return []
    return data.heartlines.filter(
      (line) => !line.deletedAt && itemById.has(line.anchorAId) && itemById.has(line.anchorBId),
    )
  }, [data, itemById])

  const degrees = useMemo(() => {
    const result = new Map<string, number>()
    for (const line of allLines) {
      result.set(line.anchorAId, (result.get(line.anchorAId) ?? 0) + 1)
      result.set(line.anchorBId, (result.get(line.anchorBId) ?? 0) + 1)
    }
    return result
  }, [allLines])

  const layout = useMemo(
    () =>
      computeGraphLayout(
        items.map((item) => ({ id: item.anchor.id, weight: degrees.get(item.anchor.id) ?? 0 })),
        allLines.map((line) => ({ a: line.anchorAId, b: line.anchorBId })),
        GRAPH_WIDTH,
        GRAPH_HEIGHT,
      ),
    [items, allLines, degrees],
  )

  const visibleLines = useMemo(
    () => allLines.filter((line) => filter === 'all' || line.type === filter),
    [allLines, filter],
  )

  const neighbours = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const result = new Set<string>()
    for (const line of allLines) {
      if (line.anchorAId === selectedId) result.add(line.anchorBId)
      if (line.anchorBId === selectedId) result.add(line.anchorAId)
    }
    return result
  }, [allLines, selectedId])

  if (loading || !data) return <LoadingScreen />

  const selected = selectedId ? itemById.get(selectedId) : undefined
  const isolated = items.filter((item) => (degrees.get(item.anchor.id) ?? 0) === 0)

  const addAnchor = () => {
    const id = createDraft()
    if (id) navigate(`/editor/${id}`)
  }

  return (
    <div className="page graph-page">
      <header className="page-header">
        <p className="eyebrow">你的心图</p>
        <h1>心图</h1>
        <p>
          {items.length > 0
            ? `${items.length} 枚心锚，${allLines.length} 条心线。点一个节点，看它与谁相连。`
            : '心锚连成心线之后，这里会长出一张属于你的网。'}
        </p>
      </header>

      {items.length === 0 ? (
        <section className="empty-state">
          <div className="empty-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="eyebrow">从第一枚心锚开始</p>
          <h2>先留下一句话</h2>
          <p>写下两枚以上的心锚，再把它们连起来，心图就会出现。</p>
          <button className="primary-button" type="button" onClick={addAnchor}>
            <Plus size={18} />
            写下第一枚心锚
          </button>
        </section>
      ) : (
        <>
          <div className="graph-toolbar">
            <div className="chip-cloud" role="group" aria-label="按心线类型筛选">
              <button
                type="button"
                className={filter === 'all' ? 'chip selected' : 'chip'}
                onClick={() => setFilter('all')}
              >
                全部心线
              </button>
              {(Object.keys(HEARTLINE_META) as HeartlineType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={filter === type ? 'chip selected' : 'chip'}
                  onClick={() => setFilter(type)}
                >
                  <span
                    className="legend-dot"
                    style={{ background: HEARTLINE_META[type].color }}
                    aria-hidden="true"
                  />
                  {HEARTLINE_META[type].label}
                </button>
              ))}
            </div>
            <p className="graph-hint">
              <Network size={14} />
              节点越大，连接越多
            </p>
          </div>

          <section className="graph-wrap" aria-label="心锚关系图">
            <svg
              className="graph-svg"
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
              role="img"
              aria-label={`共 ${items.length} 枚心锚、${visibleLines.length} 条当前可见心线`}
            >
              {visibleLines.map((line) => {
                const a = layout.get(line.anchorAId)
                const b = layout.get(line.anchorBId)
                if (!a || !b) return null
                const highlighted =
                  !selectedId || line.anchorAId === selectedId || line.anchorBId === selectedId
                return (
                  <line
                    key={line.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={highlighted ? 'graph-edge' : 'graph-edge dimmed'}
                    style={{ stroke: HEARTLINE_META[line.type].color }}
                  />
                )
              })}
              {items.map((item) => {
                const point = layout.get(item.anchor.id)
                if (!point) return null
                const degree = degrees.get(item.anchor.id) ?? 0
                const radius = 11 + Math.min(11, degree * 2.2)
                const isSelected = selectedId === item.anchor.id
                const dimmed = selectedId !== null && !isSelected && !neighbours.has(item.anchor.id)
                return (
                  <g
                    key={item.anchor.id}
                    className={`graph-node${isSelected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}`}
                    transform={`translate(${point.x}, ${point.y})`}
                    onClick={() => setSelectedId(isSelected ? null : item.anchor.id)}
                    role="button"
                    aria-label={`${deriveSummary(item.revision.content)}，共 ${degree} 条连接`}
                  >
                    <circle r={radius} className="graph-node-circle" />
                    <circle r={3.2} className="graph-node-core" />
                    <text y={radius + 16} className="graph-node-label">
                      {truncate(deriveSummary(item.revision.content))}
                    </text>
                  </g>
                )
              })}
            </svg>
          </section>

          {selected ? (
            <section className="graph-panel">
              <div className="graph-panel-main">
                <strong>{deriveSummary(selected.revision.content)}</strong>
                <small>
                  {formatMemoryTime(selected.revision.content.memoryTime)}
                  {selected.revision.content.tags.length > 0 &&
                    ` · ${selected.revision.content.tags.join('、')}`}
                  {` · ${degrees.get(selected.anchor.id) ?? 0} 条连接`}
                </small>
                {neighbours.size > 0 && (
                  <div className="chip-cloud graph-neighbours">
                    {[...neighbours].map((id) => {
                      const other = itemById.get(id)
                      if (!other) return null
                      return (
                        <button key={id} type="button" className="chip" onClick={() => setSelectedId(id)}>
                          {truncate(deriveSummary(other.revision.content), 14)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="graph-panel-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => navigate(`/anchor/${selected.anchor.id}`)}
                >
                  查看这枚心锚
                  <ArrowRight size={16} />
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => navigate(`/connect/${selected.anchor.id}`)}
                >
                  <Link2 size={16} />
                  连一条心线
                </button>
              </div>
            </section>
          ) : (
            allLines.length === 0 && (
              <section className="graph-panel">
                <div className="graph-panel-main">
                  <strong>还没有心线</strong>
                  <small>打开任意一枚心锚，把它和另一段经历连起来，这张网就会开始生长。</small>
                </div>
                <div className="graph-panel-actions">
                  <button className="primary-button" type="button" onClick={() => navigate('/')}>
                    去时间轴选一枚心锚
                    <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            )
          )}

          {isolated.length > 0 && (
            <section className="graph-isolated">
              <h2>还没有连接的心锚（{isolated.length}）</h2>
              <div className="anchor-list">
                {isolated.slice(0, 6).map((item) => (
                  <button
                    key={item.anchor.id}
                    type="button"
                    className="isolated-item"
                    onClick={() => setSelectedId(item.anchor.id)}
                  >
                    <span>{deriveSummary(item.revision.content)}</span>
                    <small>{formatMemoryTime(item.revision.content.memoryTime)}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

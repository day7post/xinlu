import { useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Link2, Network, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { HEARTLINE_META, type HeartlineType } from '../types'
import { deriveSummary, getActiveAnchorItems } from '../lib/domain'
import { formatMemoryTime, sortTimeline } from '../lib/date'
import { computeGanglionLayout } from '../lib/ganglion'
import { useVault } from '../state/VaultContext'
import { LoadingScreen } from '../components/LoadingScreen'

const GRAPH_WIDTH = 840
const GRAPH_HEIGHT = 620

type TypeFilter = 'all' | HeartlineType

function truncate(value: string, max = 9): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function hashUnit(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

interface DustStar {
  x: number
  y: number
  r: number
  opacity: number
  warm: boolean
}

/** Faint warm specks on the paper, so the veins sit on a living surface. */
function buildDust(count = 72): DustStar[] {
  const stars: DustStar[] = []
  for (let index = 0; index < count; index += 1) {
    stars.push({
      x: Math.round(hashUnit(`dust-x-${index}`) * GRAPH_WIDTH),
      y: Math.round(hashUnit(`dust-y-${index}`) * GRAPH_HEIGHT),
      r: 0.8 + hashUnit(`dust-r-${index}`) * 1.5,
      opacity: 0.12 + hashUnit(`dust-o-${index}`) * 0.3,
      warm: hashUnit(`dust-w-${index}`) > 0.45,
    })
  }
  return stars
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
      computeGanglionLayout(
        items.map((item) => ({ id: item.anchor.id, weight: degrees.get(item.anchor.id) ?? 0 })),
        allLines.map((line) => ({ a: line.anchorAId, b: line.anchorBId })),
        GRAPH_WIDTH,
        GRAPH_HEIGHT,
      ),
    [items, allLines, degrees],
  )

  const dust = useMemo(() => buildDust(), [])

  const neighbours = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const result = new Set<string>()
    for (const line of allLines) {
      if (line.anchorAId === selectedId) result.add(line.anchorBId)
      if (line.anchorBId === selectedId) result.add(line.anchorAId)
    }
    return result
  }, [allLines, selectedId])

  const orderedByTime = useMemo(() => sortTimeline(items, 'oldest'), [items])

  if (loading || !data) return <LoadingScreen />

  const selected = selectedId ? itemById.get(selectedId) : undefined
  const isolated = items.filter((item) => (degrees.get(item.anchor.id) ?? 0) === 0)
  const selectedIndex = selectedId
    ? orderedByTime.findIndex((item) => item.anchor.id === selectedId)
    : -1

  const stepSelection = (step: number) => {
    if (orderedByTime.length === 0) return
    const nextIndex =
      selectedIndex < 0
        ? 0
        : (selectedIndex + step + orderedByTime.length) % orderedByTime.length
    setSelectedId(orderedByTime[nextIndex].anchor.id)
  }

  const addAnchor = () => {
    const id = createDraft()
    if (id) navigate(`/editor/${id}`)
  }

  // a is the parent (inner) point, b the child (outer) point. The control
  // point is pushed perpendicular to the branch, so every branch curls in
  // the same rotational direction — a dendrite, not a straight spoke.
  const branchPath = (a: { x: number; y: number }, b: { x: number; y: number }, lift: number) => {
    const midX = (a.x + b.x) / 2
    const midY = (a.y + b.y) / 2
    const edgeX = b.x - a.x
    const edgeY = b.y - a.y
    const distance = Math.max(1, Math.hypot(edgeX, edgeY))
    const perpX = edgeY / distance
    const perpY = -edgeX / distance
    const controlX = midX + perpX * distance * lift
    const controlY = midY + perpY * distance * lift
    return `M ${a.x} ${a.y} Q ${controlX} ${controlY} ${b.x} ${b.y}`
  }

  return (
    <div className="page graph-page">
      <header className="page-header">
        <p className="eyebrow">你的心图</p>
        <h1>心图</h1>
        <p>
          {items.length > 0
            ? `${items.length} 枚心锚，${allLines.length} 条心线。连接最多的心锚是核，心线像脉络一样由此生长。`
            : '心锚连成心线之后，这里会长出一张属于你的脉络。'}
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
              核越大，连接越多；粗枝是主脉络
            </p>
          </div>

          <section className="graph-wrap" aria-label="心锚脉络图">
            <svg
              className="graph-svg"
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
              role="img"
              aria-label={`共 ${items.length} 枚心锚、${allLines.length} 条心线的心图`}
            >
              <g className="graph-dust" aria-hidden="true">
                {dust.map((star, index) => (
                  <circle
                    key={index}
                    cx={star.x}
                    cy={star.y}
                    r={star.r}
                    fill={star.warm ? '#b5823a' : '#3f6f67'}
                    opacity={star.opacity}
                  />
                ))}
              </g>
              {layout.rings.map((radius) => (
                <circle
                  key={radius}
                  cx={layout.center.x}
                  cy={layout.center.y}
                  r={radius}
                  className="graph-ring"
                  aria-hidden="true"
                />
              ))}
              {allLines.map((line) => {
                const a = layout.points.get(line.anchorAId)
                const b = layout.points.get(line.anchorBId)
                if (!a || !b) return null
                const isBranch =
                  layout.parentOf.get(line.anchorAId) === line.anchorBId ||
                  layout.parentOf.get(line.anchorBId) === line.anchorAId
                const childId =
                  layout.parentOf.get(line.anchorAId) === line.anchorBId
                    ? line.anchorAId
                    : line.anchorBId
                const childDepth = layout.depthOf.get(childId) ?? 1
                const matched = filter === 'all' || line.type === filter
                const touchesSelected =
                  !selectedId || line.anchorAId === selectedId || line.anchorBId === selectedId
                if (!isBranch && !matched) return null
                const dimmed = !matched || !touchesSelected
                if (isBranch) {
                  const parentPoint = childId === line.anchorAId ? b : a
                  const childPoint = childId === line.anchorAId ? a : b
                  return (
                    <path
                      key={line.id}
                      d={branchPath(parentPoint, childPoint, 0.22)}
                      className={`graph-branch${dimmed ? ' dimmed' : ''}`}
                      style={{
                        stroke: HEARTLINE_META[line.type].color,
                        strokeWidth: Math.max(1.4, 3.6 - childDepth * 0.65),
                      }}
                    />
                  )
                }
                return (
                  <path
                    key={line.id}
                    d={branchPath(a, b, 0.12)}
                    className={`graph-cross${dimmed ? ' dimmed' : ''}`}
                    style={{ stroke: HEARTLINE_META[line.type].color }}
                  />
                )
              })}
              {items.map((item) => {
                const point = layout.points.get(item.anchor.id)
                if (!point) return null
                const degree = degrees.get(item.anchor.id) ?? 0
                const isRoot = layout.rootId === item.anchor.id && degree > 0
                const radius = isRoot ? 18 : 9 + Math.min(9, degree * 1.8)
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
                    <circle r={radius + 8} className="graph-node-halo" />
                    {isRoot && <circle r={radius + 13} className="graph-root-ring" />}
                    <circle r={radius} className="graph-node-circle" />
                    <circle r={isRoot ? 4.6 : 3.2} className="graph-node-core" />
                    <text y={radius + 17} className="graph-node-label">
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
                <div className="graph-pager" role="group" aria-label="按时间切换心锚">
                  <button type="button" onClick={() => stepSelection(-1)} aria-label="上一枚心锚">
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" onClick={() => stepSelection(1)} aria-label="下一枚心锚">
                    <ChevronRight size={16} />
                  </button>
                </div>
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
                  <small>打开任意一枚心锚，把它和另一段经历连起来，脉络就会开始生长。</small>
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

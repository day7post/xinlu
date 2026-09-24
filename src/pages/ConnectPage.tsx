import { useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Check, Link2, Plus, Search, Users, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { HEARTLINE_META, type HeartlineType } from '../types'
import { deriveSummary, getActiveAnchorItems } from '../lib/domain'
import { formatMemoryTime, getTimeSortValue } from '../lib/date'
import { useAnchor, useVault } from '../state/VaultContext'
import { LoadingScreen } from '../components/LoadingScreen'

export function ConnectPage() {
  const { anchorId } = useParams()
  const navigate = useNavigate()
  const item = useAnchor(anchorId)
  const { data, loading, createLine, createDraft } = useVault()
  const [type, setType] = useState<HeartlineType>('cause')
  const [query, setQuery] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [personValue, setPersonValue] = useState('')
  const [personNames, setPersonNames] = useState<string[]>([])
  const [error, setError] = useState('')

  const candidates = useMemo(() => {
    if (!data || !anchorId) return []
    const normalized = query.trim().toLocaleLowerCase()
    return getActiveAnchorItems(data)
      .filter(({ anchor }) => anchor.id !== anchorId)
      .filter(({ revision }) => {
        if (!normalized) return true
        const content = revision.content
        return (
          content.text.toLocaleLowerCase().includes(normalized) ||
          content.summary.toLocaleLowerCase().includes(normalized) ||
          content.tags.some((tag) => tag.toLocaleLowerCase().includes(normalized))
        )
      })
      .sort((left, right) => {
        const a = getTimeSortValue(left.revision.content.memoryTime) ?? 0
        const b = getTimeSortValue(right.revision.content.memoryTime) ?? 0
        return b - a
      })
  }, [anchorId, data, query])

  if (loading) return <LoadingScreen />
  if (!data || !anchorId || !item) {
    return (
      <div className="center-page">
        <p>当前心锚不可用。</p>
      </div>
    )
  }

  const target = candidates.find(({ anchor }) => anchor.id === targetId)
  const addPerson = () => {
    const name = personValue.trim()
    if (!name || personNames.includes(name)) return
    setPersonNames((names) => [...names, name])
    setPersonValue('')
  }

  const submit = () => {
    if (!targetId) {
      setError('先选一枚想连接的心锚。')
      return
    }
    if (type === 'person' && personNames.length === 0) {
      setError('人物心线至少需要一个名字，也可以先写称呼。')
      return
    }
    const result = createLine({
      anchorAId: anchorId,
      anchorBId: targetId,
      type,
      personNames,
      note,
    })
    if (!result.ok) {
      setError(result.message ?? '暂时不能创建这条心线。')
      return
    }
    if (result.lineId) navigate(`/line/${result.lineId}`)
  }

  return (
    <div className="page connect-page">
      <header className="detail-topbar">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="返回">
          <ArrowLeft size={21} />
        </button>
        <span>连接心锚</span>
        <span className="topbar-spacer" />
      </header>

      <section className="connect-current memory-strip">
        <small>从哪里出发</small>
        <strong>{deriveSummary(item.revision.content)}</strong>
        <span>{formatMemoryTime(item.revision.content.memoryTime)}</span>
      </section>

      <section className="connect-step">
        <div className="step-heading">
          <span>1</span>
          <div>
            <h2>它们因为什么相连？</h2>
            <p>心线没有方向，也不替你先下结论。</p>
          </div>
        </div>
        <div className="relation-options">
          {(Object.keys(HEARTLINE_META) as HeartlineType[]).map((value) => {
            const meta = HEARTLINE_META[value]
            return (
              <button
                type="button"
                key={value}
                className={type === value ? 'selected' : ''}
                onClick={() => {
                  setType(value)
                  setError('')
                }}
                style={{ '--relation-color': meta.color } as CSSProperties}
              >
                <span className="relation-line" />
                <span>
                  <strong>{meta.label}</strong>
                  <small>{meta.description}</small>
                </span>
                {type === value && <Check size={17} />}
              </button>
            )
          })}
        </div>

        {type === 'person' && (
          <div className="person-picker">
            <div className="field-heading">
              <div>
                <strong>涉及的人</strong>
                <small>可以写名字，也可以写“妈妈”这样的称呼</small>
              </div>
              <Users size={17} />
            </div>
            {personNames.length > 0 && (
              <div className="chip-cloud">
                {personNames.map((name) => (
                  <button
                    type="button"
                    className="chip selected"
                    key={name}
                    onClick={() => setPersonNames((names) => names.filter((item) => item !== name))}
                  >
                    {name}
                    <X size={13} />
                  </button>
                ))}
              </div>
            )}
            <div className="inline-add">
              <input
                value={personValue}
                onChange={(event) => setPersonValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addPerson()
                  }
                }}
                placeholder="输入一个名字或称呼"
              />
              <button type="button" onClick={addPerson} disabled={!personValue.trim()}>
                <Plus size={16} />
                添加
              </button>
            </div>
          </div>
        )}

        {type === 'time' && targetId && (
          <p className="relation-hint">{timeRelationHint(item.revision.content.memoryTime, target?.revision.content.memoryTime)}</p>
        )}
      </section>

      <section className="connect-step">
        <div className="step-heading">
          <span>2</span>
          <div>
            <h2>连到哪枚心锚？</h2>
            <p>只显示还没有进入回收站的心锚。</p>
          </div>
        </div>

        <label className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索摘要、原文或标签"
          />
        </label>

        <div className="target-list">
          {candidates.slice(0, 30).map((candidate) => {
            const selected = targetId === candidate.anchor.id
            return (
              <button
                type="button"
                key={candidate.anchor.id}
                className={selected ? 'selected' : ''}
                onClick={() => {
                  setTargetId(candidate.anchor.id)
                  setError('')
                }}
              >
                <span>
                  <strong>{deriveSummary(candidate.revision.content)}</strong>
                  <small>{formatMemoryTime(candidate.revision.content.memoryTime)}</small>
                </span>
                {selected ? <Check size={18} /> : <ArrowRight size={17} />}
              </button>
            )
          })}
          {candidates.length === 0 && (
            <div className="empty-inline">
              <p>{query ? '没有找到匹配的心锚。' : '还需要另一枚心锚才能连接。'}</p>
              {!query && (
                <button type="button" onClick={() => { const id = createDraft(); if (id) navigate(`/editor/${id}`) }}>
                  先写下另一枚
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="connect-step">
        <div className="step-heading">
          <span>3</span>
          <div>
            <h2>给这条心线留一句话</h2>
            <p>可选，只写你确定的部分。</p>
          </div>
        </div>
        <label className="field">
          <span>关系说明</span>
          <textarea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例如：这件事让我后来更害怕表达自己"
          />
        </label>
      </section>

      {error && <p className="form-error">{error}</p>}

      <div className="connect-summary">
        <span>
          <Link2 size={16} />
          {HEARTLINE_META[type].label}心线
        </span>
        {target && <strong>连接到「{deriveSummary(target.revision.content)}」</strong>}
      </div>
      <button className="primary-button wide" type="button" onClick={submit}>
        确认建立连接
      </button>
    </div>
  )
}

function timeRelationHint(left: import('../types').MemoryTime, right?: import('../types').MemoryTime) {
  if (!right || left.precision === 'unknown' || right.precision === 'unknown') {
    return '至少一端没有明确时间，所以这里不判断先后。'
  }
  const leftValue = getTimeSortValue(left)
  const rightValue = getTimeSortValue(right)
  if (leftValue === null || rightValue === null) return '这组时间无法比较先后。'
  if (leftValue < rightValue) return '按已记录的日期，当前心锚较早，但不代表因果。'
  if (leftValue > rightValue) return '按已记录的日期，目标心锚较早，但不代表因果。'
  return '两枚心锚记录在相近的时间里，不判断先后。'
}



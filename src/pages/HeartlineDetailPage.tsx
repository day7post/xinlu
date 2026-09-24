import { useState, type CSSProperties } from 'react'
import { ArrowLeft, Check, Edit3, Link2, Trash2, Users, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { HEARTLINE_META, type HeartlineType } from '../types'
import { getAnchorItem } from '../lib/domain'
import { formatShortDate } from '../lib/date'
import { useHeartline, useVault } from '../state/VaultContext'
import { AnchorMiniCard } from '../components/AnchorMiniCard'
import { LoadingScreen } from '../components/LoadingScreen'

export function HeartlineDetailPage() {
  const { lineId } = useParams()
  const navigate = useNavigate()
  const line = useHeartline(lineId)
  const { data, loading, updateLine, deleteLine } = useVault()
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(line?.note ?? '')
  const [type, setType] = useState<HeartlineType>(line?.type ?? 'cause')
  const [personValue, setPersonValue] = useState('')
  const [personNames, setPersonNames] = useState<string[]>([])

  if (loading) return <LoadingScreen />
  if (!data || !lineId || !line) {
    return (
      <div className="center-page">
        <p>这条心线不存在或已经被永久删除。</p>
        <button className="primary-button" type="button" onClick={() => navigate('/')}>
          返回时间轴
        </button>
      </div>
    )
  }

  if (line.deletedAt) {
    return (
      <div className="center-page">
        <Trash2 size={28} />
        <h1>它在回收站里</h1>
        <p>回到资料页可以恢复这条心线。</p>
      </div>
    )
  }

  const left = getAnchorItem(data, line.anchorAId)
  const right = getAnchorItem(data, line.anchorBId)
  const meta = HEARTLINE_META[line.type]
  const selectedNames = personNames.length
    ? personNames
    : line.personIds
        .map((id) => data.persons.find((person) => person.id === id)?.name)
        .filter((name): name is string => Boolean(name))

  const beginEdit = () => {
    setNote(line.note)
    setType(line.type)
    setPersonNames(
      line.personIds
        .map((id) => data.persons.find((person) => person.id === id)?.name)
        .filter((name): name is string => Boolean(name)),
    )
    setEditing(true)
  }

  const save = () => {
    if (type === 'person' && selectedNames.length === 0) return
    updateLine(line.id, { type, note, personNames: type === 'person' ? selectedNames : [] })
    setEditing(false)
  }

  const addPerson = () => {
    const name = personValue.trim()
    if (!name || selectedNames.includes(name)) return
    setPersonNames([...selectedNames, name])
    setPersonValue('')
  }

  return (
    <div className="page line-detail-page">
      <header className="detail-topbar">
        <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="返回">
          <ArrowLeft size={21} />
        </button>
        <span>心线</span>
        <button
          type="button"
          className="icon-button danger-hover"
          onClick={() => {
            if (window.confirm('删除这条心线？30 天内可以恢复，两枚心锚本身不会删除。')) {
              deleteLine(line.id)
              navigate('/')
            }
          }}
          aria-label="删除心线"
        >
          <Trash2 size={20} />
        </button>
      </header>

      <section className="line-hero" style={{ '--relation-color': meta.color } as CSSProperties}>
        <span className="line-symbol">
          <i />
          <Link2 size={21} />
          <i />
        </span>
        <p className="eyebrow">无方向心线</p>
        <h1>{meta.label}</h1>
        <p>{meta.description}</p>
      </section>

      {!editing ? (
        <>
          {line.note ? (
            <blockquote className="line-note">{line.note}</blockquote>
          ) : (
            <p className="quiet-note">这条心线没有额外说明。</p>
          )}
          {line.type === 'person' && selectedNames.length > 0 && (
            <div className="line-people">
              <Users size={17} />
              {selectedNames.map((name) => (
                <span className="chip" key={name}>
                  {name}
                </span>
              ))}
            </div>
          )}
          <button className="secondary-button wide" type="button" onClick={beginEdit}>
            <Edit3 size={17} />
            修改关系或说明
          </button>
        </>
      ) : (
        <section className="line-edit-panel">
          <label className="field">
            <span>关系类型</span>
            <select value={type} onChange={(event) => setType(event.target.value as HeartlineType)}>
              {(Object.keys(HEARTLINE_META) as HeartlineType[]).map((value) => (
                <option key={value} value={value}>
                  {HEARTLINE_META[value].label}
                </option>
              ))}
            </select>
          </label>

          {type === 'person' && (
            <div className="person-picker compact-panel">
              <div className="chip-cloud">
                {selectedNames.map((name) => (
                  <button
                    type="button"
                    className="chip selected"
                    key={name}
                    onClick={() => setPersonNames(selectedNames.filter((item) => item !== name))}
                  >
                    {name}
                    <X size={13} />
                  </button>
                ))}
              </div>
              <div className="inline-add">
                <input
                  value={personValue}
                  onChange={(event) => setPersonValue(event.target.value)}
                  placeholder="增加一个名字或称呼"
                />
                <button type="button" onClick={addPerson} disabled={!personValue.trim()}>
                  添加
                </button>
              </div>
            </div>
          )}

          <label className="field">
            <span>关系说明</span>
            <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>

          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setEditing(false)}>
              取消
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={save}
              disabled={type === 'person' && selectedNames.length === 0}
            >
              <Check size={17} />
              保存修改
            </button>
          </div>
        </section>
      )}

      <section className="detail-section">
        <div className="section-title">
          <span>
            <Link2 size={18} />
            <h2>连接的两端</h2>
          </span>
        </div>
        <div className="endpoint-stack">
          {left && <AnchorMiniCard item={left} />}
          <span className="directionless-divider">无方向</span>
          {right && <AnchorMiniCard item={right} />}
        </div>
      </section>

      <p className="record-footnote">
        建立于 {formatShortDate(line.createdAt)}
        {line.updatedAt !== line.createdAt && ` · 修改于 ${formatShortDate(line.updatedAt)}`}
      </p>
    </div>
  )
}


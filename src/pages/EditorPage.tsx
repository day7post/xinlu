import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  Eye,
  ImagePlus,
  Plus,
  Save,
  Tags,
  Trash2,
  X,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { FORM_LABEL, type AnchorForm, type MemoryPrecision, type MemoryTime } from '../types'
import { contentIsMeaningful, normalizeTag, sanitizeTime } from '../lib/domain'
import { useAnchor, useVault } from '../state/VaultContext'
import { EmotionEditor } from '../components/EmotionEditor'
import { MediaImage } from '../components/MediaImage'
import { LoadingScreen } from '../components/LoadingScreen'

export function EditorPage() {
  const { anchorId } = useParams()
  const navigate = useNavigate()
  const item = useAnchor(anchorId)
  const { loading, updateContent, commit, discard, addMediaFiles } = useVault()
  const [tagValue, setTagValue] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const mountedRef = useRef(true)
  const content = item?.revision.content

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!anchorId || !content || !contentIsMeaningful(content)) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') commit(anchorId, 'session')
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [anchorId, commit, content])

  if (loading) return <LoadingScreen label="正在打开记录纸" />
  if (!anchorId || !item || !content) {
    return (
      <div className="center-page">
        <p>没有找到这枚心锚。</p>
        <button className="primary-button" type="button" onClick={() => navigate('/')}>
          返回时间轴
        </button>
      </div>
    )
  }

  const patch = (next: Partial<typeof content>) => {
    updateContent(anchorId, (current) => ({ ...current, ...next }))
    if (error) setError('')
  }

  const exit = () => {
    if (contentIsMeaningful(content)) {
      commit(anchorId, 'session')
    } else if (!hasAnyOptionalContent(content)) {
      discard(anchorId)
    }
    navigate('/')
  }

  const finish = () => {
    const result = commit(anchorId, 'session')
    if (!result.ok) {
      setError(result.message ?? '还不能完成这次记录。')
      return
    }
    navigate(`/anchor/${anchorId}`)
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const records = await addMediaFiles(Array.from(files))
      const ids = records.map((record) => record.id)
      if (ids.length) {
        updateContent(anchorId, (current) => ({
          ...current,
          form: current.text.trim() ? current.form : 'photo',
          mediaIds: [...current.mediaIds, ...ids],
        }))
      }
    } finally {
      if (mountedRef.current) setUploading(false)
    }
  }

  return (
    <div className="editor-page">
      <header className="editor-header">
        <button type="button" className="icon-button" onClick={exit} aria-label="退出记录">
          <ArrowLeft size={21} />
        </button>
        <div>
          <strong>{item.anchor.status === 'draft' ? '新的心锚' : '继续编辑'}</strong>
          <small>
            <Check size={13} />
            已自动保存在本机
          </small>
        </div>
        <button type="button" className="text-button" onClick={finish}>
          完成
        </button>
      </header>

      <main className="editor-main">
        <section className="paper-editor">
          <div className="form-switch" role="group" aria-label="记录形式">
            {(['note', 'photo', 'scene'] as AnchorForm[]).map((form) => (
              <button
                key={form}
                type="button"
                className={content.form === form ? 'active' : ''}
                onClick={() => patch({ form })}
              >
                {FORM_LABEL[form]}
              </button>
            ))}
          </div>
          <textarea
            className="main-writing-area"
            value={content.text}
            onChange={(event) => patch({ text: event.target.value })}
            placeholder={
              content.form === 'scene'
                ? '看见、听见、闻到了什么？人在哪里，发生了什么……'
                : '现在想起什么，就写什么。'
            }
            autoFocus
          />

          {content.mediaIds.length > 0 && (
            <div className="photo-grid">
              {content.mediaIds.map((mediaId) => (
                <div className="photo-tile" key={mediaId}>
                  <MediaImage mediaId={mediaId} alt="心锚照片" useOriginal />
                  <button
                    type="button"
                    className="remove-photo"
                    onClick={() =>
                      patch({ mediaIds: content.mediaIds.filter((id) => id !== mediaId) })
                    }
                    aria-label="移除这张照片"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className={`photo-button ${uploading ? 'disabled' : ''}`}>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={(event) => {
                void addPhotos(event.target.files)
                event.target.value = ''
              }}
            />
            {content.mediaIds.length ? <ImagePlus size={18} /> : <Camera size={18} />}
            {uploading ? '正在整理照片…' : content.mediaIds.length ? '再加一张' : '加入照片'}
          </label>
        </section>

        <div className="optional-fields">
          <p className="optional-intro">这些都可以不填，之后也能补。</p>

          <details className="optional-section">
            <summary>
              <span>
                <Eye size={17} />
                摘要
              </span>
              <small>{content.summary ? content.summary : '未填写时自动取开头'}</small>
            </summary>
            <div className="section-body">
              <label className="field">
                <span>先展示给别人和自己的那一句</span>
                <textarea
                  value={content.summary}
                  maxLength={240}
                  onChange={(event) => patch({ summary: event.target.value })}
                  placeholder="不写也可以，会从原文开头生成"
                  rows={2}
                />
              </label>
            </div>
          </details>

          <details className="optional-section">
            <summary>
              <span>
                <CalendarDays size={17} />
                时间
              </span>
              <small>{timeSummary(content.memoryTime)}</small>
            </summary>
            <div className="section-body">
              <TimeEditor
                value={content.memoryTime}
                onChange={(memoryTime) => patch({ memoryTime })}
              />
            </div>
          </details>

          <details className="optional-section">
            <summary>
              <span>
                <Tags size={17} />
                标签
              </span>
              <small>{content.tags.length ? content.tags.join(' / ') : '由你自己分类'}</small>
            </summary>
            <div className="section-body">
              {content.tags.length > 0 && (
                <div className="chip-cloud">
                  {content.tags.map((tag) => (
                    <button
                      type="button"
                      className="chip selected"
                      key={tag}
                      onClick={() => patch({ tags: content.tags.filter((item) => item !== tag) })}
                    >
                      {tag}
                      <X size={13} />
                    </button>
                  ))}
                </div>
              )}
              <div className="inline-add">
                <input
                  value={tagValue}
                  onChange={(event) => setTagValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="例如：家、工作、某个夏天"
                  aria-label="添加标签"
                />
                <button type="button" onClick={addTag} disabled={!tagValue.trim()}>
                  <Plus size={16} />
                  添加
                </button>
              </div>
            </div>
          </details>

          <details className="optional-section emotion-section">
            <summary>
              <span>
                <Clock3 size={17} />
                情绪
              </span>
              <small>
                {content.emotionsThen.length + content.emotionsNow.length
                  ? `当时 ${content.emotionsThen.length} · 现在 ${content.emotionsNow.length}`
                  : '不强迫打分'}
              </small>
            </summary>
            <div className="section-body">
              <EmotionEditor
                title="当时的感觉"
                hint="回到那一刻，也可以不选"
                value={content.emotionsThen}
                onChange={(emotionsThen) => patch({ emotionsThen })}
              />
              <EmotionEditor
                title="现在的感觉"
                hint="过了这么久，再看它是什么感觉"
                value={content.emotionsNow}
                onChange={(emotionsNow) => patch({ emotionsNow })}
              />
            </div>
          </details>
        </div>

        {item.anchor.status === 'active' && (
          <button
            className="checkpoint-button"
            type="button"
            onClick={() => {
              const result = commit(anchorId, 'checkpoint')
              if (!result.ok) setError(result.message ?? '暂时无法留档。')
            }}
          >
            <Save size={17} />
            保存一个历史版本
          </button>
        )}

        {error && <p className="form-error">{error}</p>}
      </main>

      <footer className="editor-footer">
        <span>
          <Check size={15} />
          内容已经写入本地资料
        </span>
        <button type="button" onClick={finish}>
          完成这次记录
        </button>
      </footer>

      {item.anchor.status === 'draft' && hasAnyOptionalContent(content) && !contentIsMeaningful(content) && (
        <button
          className="editor-delete-draft"
          type="button"
          onClick={() => {
            discard(anchorId)
            navigate('/')
          }}
        >
          <Trash2 size={15} />
          丢弃这份草稿
        </button>
      )}
    </div>
  )

  function addTag() {
    const tag = normalizeTag(tagValue)
    const latestContent = item?.revision.content
    if (!latestContent || !tag || latestContent.tags.includes(tag)) return
    patch({ tags: [...latestContent.tags, tag] })
    setTagValue('')
  }
}

function hasAnyOptionalContent(content: {
  summary: string
  tags: string[]
  emotionsThen: unknown[]
  emotionsNow: unknown[]
  memoryTime: MemoryTime
}) {
  return Boolean(
    content.summary.trim() ||
      content.tags.length ||
      content.emotionsThen.length ||
      content.emotionsNow.length ||
      content.memoryTime.precision !== 'unknown',
  )
}

function timeSummary(time: MemoryTime) {
  if (time.precision === 'exact') return '具体日期'
  if (time.precision === 'month') return '大致到月'
  if (time.precision === 'year') return '大致到年'
  if (time.precision === 'range') return '一段时间'
  return '未定时间'
}

function TimeEditor({
  value,
  onChange,
}: {
  value: MemoryTime
  onChange: (value: MemoryTime) => void
}) {
  const currentYear = new Date().getFullYear()
  const setPrecision = (precision: MemoryPrecision) => {
    if (precision === 'unknown') onChange({ precision })
    if (precision === 'exact') onChange({ precision, date: value.date ?? new Date().toISOString().slice(0, 10) })
    if (precision === 'month') onChange({ precision, month: value.month ?? new Date().toISOString().slice(0, 7) })
    if (precision === 'year') onChange({ precision, year: value.year ?? currentYear })
    if (precision === 'range') {
      onChange({
        precision,
        startYear: value.startYear ?? currentYear,
        endYear: value.endYear ?? currentYear,
      })
    }
  }

  return (
    <div className="time-editor">
      <div className="precision-options">
        {[
          ['unknown', '不知道'],
          ['year', '大概年份'],
          ['month', '大概月份'],
          ['exact', '具体日期'],
          ['range', '一段时间'],
        ].map(([precision, label]) => (
          <button
            type="button"
            className={value.precision === precision ? 'active' : ''}
            key={precision}
            onClick={() => setPrecision(precision as MemoryPrecision)}
          >
            {label}
          </button>
        ))}
      </div>
      {value.precision === 'exact' && (
        <input
          type="date"
          value={value.date ?? ''}
          onChange={(event) => onChange(sanitizeTime({ precision: 'exact', date: event.target.value }))}
        />
      )}
      {value.precision === 'month' && (
        <input
          type="month"
          value={value.month ?? ''}
          onChange={(event) => onChange(sanitizeTime({ precision: 'month', month: event.target.value }))}
        />
      )}
      {value.precision === 'year' && (
        <input
          type="number"
          min="1"
          max="9999"
          value={value.year ?? ''}
          onChange={(event) =>
            onChange(sanitizeTime({ precision: 'year', year: Number(event.target.value) }))
          }
          placeholder="年份"
        />
      )}
      {value.precision === 'range' && (
        <div className="range-fields">
          <input
            type="number"
            value={value.startYear ?? ''}
            onChange={(event) =>
              onChange(
                sanitizeTime({
                  precision: 'range',
                  startYear: Number(event.target.value),
                  endYear: value.endYear,
                }),
              )
            }
            placeholder="起始年"
          />
          <span>到</span>
          <input
            type="number"
            value={value.endYear ?? ''}
            onChange={(event) =>
              onChange(
                sanitizeTime({
                  precision: 'range',
                  startYear: value.startYear,
                  endYear: Number(event.target.value),
                }),
              )
            }
            placeholder="结束年"
          />
        </div>
      )}
      {value.precision === 'range' &&
        value.startYear &&
        value.endYear &&
        value.startYear > value.endYear && <small className="field-warning">起始年晚于结束年，请调整。</small>}
    </div>
  )
}




import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { PRESET_EMOTIONS, type EmotionObservation } from '../types'
import { createId } from '../lib/id'

export function EmotionEditor({
  title,
  hint,
  value,
  onChange,
}: {
  title: string
  hint: string
  value: EmotionObservation[]
  onChange: (next: EmotionObservation[]) => void
}) {
  const [customValue, setCustomValue] = useState('')

  const toggle = (label: string) => {
    const existing = value.find((item) => item.label === label)
    if (existing) {
      onChange(value.filter((item) => item.id !== existing.id))
      return
    }
    onChange([...value, { id: createId('emotion'), label }])
  }

  const addCustom = () => {
    const label = customValue.trim()
    if (!label || value.some((item) => item.label === label)) return
    onChange([...value, { id: createId('emotion'), label }])
    setCustomValue('')
  }

  const update = (id: string, patch: Partial<EmotionObservation>) => {
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  return (
    <section className="emotion-editor">
      <div className="field-heading">
        <div>
          <strong>{title}</strong>
          <small>{hint}</small>
        </div>
        <span>{value.length ? `${value.length} 项` : '可跳过'}</span>
      </div>
      <div className="chip-cloud">
        {PRESET_EMOTIONS.map((emotion) => {
          const selected = value.some((item) => item.label === emotion)
          return (
            <button
              key={emotion}
              type="button"
              className={selected ? 'chip selected' : 'chip'}
              onClick={() => toggle(emotion)}
              aria-pressed={selected}
            >
              {emotion}
            </button>
          )
        })}
      </div>

      {value
        .filter((item) => !PRESET_EMOTIONS.includes(item.label))
        .map((item) => (
          <div className="custom-emotion" key={item.id}>
            <span>{item.label}</span>
            <button type="button" onClick={() => toggle(item.label)} aria-label={`移除${item.label}`}>
              <X size={14} />
            </button>
          </div>
        ))}

      <div className="inline-add">
        <input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addCustom()
            }
          }}
          placeholder="写下自己的感觉"
          aria-label={`添加${title}`}
        />
        <button type="button" onClick={addCustom} disabled={!customValue.trim()}>
          <Plus size={16} />
          添加
        </button>
      </div>

      {value.length > 0 && (
        <div className="emotion-details">
          {value.map((item) => (
            <div className="emotion-detail-row" key={item.id}>
              <strong>{item.label}</strong>
              <label>
                强度
                <select
                  value={item.intensity ?? ''}
                  onChange={(event) =>
                    update(item.id, {
                      intensity: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                >
                  <option value="">不设</option>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <input
                value={item.note ?? ''}
                onChange={(event) => update(item.id, { note: event.target.value })}
                placeholder="补充一句，可不填"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

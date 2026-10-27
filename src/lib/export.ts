import { FORM_LABEL, HEARTLINE_META, type EmotionObservation, type VaultData} from '../types'
import { formatMemoryTime, sortTimeline} from './date'
import { deriveSummary, getActiveAnchorItems} from './domain'

function formatEmotions(list: EmotionObservation[]): string {
if (list.length === 0) return ''
return list
.map((item) => {
const parts = [item.label]
if (item.intensity) parts.push(`强度 ${item.intensity}`)
if (item.note?.trim()) parts.push(item.note.trim())
return parts.join(' · ')
})
.join('；')
}

export interface PlainAnchor {
id: string
summary: string
text: string
form: string
memoryTime: string
tags: string[]
emotionsThen: string
emotionsNow: string
photoCount: number
createdAt: string
updatedAt: string
}

export interface PlainHeartline {
id: string
type: string
from: string
to: string
persons: string[]
note: string
}

export interface PlainExport {
format: 'xinlu-plain-export'
version: 1
exportedAt: string
note: string
anchors: PlainAnchor[]
heartlines: PlainHeartline[]
persons: string[]
}

/** Readable, unencrypted export of the text content. Photos are counted, not embedded. */
export function buildPlainExport(data: VaultData): PlainExport {
const items = sortTimeline(getActiveAnchorItems(data), 'oldest')
const summaryById = new Map(items.map((item) => [item.anchor.id, deriveSummary(item.revision.content)]))
const personName = (id: string) => data.persons.find((person) => person.id === id)?.name?? ''

return {
format: 'xinlu-plain-export',
version: 1,
exportedAt: new Date().toISOString(),
note: '心络明文导出：仅包含文字内容，照片未嵌入。如需包含照片的完整恢复，请使用加密备份。',
anchors: items.map(({ anchor, revision}) => ({
id: anchor.id,
summary: deriveSummary(revision.content),
text: revision.content.text,
form: FORM_LABEL[revision.content.form],
memoryTime: formatMemoryTime(revision.content.memoryTime),
tags: revision.content.tags,
emotionsThen: formatEmotions(revision.content.emotionsThen),
emotionsNow: formatEmotions(revision.content.emotionsNow),
photoCount: revision.content.mediaIds.length,
createdAt: anchor.createdAt,
updatedAt: anchor.updatedAt,
})),
heartlines: data.heartlines
.filter((line) =>!line.deletedAt && summaryById.has(line.anchorAId) && summaryById.has(line.anchorBId))
.map((line) => ({
id: line.id,
type: HEARTLINE_META[line.type].label,
from: summaryById.get(line.anchorAId)?? '',
to: summaryById.get(line.anchorBId)?? '',
persons: line.personIds.map(personName).filter(Boolean),
note: line.note,
})),
persons: data.persons.map((person) => person.name),
}
}

export function buildMarkdownExport(data: VaultData): string {
const plain = buildPlainExport(data)
const date = plain.exportedAt.slice(0, 10)
const lines: string[] = [
'# 心络 · 我的记忆',
'',
`导出于 ${date}，共 ${plain.anchors.length} 枚心锚、${plain.heartlines.length} 条心线。`,
'',
'> 这是明文导出，照片未包含在内。完整恢复请使用加密备份。',
'',
'## 心锚',
'',
]
for (const anchor of plain.anchors) {
lines.push(`### ${anchor.summary}`)
lines.push('')
lines.push(`- 时间：${anchor.memoryTime}`)
lines.push(`- 形式：${anchor.form}`)
if (anchor.tags.length > 0) lines.push(`- 标签：${anchor.tags.join('、')}`)
if (anchor.emotionsThen) lines.push(`- 当时：${anchor.emotionsThen}`)
if (anchor.emotionsNow) lines.push(`- 现在：${anchor.emotionsNow}`)
if (anchor.photoCount > 0) lines.push(`- 照片：${anchor.photoCount} 张（见应用内）`)
lines.push('')
if (anchor.text.trim()) {
lines.push(anchor.text.trim())
lines.push('')
}
}
if (plain.heartlines.length > 0) {
lines.push('## 心线')
lines.push('')
for (const line of plain.heartlines) {
const persons = line.persons.length > 0? `（${line.persons.join('、')}）`: ''
lines.push(`- ${line.from} — ${line.to}${persons}`)
if (line.note.trim()) lines.push(` ${line.note.trim()}`)
}
lines.push('')
}
return lines.join('\n')
}

import type { AnchorWithRevision, MemoryTime } from '../types'

export function getTimeSortValue(time: MemoryTime): number | null {
  if (time.precision === 'exact' && time.date) return Date.parse(`${time.date}T12:00:00`)
  if (time.precision === 'month' && time.month) return Date.parse(`${time.month}-01T12:00:00`)
  if (time.precision === 'year' && time.year) return Date.parse(`${time.year}-01-01T12:00:00`)
  if (time.precision === 'range' && time.startYear) {
    return Date.parse(`${time.startYear}-01-01T12:00:00`)
  }
  return null
}

export function formatMemoryTime(time: MemoryTime): string {
  if (time.precision === 'exact' && time.date) {
    const [year, month, day] = time.date.split('-')
    return `${year}年${Number(month)}月${Number(day)}日`
  }
  if (time.precision === 'month' && time.month) {
    const [year, month] = time.month.split('-')
    return `${year}年${Number(month)}月（大致）`
  }
  if (time.precision === 'year' && time.year) return `${time.year}年（大致）`
  if (time.precision === 'range' && time.startYear && time.endYear) {
    return `${time.startYear}—${time.endYear}年（大致）`
  }
  return '未定时间'
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function sortTimeline(
  items: AnchorWithRevision[],
  direction: 'newest' | 'oldest',
): AnchorWithRevision[] {
  return [...items].sort((left, right) => {
    const leftValue = getTimeSortValue(left.revision.content.memoryTime)
    const rightValue = getTimeSortValue(right.revision.content.memoryTime)

    if (leftValue === null && rightValue === null) {
      return Date.parse(right.anchor.createdAt) - Date.parse(left.anchor.createdAt)
    }
    if (leftValue === null) return 1
    if (rightValue === null) return -1
    return direction === 'newest' ? rightValue - leftValue : leftValue - rightValue
  })
}

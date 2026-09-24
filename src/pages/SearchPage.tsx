import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { deriveSummary, getActiveAnchorItems } from '../lib/domain'
import { getTimeSortValue } from '../lib/date'
import { useVault } from '../state/VaultContext'
import { AnchorMiniCard } from '../components/AnchorMiniCard'
import { LoadingScreen } from '../components/LoadingScreen'

export function SearchPage() {
  const { data, loading } = useVault()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const selectedTag = params.get('tag') ?? ''

  const allItems = useMemo(() => (data ? getActiveAnchorItems(data) : []), [data])
  const tags = useMemo(
    () => [...new Set(allItems.flatMap(({ revision }) => revision.content.tags))].sort(),
    [allItems],
  )
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

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return allItems
      .filter(({ revision }) => !selectedTag || revision.content.tags.includes(selectedTag))
      .filter(({ revision }) => {
        if (!normalized) return true
        const content = revision.content
        return (
          content.summary.toLocaleLowerCase().includes(normalized) ||
          content.text.toLocaleLowerCase().includes(normalized) ||
          content.tags.some((tag) => tag.toLocaleLowerCase().includes(normalized))
        )
      })
      .sort((left, right) => {
        const a = getTimeSortValue(left.revision.content.memoryTime) ?? 0
        const b = getTimeSortValue(right.revision.content.memoryTime) ?? 0
        if (a !== b) return b - a
        return Date.parse(right.anchor.updatedAt) - Date.parse(left.anchor.updatedAt)
      })
  }, [allItems, query, selectedTag])

  const updateParams = (nextQuery: string, tag: string) => {
    const next = new URLSearchParams()
    if (nextQuery.trim()) next.set('q', nextQuery.trim())
    if (tag) next.set('tag', tag)
    setParams(next, { replace: true })
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="page search-page">
      <header className="page-header">
        <p className="eyebrow">找回一段经历</p>
        <h1>查找</h1>
        <p>摘要、全文和标签都可以搜索。</p>
      </header>

      <label className="search-field large">
        <Search size={19} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            updateParams(event.target.value, selectedTag)
          }}
          placeholder="想起什么，就搜什么"
          autoFocus
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              updateParams('', selectedTag)
            }}
            aria-label="清空搜索"
          >
            <X size={17} />
          </button>
        )}
      </label>

      {tags.length > 0 && (
        <section className="filter-section">
          <div className="filter-title">
            <SlidersHorizontal size={16} />
            <span>按标签筛选</span>
          </div>
          <div className="chip-cloud">
            <button
              type="button"
              className={!selectedTag ? 'chip selected' : 'chip'}
              onClick={() => updateParams(query, '')}
            >
              全部
            </button>
            {tags.map((tag) => (
              <button
                type="button"
                className={selectedTag === tag ? 'chip selected' : 'chip'}
                key={tag}
                onClick={() => updateParams(query, selectedTag === tag ? '' : tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="result-heading">
        <strong>{results.length} 枚心锚</strong>
        {(query || selectedTag) && <span>已按条件收窄</span>}
      </div>

      {results.length === 0 ? (
        <div className="empty-inline large">
          <Search size={24} />
          <p>还没有找到相符的记忆。</p>
          <small>换一个词，或先不过滤。</small>
        </div>
      ) : (
        <div className="anchor-list">
          {results.map((item) => (
            <AnchorMiniCard
              item={item}
              key={item.anchor.id}
              connectionCount={counts.get(item.anchor.id) ?? 0}
            />
          ))}
        </div>
      )}

      <p className="search-count-note">
        当前共 {allItems.length} 枚心锚，其中 {results.filter(({ revision }) => deriveSummary(revision.content)).length} 枚符合查看条件。
      </p>
    </div>
  )
}

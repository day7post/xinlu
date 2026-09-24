import { Link } from 'react-router-dom'
import { ArrowUpRight, Link2 } from 'lucide-react'
import type { AnchorWithRevision } from '../types'
import { deriveSummary } from '../lib/domain'
import { formatShortDate, formatMemoryTime } from '../lib/date'
import { MediaImage } from './MediaImage'

export function AnchorMiniCard({
  item,
  connectionCount = 0,
  compact = false,
}: {
  item: AnchorWithRevision
  connectionCount?: number
  compact?: boolean
}) {
  const { anchor, revision } = item
  const summary = deriveSummary(revision.content)
  return (
    <Link className={compact ? 'anchor-mini compact' : 'anchor-mini'} to={`/anchor/${anchor.id}`}>
      {revision.content.mediaIds[0] && (
        <MediaImage mediaId={revision.content.mediaIds[0]} alt="" className="mini-thumb" />
      )}
      <span className="mini-copy">
        <strong>{summary}</strong>
        <small>
          {formatMemoryTime(revision.content.memoryTime)}
          {revision.content.tags.length > 0 && ` · ${revision.content.tags.slice(0, 2).join(' / ')}`}
        </small>
      </span>
      <span className="mini-meta">
        {connectionCount > 0 && (
          <span className="line-count">
            <Link2 size={13} />
            {connectionCount}
          </span>
        )}
        {!compact && <time>{formatShortDate(anchor.updatedAt)}</time>}
        <ArrowUpRight size={16} />
      </span>
    </Link>
  )
}



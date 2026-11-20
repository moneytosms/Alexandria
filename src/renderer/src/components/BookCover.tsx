import { useState } from 'react'
import type { Book } from '@shared/types'
import { coverUrl } from '../media'

interface Props {
  book: Book
  className?: string
}

function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

export function BookCover({ book, className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const classes = `cover ${className}`.trim()

  if (failed || !book.coverPath) {
    return (
      <div className={`${classes} cover--fallback`} data-tone={book.id % 5} aria-hidden="true">
        <span className="cover__initials">{initials(book.title) || 'A'}</span>
      </div>
    )
  }

  return (
    <img
      className={classes}
      src={coverUrl(book.id)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

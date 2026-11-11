export function ConversationSkeleton() {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton-line w-70" />
          <span className="skeleton-line w-45" />
          <span className="skeleton-line w-90" />
        </div>
      ))}
    </div>
  )
}

export function MessageSkeleton() {
  return (
    <div className="message-skeleton" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div className={`skeleton-bubble ${index % 2 === 0 ? 'left' : 'right'}`} key={index}>
          <span className="skeleton-line w-45" />
          <span className="skeleton-line w-90" />
        </div>
      ))}
    </div>
  )
}

export function DetailsSkeleton() {
  return (
    <div className="details-skeleton" aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => (
        <span className="skeleton-line w-70" key={index} />
      ))}
    </div>
  )
}

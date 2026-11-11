export type AgentDotStatus = 'online' | 'invisible' | 'offline'

export function AgentStatusDot({ status, label }: { status: AgentDotStatus; label?: string }) {
  return (
    <span className="agent-status-dot-wrap">
      <span className={`status-dot ${status}`} aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  )
}

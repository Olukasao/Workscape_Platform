import type { ConversationStatus } from '../../types/domain'
import { getStatusLabel } from '../../utils/status'

export function StatusBadge({ status }: { status: ConversationStatus }) {
  return <span className={`status-badge status-${status}`}>{getStatusLabel(status)}</span>
}

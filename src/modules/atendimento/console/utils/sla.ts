import type { ConversationSummary } from '../types/domain'

const minute = 60_000
const hour = 60 * minute
const day = 24 * hour
const warningAfter = 10 * minute
const criticalAfter = 30 * minute

export type SlaTone = 'ok' | 'warning' | 'critical'

export interface SlaInfo {
  waitingSince: string
  label: string
  tone: SlaTone
}

export function getCustomerWaitingSince(conversation: ConversationSummary): string | null {
  if (conversation.archivedAt || conversation.status === 'closed' || conversation.status === 'waiting_customer') {
    return null
  }

  if (conversation.waitingSince) return conversation.waitingSince
  if (conversation.lastCustomerMessageAt) return conversation.lastCustomerMessageAt

  if (conversation.status === 'new' || conversation.status === 'waiting_agent' || conversation.unreadCount > 0) {
    return conversation.lastMessageAt ?? conversation.createdAt
  }

  return null
}

export function formatWaitDuration(waitingSince: string, now = Date.now()): string {
  const start = new Date(waitingSince).getTime()
  if (!Number.isFinite(start)) return 'agora'

  const elapsed = Math.max(0, now - start)
  if (elapsed < minute) return 'agora'

  if (elapsed < hour) {
    return `${Math.floor(elapsed / minute)} min`
  }

  if (elapsed < day) {
    const hours = Math.floor(elapsed / hour)
    const minutes = Math.floor((elapsed % hour) / minute)
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  }

  const days = Math.floor(elapsed / day)
  const hours = Math.floor((elapsed % day) / hour)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

export function getSlaTone(waitingSince: string, now = Date.now()): SlaTone {
  const start = new Date(waitingSince).getTime()
  if (!Number.isFinite(start)) return 'ok'

  const elapsed = Math.max(0, now - start)
  if (elapsed >= criticalAfter) return 'critical'
  if (elapsed >= warningAfter) return 'warning'
  return 'ok'
}

export function getSlaInfo(conversation: ConversationSummary, now = Date.now()): SlaInfo | null {
  const waitingSince = getCustomerWaitingSince(conversation)
  if (!waitingSince) return null

  return {
    waitingSince,
    label: formatWaitDuration(waitingSince, now),
    tone: getSlaTone(waitingSince, now),
  }
}

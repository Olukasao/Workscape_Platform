import type { ConversationPriority, ConversationSummary } from '../types/domain'
import { getSlaInfo } from './sla'

const priorityLabels: Record<ConversationPriority, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

const priorityScores: Record<ConversationPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export function getConversationPriority(
  conversation: ConversationSummary,
  now = Date.now(),
): ConversationPriority {
  if (conversation.priorityOverride) {
    return conversation.priorityOverride
  }

  if (conversation.archivedAt || conversation.status === 'closed' || conversation.status === 'waiting_customer') {
    return 'low'
  }

  const tags = conversation.tags ?? []
  const sla = getSlaInfo(conversation, now)

  if (
    sla?.tone === 'critical' ||
    tags.includes('no_connection') ||
    tags.includes('cancellation') ||
    conversation.unreadCount >= 3
  ) {
    return 'high'
  }

  if (
    sla?.tone === 'warning' ||
    tags.includes('slowness') ||
    tags.includes('wifi') ||
    tags.includes('visit') ||
    conversation.unreadCount > 0 ||
    conversation.status === 'waiting_agent'
  ) {
    return 'medium'
  }

  return 'low'
}

export function getConversationPriorityLabel(priority: ConversationPriority): string {
  return priorityLabels[priority]
}

export function getConversationPriorityScore(priority: ConversationPriority): number {
  return priorityScores[priority]
}

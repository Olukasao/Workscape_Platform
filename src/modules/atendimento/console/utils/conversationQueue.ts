import type {
  ConversationQueueSort,
  ConversationSummary,
  ConversationTagFilter,
} from '../types/domain'
import {
  getConversationPriority,
  getConversationPriorityScore,
} from './priority'
import { getCustomerWaitingSince } from './sla'

export const conversationQueueSortOptions: Array<{
  id: ConversationQueueSort
  label: string
}> = [
  { id: 'priority', label: 'Prioridade' },
  { id: 'sla', label: 'SLA crítico' },
  { id: 'unread', label: 'Não lidas' },
  { id: 'newest', label: 'Recentes' },
  { id: 'oldest', label: 'Antigos' },
]

export function applyConversationQueueView(
  conversations: ConversationSummary[],
  {
    tagFilter,
    sort,
    now,
  }: {
    tagFilter: ConversationTagFilter
    sort: ConversationQueueSort
    now?: number
  },
): ConversationSummary[] {
  return sortConversationsByQueue(
    filterConversationsByTag(conversations, tagFilter),
    sort,
    now,
  )
}

export function filterConversationsByTag(
  conversations: ConversationSummary[],
  tagFilter: ConversationTagFilter,
): ConversationSummary[] {
  if (tagFilter === 'all') return conversations

  return conversations.filter((conversation) => conversation.tags?.includes(tagFilter))
}

export function sortConversationsByQueue(
  conversations: ConversationSummary[],
  sort: ConversationQueueSort,
  now = Date.now(),
): ConversationSummary[] {
  return [...conversations].sort((left, right) => {
    if (sort === 'priority') {
      return compareByPriority(left, right, now)
    }

    if (sort === 'sla') {
      return compareBySla(left, right, now) || compareByPriority(left, right, now)
    }

    if (sort === 'unread') {
      return (
        right.unreadCount - left.unreadCount ||
        compareByPriority(left, right, now) ||
        compareByUpdatedAt(left, right)
      )
    }

    if (sort === 'oldest') {
      return compareByOldest(left, right)
    }

    return compareByUpdatedAt(left, right)
  })
}

function compareByPriority(
  left: ConversationSummary,
  right: ConversationSummary,
  now: number,
): number {
  return (
    getConversationPriorityScore(getConversationPriority(right, now)) -
      getConversationPriorityScore(getConversationPriority(left, now)) ||
    compareBySla(left, right, now) ||
    right.unreadCount - left.unreadCount ||
    compareByUpdatedAt(left, right)
  )
}

function compareBySla(
  left: ConversationSummary,
  right: ConversationSummary,
  now: number,
): number {
  return getWaitingElapsed(right, now) - getWaitingElapsed(left, now)
}

function compareByUpdatedAt(left: ConversationSummary, right: ConversationSummary): number {
  return getTime(right.lastMessageAt ?? right.updatedAt) - getTime(left.lastMessageAt ?? left.updatedAt)
}

function compareByOldest(left: ConversationSummary, right: ConversationSummary): number {
  return getTime(left.lastMessageAt ?? left.createdAt) - getTime(right.lastMessageAt ?? right.createdAt)
}

function getWaitingElapsed(conversation: ConversationSummary, now: number): number {
  const waitingSince = getCustomerWaitingSince(conversation)
  if (!waitingSince) return 0

  const time = new Date(waitingSince).getTime()
  return Number.isFinite(time) ? Math.max(0, now - time) : 0
}

function getTime(value?: string): number {
  if (!value) return 0

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

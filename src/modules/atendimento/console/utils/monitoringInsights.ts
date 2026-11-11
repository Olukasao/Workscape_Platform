import { conversationsApi } from '../services/api/conversationsApi'
import type { ConversationFilter, ConversationSummary } from '../types/domain'

const LIST_FILTERS: ConversationFilter[] = ['new', 'open', 'waiting_customer', 'closed', 'archived']

/**
 * The conversations API has no "all statuses" filter, so a full-range read means
 * fetching every known status bucket and merging. A conversation stuck in a status
 * combination outside these five buckets (e.g. status "new" already assigned to an
 * agent) would be missed — a pre-existing gap in the list endpoint, not introduced here.
 */
export async function fetchConversationsInRange(
  dateFromIso: string,
  dateToIso: string,
  perPageEach = 300,
): Promise<ConversationSummary[]> {
  const pages = await Promise.all(
    LIST_FILTERS.map((filter) =>
      conversationsApi
        .list({ filter, dateFrom: dateFromIso, dateTo: dateToIso, perPage: perPageEach, sort: 'newest' })
        .then((response) => response.data)
        .catch(() => [] as ConversationSummary[]),
    ),
  )

  const byId = new Map<string, ConversationSummary>()
  for (const page of pages) {
    for (const conversation of page) byId.set(conversation.id, conversation)
  }

  return [...byId.values()]
}

export function bucketByHour(
  conversations: ConversationSummary[],
  getDate: (conversation: ConversationSummary) => string | undefined,
): number[] {
  const buckets = new Array<number>(24).fill(0)

  for (const conversation of conversations) {
    const raw = getDate(conversation)
    if (!raw) continue
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) continue
    buckets[date.getHours()] += 1
  }

  return buckets
}

export function tallyTags(conversations: ConversationSummary[]): Map<string, number> {
  const tally = new Map<string, number>()

  for (const conversation of conversations) {
    const tags = conversation.tags?.length ? conversation.tags : ['sem_categoria']
    for (const tag of tags) {
      tally.set(tag, (tally.get(tag) ?? 0) + 1)
    }
  }

  return tally
}

export function tallyByAgent(conversations: ConversationSummary[]): Map<string, number> {
  const tally = new Map<string, number>()

  for (const conversation of conversations) {
    if (!conversation.assignedAgentId) continue
    tally.set(conversation.assignedAgentId, (tally.get(conversation.assignedAgentId) ?? 0) + 1)
  }

  return tally
}

export function isWithinDay(iso: string | undefined, dayStart: Date, dayEnd: Date): boolean {
  if (!iso) return false
  const time = new Date(iso).getTime()
  return Number.isFinite(time) && time >= dayStart.getTime() && time < dayEnd.getTime()
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000)
}

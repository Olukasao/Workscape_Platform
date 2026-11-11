import type { ConversationTag } from '../types/domain'

export const conversationTagOptions: Array<{
  id: ConversationTag
  label: string
}> = [
  { id: 'no_connection', label: 'Sem conexão' },
  { id: 'billing', label: 'Financeiro' },
  { id: 'slowness', label: 'Lentidão' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'visit', label: 'Visita' },
  { id: 'cancellation', label: 'Cancelamento' },
]

const tagsByLabel = new Map(
  conversationTagOptions.map((option) => [normalizeLabel(option.label), option.id]),
)

const tagAliases = new Map<string, ConversationTag>([
  ['sem conexao', 'no_connection'],
  ['sem internet', 'no_connection'],
  ['no connection', 'no_connection'],
  ['financeiro', 'billing'],
  ['billing', 'billing'],
  ['internet lenta', 'slowness'],
  ['lentidao', 'slowness'],
  ['slowness', 'slowness'],
  ['wifi', 'wifi'],
  ['wi fi', 'wifi'],
  ['visita tecnica', 'visit'],
  ['visita', 'visit'],
  ['visit', 'visit'],
  ['cancelamento', 'cancellation'],
  ['cancellation', 'cancellation'],
])

export function isConversationTag(value: unknown): value is ConversationTag {
  return conversationTagOptions.some((option) => option.id === value)
}

export function getConversationTagLabel(tag: ConversationTag): string {
  return conversationTagOptions.find((option) => option.id === tag)?.label ?? tag
}

export function normalizeConversationTag(value: unknown): ConversationTag | null {
  if (isConversationTag(value)) return value
  if (typeof value !== 'string') return null

  const normalized = normalizeLabel(value)
  return tagsByLabel.get(normalized) ?? tagAliases.get(normalized) ?? null
}

export function normalizeConversationTags(value: unknown): ConversationTag[] {
  if (!Array.isArray(value)) return []

  const tags = value
    .map((item) => {
      if (typeof item === 'string') return normalizeConversationTag(item)
      if (!item || typeof item !== 'object') return null

      const record = item as Record<string, unknown>
      return normalizeConversationTag(record.id ?? record.slug ?? record.value ?? record.label ?? record.name)
    })
    .filter((tag): tag is ConversationTag => tag !== null)

  return [...new Set(tags)]
}

export function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

import { appConfig } from '../../config'
import { mockServer } from '../../mocks/mockServer'
import type { QuickReply } from '../../types/domain'
import { apiRequest } from './httpClient'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : String(value ?? fallback)
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function normalizeQuickReply(value: unknown): QuickReply {
  const record = asRecord(value)

  return {
    id: asString(record.id),
    shortcut: asString(record.shortcut),
    title: asString(record.title),
    body: asString(record.body),
    category: asOptionalString(record.category) ?? null,
    active: record.active === undefined ? true : Boolean(record.active),
    createdBy: asOptionalString(record.createdBy ?? record.created_by) ?? null,
    createdAt: asString(record.createdAt ?? record.created_at, new Date().toISOString()),
    updatedAt: asString(record.updatedAt ?? record.updated_at, new Date().toISOString()),
  }
}

export interface QuickReplyInput {
  shortcut: string
  title: string
  body: string
  category?: string | null
}

export const quickRepliesApi = {
  async list(includeInactive = false): Promise<QuickReply[]> {
    if (appConfig.useMock) return mockServer.listQuickReplies(includeInactive)

    const response = await apiRequest<unknown>(
      `/api/agent/quick-replies${includeInactive ? '?includeInactive=true' : ''}`,
      { unwrap: false },
    )
    const record = asRecord(response)
    const items = Array.isArray(record.quickReplies) ? record.quickReplies : []
    return items.map(normalizeQuickReply)
  },

  async create(input: QuickReplyInput): Promise<QuickReply> {
    if (appConfig.useMock) return mockServer.createQuickReply(input)

    const response = await apiRequest<unknown>('/api/agent/quick-replies', {
      method: 'POST',
      body: input,
    })
    return normalizeQuickReply(response)
  },

  async update(id: string, patch: Partial<QuickReplyInput> & { active?: boolean }): Promise<QuickReply> {
    if (appConfig.useMock) return mockServer.updateQuickReply(id, patch)

    const response = await apiRequest<unknown>(`/api/agent/quick-replies/${id}`, {
      method: 'PATCH',
      body: patch,
    })
    return normalizeQuickReply(response)
  },

  async remove(id: string): Promise<void> {
    if (appConfig.useMock) return mockServer.deleteQuickReply(id)

    return apiRequest<void>(`/api/agent/quick-replies/${id}`, {
      method: 'DELETE',
    })
  },
}

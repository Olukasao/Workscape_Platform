import { appConfig } from '../../config'
import { mockServer } from '../../mocks/mockServer'
import type { AuditLogEntry, PaginatedResponse } from '../../types/domain'
import { apiRequest } from './httpClient'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : String(value ?? fallback)
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function normalizeAuditLog(value: unknown): AuditLogEntry {
  const record = asRecord(value)

  return {
    id: asString(record.id),
    agentId: asOptionalString(record.agentId ?? record.agent_id),
    agentName: asOptionalString(record.agentName ?? record.agent_name),
    action: asString(record.action),
    targetType: asOptionalString(record.targetType ?? record.target_type),
    targetId: asOptionalString(record.targetId ?? record.target_id),
    metadata:
      record.metadata && typeof record.metadata === 'object' ? (record.metadata as Record<string, unknown>) : null,
    createdAt: asString(record.createdAt ?? record.created_at, new Date().toISOString()),
  }
}

export interface AuditLogFilter {
  agentId?: string
  action?: string
  targetType?: string
  targetId?: string
  dateFrom?: string
  dateTo?: string
  cursor?: string | null
  perPage?: number
}

function toQueryString(params: Array<[string, string | number | null | undefined]>): string {
  const query = new URLSearchParams()
  params.forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) query.set(key, String(value))
  })
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const auditApi = {
  async list(filter: AuditLogFilter = {}): Promise<PaginatedResponse<AuditLogEntry>> {
    if (appConfig.useMock) return mockServer.listAuditLogs(filter)

    const response = await apiRequest<unknown>(
      `/api/agent/audit${toQueryString([
        ['agentId', filter.agentId],
        ['action', filter.action],
        ['targetType', filter.targetType],
        ['targetId', filter.targetId],
        ['dateFrom', filter.dateFrom],
        ['dateTo', filter.dateTo],
        ['cursor', filter.cursor],
        ['limit', filter.perPage],
      ])}`,
      { unwrap: false },
    )
    const record = asRecord(response)
    const items = Array.isArray(record.items) ? record.items : []

    return {
      data: items.map(normalizeAuditLog),
      pagination: {
        hasMore: record.nextCursor !== null && record.nextCursor !== undefined,
        nextCursor: record.nextCursor === null || record.nextCursor === undefined ? null : String(record.nextCursor),
      },
    }
  },
}

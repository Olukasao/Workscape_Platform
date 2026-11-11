import { appConfig } from '../../config'
import { mockServer } from '../../mocks/mockServer'
import type {
  AudienceEstimate,
  Campaign,
  CampaignAudienceFilter,
  CampaignChannel,
  CampaignStatus,
  PaginatedResponse,
} from '../../types/domain'
import { ApiError } from './httpClient'
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

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeCampaign(value: unknown): Campaign {
  const r = asRecord(value)
  const audienceFilter = r.audienceFilter ?? r.audience_filter

  return {
    id: asString(r.id),
    name: asString(r.name),
    channel: (r.channel as CampaignChannel) ?? 'whatsapp',
    audienceFilter:
      audienceFilter && typeof audienceFilter === 'object' ? (audienceFilter as CampaignAudienceFilter) : null,
    messageBody: asString(r.messageBody ?? r.message_body),
    scheduledAt: asOptionalString(r.scheduledAt ?? r.scheduled_at),
    status: (r.status as CampaignStatus) ?? 'draft',
    createdBy: asString(r.createdBy ?? r.created_by),
    recipientsCount: asNumber(r.recipientsCount ?? r.recipients_count),
    sentCount: asNumber(r.sentCount ?? r.sent_count),
    deliveredCount: asNumber(r.deliveredCount ?? r.delivered_count),
    failedCount: asNumber(r.failedCount ?? r.failed_count),
    statusMessage: asOptionalString(r.statusMessage ?? r.status_message),
    createdAt: asString(r.createdAt ?? r.created_at, new Date().toISOString()),
    updatedAt: asString(r.updatedAt ?? r.updated_at, new Date().toISOString()),
  }
}

function toQueryString(params: Array<[string, string | number | null | undefined]>): string {
  const query = new URLSearchParams()
  params.forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) query.set(key, String(value))
  })
  const text = query.toString()
  return text ? `?${text}` : ''
}

export interface CampaignInput {
  name: string
  channel: CampaignChannel
  audienceFilter?: CampaignAudienceFilter | null
  messageBody: string
  scheduledAt?: string | null
}

export const campaignsApi = {
  async estimateAudience(audienceFilter: CampaignAudienceFilter | null): Promise<AudienceEstimate> {
    if (appConfig.useMock) return mockServer.estimateCampaignAudience(audienceFilter)

    const response = await apiRequest<unknown>('/api/agent/campaigns/audience-estimate', {
      method: 'POST',
      body: { audienceFilter },
      unwrap: false,
    })
    const r = asRecord(response)
    return {
      count: asNumber(r.count),
      sample: Array.isArray(r.sample)
        ? r.sample.map((item) => {
            const row = asRecord(item)
            return { customerId: asString(row.customerId), customerName: asOptionalString(row.customerName) }
          })
        : [],
    }
  },

  async create(input: CampaignInput): Promise<Campaign> {
    if (appConfig.useMock) return mockServer.createCampaign(input)

    const response = await apiRequest<unknown>('/api/agent/campaigns', { method: 'POST', body: input })
    return normalizeCampaign(response)
  },

  async update(id: string, patch: Partial<CampaignInput>): Promise<Campaign> {
    if (appConfig.useMock) return mockServer.updateCampaign(id, patch)

    return normalizeCampaign(await apiRequest<unknown>(`/api/agent/campaigns/${id}`, { method: 'PATCH', body: patch }))
  },

  async list(filter: { status?: CampaignStatus; channel?: CampaignChannel } = {}): Promise<PaginatedResponse<Campaign>> {
    if (appConfig.useMock) return mockServer.listCampaigns(filter)

    const response = await apiRequest<unknown>(
      `/api/agent/campaigns${toQueryString([
        ['status', filter.status],
        ['channel', filter.channel],
      ])}`,
      { unwrap: false },
    )
    const record = asRecord(response)
    const items = Array.isArray(record.items) ? record.items : []

    return {
      data: items.map(normalizeCampaign),
      pagination: {
        hasMore: record.nextCursor !== null && record.nextCursor !== undefined,
        nextCursor: record.nextCursor === null || record.nextCursor === undefined ? null : String(record.nextCursor),
      },
    }
  },

  async cancel(id: string): Promise<Campaign> {
    if (appConfig.useMock) return mockServer.cancelCampaign(id)

    return normalizeCampaign(await apiRequest<unknown>(`/api/agent/campaigns/${id}/cancel`, { method: 'POST' }))
  },

  /** Lança o envio real. Hoje sempre falha com "channel_integration_pending" — nenhum canal está integrado. */
  async send(id: string): Promise<{ ok: true; campaign: Campaign } | { ok: false; message: string }> {
    if (appConfig.useMock) return mockServer.sendCampaign(id)

    try {
      const response = await apiRequest<unknown>(`/api/agent/campaigns/${id}/send`, { method: 'POST' })
      return { ok: true, campaign: normalizeCampaign(response) }
    } catch (error) {
      if (error instanceof ApiError) return { ok: false, message: error.message }
      throw error
    }
  },
}

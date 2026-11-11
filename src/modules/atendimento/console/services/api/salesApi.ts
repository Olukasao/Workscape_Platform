import { appConfig } from '../../config'
import { mockServer } from '../../mocks/mockServer'
import type { PaginatedResponse, Sale, SaleStatus, SaleSummary } from '../../types/domain'
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

function normalizeSale(value: unknown): Sale {
  const r = asRecord(value)
  return {
    id: asString(r.id),
    customerId: asOptionalString(r.customerId ?? r.customer_id),
    contractId: asOptionalString(r.contractId ?? r.contract_id),
    conversationId: asOptionalString(r.conversationId ?? r.conversation_id),
    agentId: asString(r.agentId ?? r.agent_id),
    productType: asString(r.productType ?? r.product_type),
    planName: asOptionalString(r.planName ?? r.plan_name),
    value: asNumber(r.value),
    origin: asOptionalString(r.origin),
    status: (r.status as SaleStatus) ?? 'pending',
    note: asOptionalString(r.note),
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

export interface CreateSaleInput {
  customerId?: string
  contractId?: string
  conversationId?: string
  productType: string
  planName?: string
  value: number
  origin?: string
  note?: string
}

export interface SaleListFilter {
  agentId?: string
  status?: SaleStatus
  productType?: string
  cursor?: string | null
  perPage?: number
}

export const salesApi = {
  async create(input: CreateSaleInput): Promise<Sale> {
    if (appConfig.useMock) return mockServer.createSale(input)

    return normalizeSale(await apiRequest<unknown>('/api/agent/sales', { method: 'POST', body: input }))
  },

  async update(id: string, patch: Partial<CreateSaleInput> & { status?: SaleStatus }): Promise<Sale> {
    if (appConfig.useMock) return mockServer.updateSale(id, patch)

    return normalizeSale(await apiRequest<unknown>(`/api/agent/sales/${id}`, { method: 'PATCH', body: patch }))
  },

  async list(filter: SaleListFilter = {}): Promise<PaginatedResponse<Sale>> {
    if (appConfig.useMock) return mockServer.listSales(filter)

    const response = await apiRequest<unknown>(
      `/api/agent/sales${toQueryString([
        ['agentId', filter.agentId],
        ['status', filter.status],
        ['productType', filter.productType],
        ['cursor', filter.cursor],
        ['limit', filter.perPage],
      ])}`,
      { unwrap: false },
    )
    const record = asRecord(response)
    const items = Array.isArray(record.items) ? record.items : []

    return {
      data: items.map(normalizeSale),
      pagination: {
        hasMore: record.nextCursor !== null && record.nextCursor !== undefined,
        nextCursor: record.nextCursor === null || record.nextCursor === undefined ? null : String(record.nextCursor),
      },
    }
  },

  async getSummary(dateFrom?: string, dateTo?: string): Promise<SaleSummary> {
    if (appConfig.useMock) return mockServer.getSalesSummary(dateFrom, dateTo)

    const response = await apiRequest<unknown>(
      `/api/agent/sales/summary${toQueryString([
        ['dateFrom', dateFrom],
        ['dateTo', dateTo],
      ])}`,
      { unwrap: false },
    )
    const r = asRecord(response)

    return {
      countToday: asNumber(r.countToday),
      countPeriod: asNumber(r.countPeriod),
      valuePeriod: asNumber(r.valuePeriod),
      averageTicket: asNumber(r.averageTicket),
      byAgent: Array.isArray(r.byAgent)
        ? r.byAgent.map((item) => {
            const row = asRecord(item)
            return { agentId: asString(row.agentId), count: asNumber(row.count), value: asNumber(row.value) }
          })
        : [],
      byProduct: Array.isArray(r.byProduct)
        ? r.byProduct.map((item) => {
            const row = asRecord(item)
            return {
              productType: asString(row.productType),
              count: asNumber(row.count),
              value: asNumber(row.value),
            }
          })
        : [],
    }
  },
}

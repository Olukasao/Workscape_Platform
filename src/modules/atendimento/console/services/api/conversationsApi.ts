import { appConfig } from '../../config'
import { mockServer } from '../../mocks/mockServer'
import type {
  ConversationDetail,
  ConversationCounts,
  ConversationCloseReason,
  ConversationFilter,
  ConversationNote,
  ConversationQueueSort,
  ConversationStatus,
  ConversationSummary,
  ConversationTag,
  ConversationTagFilter,
  CustomerHistory,
  CustomerHistoryEntry,
  CustomerSearchContract,
  CustomerSearchResult,
  Message,
  PaginatedResponse,
  StartCustomerChatResponse,
  TicketMetadata,
  TicketMetadataLine,
} from '../../types/domain'
import { normalizeConversationTags } from '../../utils/conversationTags'
import { apiRequest } from './httpClient'

interface ConversationListParams {
  filter: ConversationFilter
  search?: string
  tag?: ConversationTagFilter
  sort?: ConversationQueueSort
  page?: number
  perPage?: number
  dateFrom?: string
  dateTo?: string
  ticketNumber?: string
  document?: string
  phone?: string
  assignedAgentId?: string
}

interface MessageListParams {
  cursor?: string | null
  perPage?: number
}

interface UpdateStatusOptions {
  closeReason?: ConversationCloseReason
  closeReasonNote?: string
}

function toQueryString(params: Array<[string, string | number | null | undefined]>): string {
  const query = new URLSearchParams()

  params.forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      query.set(key, String(value))
    }
  })

  const text = query.toString()
  return text ? `?${text}` : ''
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function unwrapRecord(value: unknown, key: string): Record<string, unknown> {
  const record = asRecord(value)
  const nested = record[key]

  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : record
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : String(value ?? fallback)
}

function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || typeof value === 'object') return undefined

  const text = String(value).trim()
  return text ? text : undefined
}

function firstOptionalString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = asOptionalString(value)
    if (text) return text
  }

  return undefined
}

function isTechnicalCustomerLabel(value: string): boolean {
  const normalized = value.toLowerCase()
  return (
    value.startsWith('customer_') ||
    normalized === 'cliente' ||
    normalized === 'cliente acessanet' ||
    normalized.startsWith('cliente customer_')
  )
}

function firstDisplayName(...values: unknown[]): string | undefined {
  for (const value of values) {
    const text = asOptionalString(value)
    if (text && !isTechnicalCustomerLabel(text)) return text
  }

  return undefined
}

function asNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function asMetadataLines(value: unknown): TicketMetadataLine[] | undefined {
  if (!Array.isArray(value)) return undefined

  const lines = value
    .map((item) => {
      const record = asOptionalRecord(item)
      const label = asOptionalString(record?.label)
      const lineValue = asOptionalString(record?.value)

      return label && lineValue ? { label, value: lineValue } : null
    })
    .filter((item): item is TicketMetadataLine => item !== null)

  return lines.length > 0 ? lines : undefined
}

function normalizeTicketMetadata(value: unknown): TicketMetadata | null {
  const metadata = asOptionalRecord(value)
  if (!metadata) return null

  const customer = asOptionalRecord(metadata.customer ?? metadata.cliente ?? metadata.client)
  const contract = asOptionalRecord(metadata.contract ?? metadata.contrato)
  const ticket = asOptionalRecord(metadata.ticket ?? metadata.chamado ?? metadata.os)
  const diagnosis = asOptionalRecord(
    metadata.diagnosis ?? metadata.diagnostico ?? metadata.triage ?? metadata.triagem,
  )
  const appointment = asOptionalRecord(ticket?.appointment)

  return {
    customer: customer
      ? {
          name: firstOptionalString(
            customer.name,
            customer.nome,
            customer.razaoSocial,
            customer.razao_social,
            customer.nome_razaosocial,
          ),
          document: firstOptionalString(customer.document, customer.documento, customer.cpf, customer.cnpj),
          phone: firstOptionalString(customer.phone, customer.telefone, customer.celular, customer.whatsapp),
        }
      : undefined,
    contract: contract
      ? {
          id: firstOptionalString(contract.id, contract.numero, contract.contrato),
          planName: firstOptionalString(
            contract.planName,
            contract.plan_name,
            contract.plano,
            contract.plano_nome,
          ),
          addressLine: asOptionalString(contract.addressLine ?? contract.address_line),
          city: firstOptionalString(contract.city, contract.cidade),
          state: firstOptionalString(contract.state, contract.uf, contract.estado),
          status: firstOptionalString(contract.status, contract.situacao),
        }
      : undefined,
    ticket: ticket
      ? {
          id: firstOptionalString(ticket.id, ticket.numero, ticket.id_ordem_servico, ticket.id_chamado),
          protocol: firstOptionalString(ticket.protocol, ticket.protocolo, ticket.numero_os),
          sgpTicketId: asOptionalString(ticket.sgpTicketId ?? ticket.sgp_ticket_id),
          status: firstOptionalString(ticket.status, ticket.status_descricao, ticket.situacao),
          statusInterno: asOptionalString(ticket.statusInterno ?? ticket.status_interno),
          title: firstOptionalString(ticket.title, ticket.titulo, ticket.motivo, ticket.tipo, ticket.assunto),
          description: firstOptionalString(ticket.description, ticket.descricao),
          createdAt: asOptionalString(ticket.createdAt ?? ticket.created_at),
          updatedAt: asOptionalString(ticket.updatedAt ?? ticket.updated_at),
          appointment: appointment
            ? {
                date: asOptionalString(appointment.date),
                windowStart: asOptionalString(appointment.windowStart ?? appointment.window_start),
                windowEnd: asOptionalString(appointment.windowEnd ?? appointment.window_end),
                technicianName: asOptionalString(
                  appointment.technicianName ?? appointment.technician_name,
                ),
                addressLine: asOptionalString(appointment.addressLine ?? appointment.address_line),
                city: asOptionalString(appointment.city),
                state: asOptionalString(appointment.state),
              }
            : undefined,
        }
      : undefined,
    diagnosis: diagnosis
      ? {
          categoryId: asOptionalString(diagnosis.categoryId ?? diagnosis.category_id),
          categoryTitle: firstOptionalString(
            diagnosis.categoryTitle,
            diagnosis.category_title,
            diagnosis.categoria,
            diagnosis.motivo,
          ),
          classification: firstOptionalString(diagnosis.classification, diagnosis.classificacao),
          customerMessage: firstOptionalString(
            diagnosis.customerMessage ?? diagnosis.customer_message,
            diagnosis.mensagem_cliente,
          ),
          structuredDescription: firstOptionalString(
            diagnosis.structuredDescription ?? diagnosis.structured_description,
            diagnosis.descricao_estruturada,
          ),
          summary: asMetadataLines(diagnosis.summary),
          answers: asMetadataLines(diagnosis.answers),
        }
      : undefined,
  }
}

function normalizeStatus(value: unknown): ConversationStatus {
  if (
    value === 'new' ||
    value === 'open' ||
    value === 'waiting_customer' ||
    value === 'waiting_agent' ||
    value === 'closed'
  ) {
    return value
  }

  return 'new'
}

function normalizeCloseReason(value: unknown): ConversationCloseReason | null {
  if (
    value === 'resolved' ||
    value === 'no_customer_response' ||
    value === 'sent_to_technician' ||
    value === 'duplicate' ||
    value === 'other'
  ) {
    return value
  }

  return null
}

function normalizeCustomerHistoryEntry(value: unknown): CustomerHistoryEntry | null {
  const record = asOptionalRecord(value)
  if (!record) return null

  const id = asOptionalString(record.id)
  if (!id) return null

  return {
    id,
    ticketId: asOptionalString(record.ticketId ?? record.ticket_id),
    status: normalizeStatus(record.status),
    createdAt: asString(record.createdAt ?? record.created_at, new Date().toISOString()),
    closedAt: asOptionalString(record.closedAt ?? record.closed_at) ?? null,
    closeReason: normalizeCloseReason(record.closeReason ?? record.close_reason),
  }
}

function normalizeCustomerHistory(value: unknown): CustomerHistory | undefined {
  const record = asOptionalRecord(value)
  if (!record) return undefined

  const entries = Array.isArray(record.recentConversations ?? record.recent_conversations)
    ? ((record.recentConversations ?? record.recent_conversations) as unknown[])
        .map(normalizeCustomerHistoryEntry)
        .filter((item): item is CustomerHistoryEntry => item !== null)
    : []

  return {
    recentCount: asNumber(record.recentCount ?? record.recent_count, entries.length),
    recentConversations: entries,
  }
}

export function normalizeConversationNote(value: unknown): ConversationNote {
  const record = unwrapRecord(value, 'note')

  return {
    id: asString(record.id),
    conversationId: asString(record.conversationId ?? record.conversation_id),
    agentId: asOptionalString(record.agentId ?? record.agent_id) ?? null,
    agentName: asString(record.agentName ?? record.agent_name, 'Atendente'),
    note: asString(record.note ?? record.body ?? record.message),
    createdAt: asString(record.createdAt ?? record.created_at, new Date().toISOString()),
  }
}

export function normalizeConversation(value: unknown): ConversationDetail {
  const record = unwrapRecord(value, 'conversation')
  const ticketMetadata = normalizeTicketMetadata(record.ticketMetadata ?? record.ticket_metadata)
  const customerRecord = asOptionalRecord(record.customer ?? record.cliente)
  const ticketRecord = asOptionalRecord(record.ticket ?? record.chamado ?? record.os)
  const id = asString(record.id)
  const customerId = asString(record.customerId ?? record.customer_id, 'cliente')
  const contractId = asString(record.contractId ?? record.contract_id)
  const ticketId = asString(record.ticketId ?? record.ticket_id)
  const createdAt = asString(record.createdAt ?? record.created_at, new Date().toISOString())
  const updatedAt = asString(record.updatedAt ?? record.updated_at, createdAt)
  const assignedAgentId = record.assignedAgentId ?? record.assigned_agent_id
  const customerNameCandidate = firstDisplayName(
    record.customerName,
    record.customer_name,
    record.nomeCliente,
    record.nome_cliente,
    record.cliente_nome,
    customerRecord?.name,
    customerRecord?.nome,
    customerRecord?.razaoSocial,
    customerRecord?.razao_social,
    ticketMetadata?.customer?.name,
  )
  const customerName =
    customerNameCandidate ??
    (customerId.startsWith('customer_') ? 'Cliente' : `Cliente ${customerId}`)
  const ticketNumber = ticketMetadata?.ticket?.protocol ?? ticketMetadata?.ticket?.id ?? ticketId
  const subject =
    ticketMetadata?.diagnosis?.categoryTitle ??
    ticketMetadata?.diagnosis?.customerMessage ??
    ticketMetadata?.ticket?.title ??
    firstOptionalString(
      record.subject,
      record.reason,
      record.motivo,
      record.assunto,
      record.ticketTitle,
      record.ticket_title,
      ticketRecord?.title,
      ticketRecord?.titulo,
      ticketRecord?.motivo,
      ticketRecord?.assunto,
    ) ??
    `Chamado #${ticketNumber}`
  const appointment = ticketMetadata?.ticket?.appointment

  return {
    id,
    status: normalizeStatus(record.status),
    customerName,
    customer: {
      name: customerName,
      contractNumber: ticketMetadata?.contract?.id ?? contractId,
      document: ticketMetadata?.customer?.document,
      plan: ticketMetadata?.contract?.planName,
      ticketNumber,
      reason: subject,
      sgpStatus: ticketMetadata?.ticket?.status,
      openedAt: ticketMetadata?.ticket?.createdAt ?? createdAt,
      visit: appointment
        ? {
            dateLabel: appointment.date,
            timeWindow: [appointment.windowStart, appointment.windowEnd].filter(Boolean).join(' - '),
            technicianName: appointment.technicianName,
          }
        : undefined,
    },
    subject,
    ticketNumber,
    assignedAgentId: assignedAgentId === null || assignedAgentId === undefined ? null : String(assignedAgentId),
    assignedAgentName: asOptionalString(record.assignedAgentName ?? record.assigned_agent_name) ?? null,
    ticketMetadata,
    tags: normalizeConversationTags(record.tags ?? record.categories ?? record.category_tags),
    unreadCount: Number(record.unreadCount ?? record.unread_count ?? 0),
    lastMessage: asOptionalString(record.lastMessage ?? record.last_message),
    lastMessageAt: asOptionalString(record.lastMessageAt ?? record.last_message_at),
    lastCustomerMessageAt: asOptionalString(
      record.lastCustomerMessageAt ?? record.last_customer_message_at,
    ),
    waitingSince: asOptionalString(record.waitingSince ?? record.waiting_since),
    closedAt: asOptionalString(record.closedAt ?? record.closed_at),
    closeReason: normalizeCloseReason(record.closeReason ?? record.close_reason),
    closeReasonNote: asOptionalString(record.closeReasonNote ?? record.close_reason_note),
    archivedAt:
      record.archivedAt === null || record.archived_at === null
        ? null
        : asOptionalString(record.archivedAt ?? record.archived_at),
    createdAt,
    updatedAt,
    customerHistory: normalizeCustomerHistory(record.customerHistory ?? record.customer_history),
  }
}

export function normalizeMessage(value: unknown): Message {
  const record = unwrapRecord(value, 'message')
  const sender = asOptionalRecord(record.sender)
  const customer = asOptionalRecord(record.customer)
  const agent = asOptionalRecord(record.agent)
  const senderType = record.senderType ?? record.sender_type ?? record.authorType ?? record.author_type
  const authorType =
    senderType === 'agent' || senderType === 'customer' || senderType === 'system'
      ? senderType
      : 'system'
  const explicitAuthorName = asOptionalString(
    record.authorName ??
      record.author_name ??
      record.senderName ??
      record.sender_name ??
      sender?.name ??
      sender?.nome ??
      record.agentName ??
      record.agent_name ??
      agent?.name ??
      agent?.nome ??
      record.technicianName ??
      record.technician_name,
  )
  const customerAuthorName =
    authorType === 'customer'
      ? asOptionalString(
          record.customerName ??
            record.customer_name ??
            customer?.name ??
            customer?.nome,
        )
      : undefined

  return {
    id: asString(record.id),
    conversationId: asString(record.conversationId ?? record.conversation_id),
    clientMessageId: asOptionalString(record.clientMessageId ?? record.client_message_id),
    senderId: asOptionalString(record.senderId ?? record.sender_id) ?? null,
    authorType,
    authorName:
      explicitAuthorName ??
      customerAuthorName ??
      (authorType === 'customer' ? 'Cliente' : authorType === 'agent' ? 'Atendimento' : 'AcessaNet'),
    body: asString(record.body ?? record.message ?? record.text),
    createdAt: asString(record.createdAt ?? record.created_at, new Date().toISOString()),
    status: record.status === 'sending' || record.status === 'failed' ? record.status : 'sent',
  }
}

function applyClientSideFilters(
  data: ConversationSummary[],
  params: ConversationListParams,
): ConversationSummary[] {
  const ticketNumber = params.ticketNumber?.trim().toLowerCase()
  const document = params.document?.replace(/\D/g, '')
  const phone = params.phone?.replace(/\D/g, '')

  return data
    .filter((item) => !ticketNumber || item.ticketNumber?.toLowerCase().includes(ticketNumber))
    .filter((item) => !document || (item.customer?.document ?? '').replace(/\D/g, '').includes(document))
    .filter(
      (item) => !phone || (item.ticketMetadata?.customer?.phone ?? '').replace(/\D/g, '').includes(phone),
    )
    .filter((item) => !params.assignedAgentId || item.assignedAgentId === params.assignedAgentId)
}

function normalizePage<T>(
  payload: unknown,
  mapper: (value: unknown) => T,
): PaginatedResponse<T> {
  const record = asRecord(payload)
  const meta = asRecord(record.meta)
  const data = Array.isArray(payload)
    ? payload
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.items)
        ? record.items
        : Array.isArray(record.conversations)
          ? record.conversations
          : Array.isArray(record.messages)
            ? record.messages
            : []
  const pagination = asRecord(record.pagination)
  const metaPagination = asRecord(meta.pagination)
  const nextCursor =
    record.nextCursor ??
    record.next_cursor ??
    pagination.nextCursor ??
    pagination.next_cursor ??
    metaPagination.nextCursor ??
    metaPagination.next_cursor
  const total = record.total ?? pagination.total ?? metaPagination.total
  const counts = normalizeCounts(record.counts ?? meta.counts)

  return {
    data: data.map(mapper),
    pagination: {
      page: asNumber(pagination.page ?? metaPagination.page, 1),
      perPage: asNumber(
        pagination.perPage ??
          pagination.per_page ??
          pagination.limit ??
          metaPagination.perPage ??
          metaPagination.per_page ??
          metaPagination.limit,
        data.length,
      ),
      hasMore: Boolean(
        pagination.hasMore ?? pagination.has_more ?? metaPagination.hasMore ?? metaPagination.has_more ?? nextCursor,
      ),
      nextCursor: nextCursor === null || nextCursor === undefined ? null : String(nextCursor),
      total: total === undefined || total === null ? undefined : asNumber(total),
    },
    counts,
  }
}

function normalizeCounts(value: unknown): ConversationCounts | undefined {
  const counts = asOptionalRecord(value)
  if (!counts) return undefined

  return {
    new: asNumber(counts.new ?? counts.novos),
    mine: asNumber(counts.mine ?? counts.meus),
    open: asNumber(counts.open ?? counts.em_atendimento),
    waiting_customer: asNumber(
      counts.waiting_customer ?? counts.waitingCustomer ?? counts.aguardando_cliente,
    ),
    closed: asNumber(counts.closed ?? counts.encerrados),
    archived: asNumber(counts.archived ?? counts.arquivados),
    today:
      counts.today === undefined && counts.hoje === undefined
        ? undefined
        : asNumber(counts.today ?? counts.hoje),
  }
}

function normalizeCustomerSearchContract(value: unknown): CustomerSearchContract {
  const record = asRecord(value)

  return {
    id: asString(record.id ?? record.contractId ?? record.contract_id),
    planName: asOptionalString(record.planName ?? record.plan_name ?? record.plan) ?? null,
    status: asOptionalString(record.status) ?? null,
    addressLine: asOptionalString(record.addressLine ?? record.address_line) ?? null,
    city: asOptionalString(record.city) ?? null,
    state: asOptionalString(record.state) ?? null,
  }
}

function normalizeCustomerSearchResult(value: unknown): CustomerSearchResult {
  const record = asRecord(value)
  const customer = asRecord(record.customer)
  const contracts = Array.isArray(record.contracts)
    ? record.contracts.map(normalizeCustomerSearchContract).filter((contract) => contract.id)
    : []

  return {
    customer: {
      id: asString(customer.id),
      name: asString(customer.name, 'Cliente'),
      maskedCpf: asString(customer.maskedCpf ?? customer.masked_cpf, '***.***.***-**'),
      phone: asOptionalString(customer.phone) ?? null,
    },
    contracts,
    activeConversation: record.activeConversation
      ? normalizeConversation(record.activeConversation)
      : null,
  }
}

function messageSortValue(message: Message): number {
  const numericId = Number(message.id)
  if (Number.isFinite(numericId)) return numericId

  const time = new Date(message.createdAt).getTime()
  return Number.isFinite(time) ? time : 0
}

function sortMessagesChronologically(messages: Message[]): Message[] {
  return [...messages].sort((left, right) => messageSortValue(left) - messageSortValue(right))
}

export const conversationsApi = {
  async searchCustomerByCpf(cpf: string): Promise<CustomerSearchResult> {
    if (appConfig.useMock) return mockServer.searchCustomerByCpf(cpf)

    const response = await apiRequest<unknown>('/api/agent/customers/search', {
      method: 'POST',
      body: { cpf },
    })
    return normalizeCustomerSearchResult(response)
  },

  async startCustomerChat(input: {
    cpf: string
    contractId?: string
    ticketId?: string
  }): Promise<StartCustomerChatResponse> {
    if (appConfig.useMock) return mockServer.startCustomerChat(input)

    const response = await apiRequest<unknown>('/api/agent/conversations/start', {
      method: 'POST',
      body: input,
    })
    const record = asRecord(response)

    return {
      conversation: normalizeConversation(record.conversation ?? response),
      created: Boolean(record.created),
    }
  },

  async list(params: ConversationListParams): Promise<PaginatedResponse<ConversationSummary>> {
    if (appConfig.useMock) return mockServer.listConversations(params)

    // Only the params below are proven against the real backend (already sent by
    // FinalizadosPage/AtendimentoPage before this file was touched). `page`,
    // `ticketNumber`, `document`, `phone` and `assignedAgentId` are NOT sent over
    // the wire here — the endpoint rejected them with "invalid payload" when tried.
    // They're applied as a client-side narrowing of whatever page the backend
    // returns instead, so the filters still do something useful without risking
    // the request itself.
    const response = await apiRequest<unknown>(
      `/api/agent/conversations${toQueryString([
        ['filter', params.filter],
        ['search', params.search],
        ['tag', params.tag === 'all' ? undefined : params.tag],
        ['sort', params.sort],
        ['limit', params.perPage],
        ['dateFrom', params.dateFrom],
        ['dateTo', params.dateTo],
      ])}`,
      { unwrap: false },
    )
    const page = normalizePage(response, normalizeConversation)
    return { ...page, data: applyClientSideFilters(page.data, params) }
  },

  async get(conversationId: string): Promise<ConversationDetail> {
    if (appConfig.useMock) return mockServer.getConversation(conversationId)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}`)
    return normalizeConversation(response)
  },

  async getMessages(
    conversationId: string,
    params: MessageListParams = {},
  ): Promise<PaginatedResponse<Message>> {
    if (appConfig.useMock) return mockServer.getMessages(conversationId, params)

    const response = await apiRequest<unknown>(
      `/api/agent/conversations/${conversationId}/messages${toQueryString([
        ['cursor', params.cursor],
        ['limit', params.perPage],
      ])}`,
      { unwrap: false },
    )
    const page = normalizePage(response, normalizeMessage)
    return {
      ...page,
      data: sortMessagesChronologically(page.data),
    }
  },

  async sendMessage(
    conversationId: string,
    body: string,
    clientMessageId: string,
  ): Promise<Message> {
    if (appConfig.useMock) return mockServer.sendAgentMessage(conversationId, body, clientMessageId)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: {
        message: body,
        clientMessageId,
      },
    })
    return normalizeMessage(response)
  },

  async assign(conversationId: string): Promise<ConversationDetail> {
    if (appConfig.useMock) return mockServer.assignConversation(conversationId)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/assign`, {
      method: 'POST',
    })
    return normalizeConversation(response)
  },

  async unassign(conversationId: string): Promise<ConversationDetail> {
    return apiRequest<ConversationDetail>(`/api/agent/conversations/${conversationId}/unassign`, {
      method: 'POST',
    })
  },

  async transfer(conversationId: string, agentId: string): Promise<ConversationDetail> {
    if (appConfig.useMock) return mockServer.transferConversation(conversationId, agentId)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/transfer`, {
      method: 'POST',
      body: { agentId },
    })
    return normalizeConversation(response)
  },

  async updateStatus(
    conversationId: string,
    status: ConversationStatus,
    options: UpdateStatusOptions = {},
  ): Promise<ConversationDetail> {
    if (appConfig.useMock) return mockServer.updateStatus(conversationId, status, options)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/status`, {
      method: 'PATCH',
      body: {
        status,
        closeReason: options.closeReason,
        closeReasonNote: options.closeReasonNote,
      },
    })
    return normalizeConversation(response)
  },

  async markRead(conversationId: string): Promise<void> {
    if (appConfig.useMock) return mockServer.markRead(conversationId)

    return apiRequest<void>(`/api/agent/conversations/${conversationId}/read`, {
      method: 'POST',
    })
  },

  async delete(conversationId: string): Promise<void> {
    if (appConfig.useMock) return mockServer.deleteConversation(conversationId)

    return apiRequest<void>(`/api/agent/conversations/${conversationId}`, {
      method: 'DELETE',
    })
  },

  async archive(conversationId: string): Promise<ConversationDetail> {
    if (appConfig.useMock) return mockServer.archiveConversation(conversationId)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/archive`, {
      method: 'POST',
    })
    return normalizeConversation(response)
  },

  async restore(conversationId: string): Promise<ConversationDetail> {
    if (appConfig.useMock) return mockServer.restoreConversation(conversationId)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/restore`, {
      method: 'POST',
    })
    return normalizeConversation(response)
  },

  async reopen(conversationId: string): Promise<ConversationDetail> {
    if (appConfig.useMock) return mockServer.reopenConversation(conversationId)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/reopen`, {
      method: 'POST',
    })
    return normalizeConversation(response)
  },

  async updateTags(conversationId: string, tags: ConversationTag[]): Promise<ConversationDetail> {
    if (appConfig.useMock) return mockServer.updateConversationTags(conversationId, tags)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/tags`, {
      method: 'PATCH',
      body: { tags },
    })
    return normalizeConversation(response)
  },

  async listNotes(conversationId: string): Promise<ConversationNote[]> {
    if (appConfig.useMock) return mockServer.listConversationNotes(conversationId)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/notes`, {
      unwrap: false,
    })
    const record = asRecord(response)
    const notes = Array.isArray(record.notes) ? record.notes : []
    return notes.map(normalizeConversationNote)
  },

  async addNote(conversationId: string, note: string): Promise<ConversationNote> {
    if (appConfig.useMock) return mockServer.addConversationNote(conversationId, note)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/notes`, {
      method: 'POST',
      body: { note },
    })
    return normalizeConversationNote(response)
  },

  /**
   * Pendência de backend: este endpoint ainda não existe na acessanet-chat-api.
   * A prioridade hoje é só calculada no frontend (ver utils/priority.ts). Esta
   * chamada permite que uma Macro registre uma sobrescrita manual quando o
   * backend implementar `PATCH /api/agent/conversations/:id/priority`.
   */
  async setPriority(
    conversationId: string,
    priority: ConversationSummary['priorityOverride'],
  ): Promise<ConversationDetail> {
    if (appConfig.useMock) return mockServer.setConversationPriority(conversationId, priority ?? null)

    const response = await apiRequest<unknown>(`/api/agent/conversations/${conversationId}/priority`, {
      method: 'PATCH',
      body: { priority },
    })
    return normalizeConversation(response)
  },
}

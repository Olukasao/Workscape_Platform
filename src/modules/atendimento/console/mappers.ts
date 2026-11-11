// Normalização das respostas da chat-api para o modelo da tela de atendimento (copiado do painel, sem as chamadas HTTP).
import type {
  ConversationDetail,
  ConversationCloseReason,
  ConversationNote,
  ConversationStatus,
  CustomerHistory,
  CustomerHistoryEntry,
  Message,
  TicketMetadata,
  TicketMetadataLine,
} from './types/domain'
import { normalizeConversationTags } from './utils/conversationTags'

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
      phone: ticketMetadata?.customer?.phone,
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
    contractId: contractId || undefined,
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


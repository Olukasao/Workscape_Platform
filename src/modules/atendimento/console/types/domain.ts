export type AgentRole = 'attendant' | 'agent' | 'supervisor' | 'admin'

export type AgentPresence = 'online' | 'away' | 'offline'

export type AttendanceStatus = 'AVAILABLE' | 'INVISIBLE'

export interface AgentUser {
  id: string
  name: string
  email: string
  role: AgentRole
  attendanceStatus: AttendanceStatus
  attendanceStatusChangedAt?: string
  presence?: AgentPresence
}

export interface AgentOption {
  id: string
  name: string
  email: string
  role: AgentRole
  attendanceStatus: AttendanceStatus
  attendanceStatusChangedAt?: string
  presence?: AgentPresence
  online?: boolean
  departmentName?: string
  avatarUrl?: string
  lastSeenAt?: string
}

export type ConversationStatus =
  | 'new'
  | 'open'
  | 'waiting_customer'
  | 'waiting_agent'
  | 'closed'

export type ConversationFilter =
  | 'new'
  | 'mine'
  | 'open'
  | 'waiting_customer'
  | 'closed'
  | 'archived'

export type ConversationCloseReason =
  | 'resolved'
  | 'no_customer_response'
  | 'sent_to_technician'
  | 'duplicate'
  | 'other'

export type ConversationTag =
  | 'no_connection'
  | 'billing'
  | 'slowness'
  | 'wifi'
  | 'visit'
  | 'cancellation'

export type ConversationTagFilter = ConversationTag | 'all'

export type ConversationQueueSort =
  | 'priority'
  | 'sla'
  | 'unread'
  | 'newest'
  | 'oldest'

export type ConversationPriority = 'high' | 'medium' | 'low'

export interface CustomerVisit {
  dateLabel?: string
  timeWindow?: string
  technicianName?: string
}

export interface TicketMetadataLine {
  label: string
  value: string
}

export interface TicketMetadata {
  customer?: {
    name?: string
    document?: string
    phone?: string
  }
  contract?: {
    id?: string
    planName?: string
    addressLine?: string
    city?: string
    state?: string
    status?: string
  }
  ticket?: {
    id?: string
    protocol?: string
    sgpTicketId?: string
    status?: string
    statusInterno?: string
    title?: string
    description?: string
    createdAt?: string
    updatedAt?: string
    appointment?: {
      date?: string
      windowStart?: string
      windowEnd?: string
      technicianName?: string
      addressLine?: string
      city?: string
      state?: string
    }
  }
  diagnosis?: {
    categoryId?: string
    categoryTitle?: string
    classification?: string
    customerMessage?: string
    structuredDescription?: string
    summary?: TicketMetadataLine[]
    answers?: TicketMetadataLine[]
  }
}

export interface CustomerInfo {
  name: string
  /** Ajuste do Workspace: telefone do cadastro do chamado. */
  phone?: string
  contractNumber?: string
  document?: string
  plan?: string
  ticketNumber?: string
  reason?: string
  sgpStatus?: string
  openedAt?: string
  visit?: CustomerVisit
}

export interface ConversationSummary {
  id: string
  /** Ajuste do Workspace: contrato do cliente (a ficha 360 e o telefone usam). */
  contractId?: string
  status: ConversationStatus
  customerName: string
  customer?: CustomerInfo
  subject?: string
  ticketNumber?: string
  assignedAgentId?: string | null
  assignedAgentName?: string | null
  ticketMetadata?: TicketMetadata | null
  tags?: ConversationTag[]
  /**
   * Sobrescrita manual de prioridade (ex.: definida por uma Macro). Quando ausente,
   * a prioridade continua sendo calculada por getConversationPriority().
   * Pendência de backend: PATCH /api/agent/conversations/:id/priority.
   */
  priorityOverride?: ConversationPriority | null
  unreadCount: number
  lastMessage?: string
  lastMessageAt?: string
  lastCustomerMessageAt?: string
  waitingSince?: string
  closedAt?: string
  closeReason?: ConversationCloseReason | null
  closeReasonNote?: string
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerHistoryEntry {
  id: string
  ticketId?: string
  status: ConversationStatus
  createdAt: string
  closedAt?: string | null
  closeReason?: ConversationCloseReason | null
}

export interface CustomerHistory {
  recentCount: number
  recentConversations: CustomerHistoryEntry[]
}

export interface ConversationDetail extends ConversationSummary {
  customer: CustomerInfo
  customerHistory?: CustomerHistory
}

export interface ConversationNote {
  id: string
  conversationId: string
  agentId?: string | null
  agentName: string
  note: string
  createdAt: string
}

export interface QuickReply {
  id: string
  shortcut: string
  title: string
  body: string
  category?: string | null
  active: boolean
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerSearchContract {
  id: string
  planName?: string | null
  status?: string | null
  addressLine?: string | null
  city?: string | null
  state?: string | null
}

export interface CustomerSearchResult {
  customer: {
    id: string
    name: string
    maskedCpf: string
    phone?: string | null
  }
  contracts: CustomerSearchContract[]
  activeConversation: ConversationDetail | null
}

export interface StartCustomerChatResponse {
  conversation: ConversationDetail
  created: boolean
}

export type MessageAuthorType = 'customer' | 'agent' | 'system'

export type MessageDeliveryStatus = 'sending' | 'sent' | 'failed'

export interface Message {
  id: string
  conversationId: string
  clientMessageId?: string
  senderId?: string | null
  authorType: MessageAuthorType
  authorName: string
  body: string
  createdAt: string
  status?: MessageDeliveryStatus
}

export interface PaginationInfo {
  page?: number
  perPage?: number
  hasMore: boolean
  nextCursor?: string | null
  total?: number
}

export interface ConversationCounts {
  new: number
  mine: number
  open: number
  waiting_customer: number
  closed: number
  archived: number
  today?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationInfo
  counts?: ConversationCounts
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthLoginResponse {
  user?: AgentUser
  agent?: AgentUser
  accessToken?: string
  access_token?: string
}

export interface TypingPayload {
  conversationId: string
  customerName: string
  isTyping: boolean
}

export interface MessageReadPayload {
  conversationId: string
  agentId?: string
}

export interface UserStatusChangedPayload {
  userId: string
  status: AttendanceStatus
  changedBy?: string
  changedAt?: string
}

// Auditoria de tickets

export interface AuditLogEntry {
  id: string
  agentId?: string | null
  agentName?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
}

// Monitoramento

export interface MonitoringOverview {
  activeNow: number
  waitingForAgent: number
  waitingForCustomer: number
  closedToday: number
  longestWaitSeconds: number | null
  avgWaitSeconds: number | null
  avgHandleSeconds: number | null
  agentsOnline: number
  agentsInvisible: number
  agentsOffline: number
  agentsTotal: number
}

export interface MonitoringQueue {
  tag: ConversationTag | 'sem_categoria'
  waiting: number
  inProgress: number
  agentsOnline: number
  longestWaitSeconds: number | null
}

export interface MonitoringAgent {
  id: string
  name: string
  role: AgentRole
  attendanceStatus: AttendanceStatus
  statusSinceSeconds: number | null
  activeConversations: number
  oldestActiveSeconds: number | null
}

// Vendas

export type SaleStatus = 'pending' | 'confirmed' | 'cancelled'

export interface Sale {
  id: string
  customerId?: string | null
  contractId?: string | null
  conversationId?: string | null
  agentId: string
  productType: string
  planName?: string | null
  value: number
  origin?: string | null
  status: SaleStatus
  note?: string | null
  createdAt: string
  updatedAt: string
}

export interface SaleSummary {
  countToday: number
  countPeriod: number
  valuePeriod: number
  averageTicket: number
  byAgent: Array<{ agentId: string; count: number; value: number }>
  byProduct: Array<{ productType: string; count: number; value: number }>
}

// Disparos

export type CampaignChannel = 'whatsapp' | 'sms' | 'email' | 'chat'

export type CampaignStatus = 'draft' | 'scheduled' | 'processing' | 'completed' | 'cancelled' | 'error'

export interface CampaignAudienceFilter {
  tags?: ConversationTag[]
  status?: ConversationStatus
}

export interface Campaign {
  id: string
  name: string
  channel: CampaignChannel
  audienceFilter: CampaignAudienceFilter | null
  messageBody: string
  scheduledAt?: string | null
  status: CampaignStatus
  createdBy: string
  recipientsCount: number
  sentCount: number
  deliveredCount: number
  failedCount: number
  statusMessage?: string | null
  createdAt: string
  updatedAt: string
}

export interface AudienceEstimate {
  count: number
  sample: Array<{ customerId: string; customerName?: string | null }>
}

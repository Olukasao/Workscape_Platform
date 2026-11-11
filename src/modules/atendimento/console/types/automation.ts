import type { ConversationCloseReason, ConversationPriority, ConversationStatus, ConversationTag } from './domain'

export type AutomationTrigger =
  | { type: 'TICKET_CREATED' }
  | { type: 'MESSAGE_RECEIVED' }
  | { type: 'MESSAGE_SENT' }
  | { type: 'TICKET_ASSIGNED' }
  | { type: 'TICKET_TRANSFERRED' }
  | { type: 'TICKET_CLOSED' }
  | { type: 'TAG_ADDED'; tag?: ConversationTag }
  | { type: 'PRIORITY_CHANGED' }
  | { type: 'CUSTOMER_INACTIVE'; minutes: number }
  | { type: 'AGENT_INACTIVE'; minutes: number }
  | { type: 'SLA_WARNING'; thresholdPercent: number }
  | { type: 'SLA_BREACHED' }

export type AutomationTriggerType = AutomationTrigger['type']

/**
 * Reservado para quando o backend expuser os eventos correspondentes.
 * Não implementado ainda.
 */
export type ReservedAutomationTriggerType =
  | 'CUSTOMER_ONLINE'
  | 'CUSTOMER_OFFLINE'
  | 'REGIONAL_INCIDENT_STARTED'
  | 'REGIONAL_INCIDENT_RESOLVED'
  | 'PAYMENT_CONFIRMED'
  | 'INVOICE_OVERDUE'
  | 'SALE_CREATED'
  | 'CAMPAIGN_REPLY'

export type AutomationConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'IN'
  | 'NOT_IN'

export interface AutomationCondition {
  id: string
  /** Caminho declarativo no contexto do evento, ex.: "message.text", "conversation.priority". */
  field: string
  operator: AutomationConditionOperator
  value?: unknown
}

export type AutomationConditionGroupOperator = 'AND' | 'OR'

/**
 * Grupos são combinados entre si por AND; dentro de um grupo, as condições são
 * combinadas por `operator` (AND ou OR). Aninhamento de grupos fica reservado
 * para uma versão futura — não é necessário na primeira entrega.
 */
export interface AutomationConditionGroup {
  id: string
  operator: AutomationConditionGroupOperator
  conditions: AutomationCondition[]
}

export type AutomationActionType =
  | 'SEND_MESSAGE'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'SET_PRIORITY'
  | 'TRANSFER_QUEUE'
  | 'ASSIGN_AGENT'
  | 'ADD_INTERNAL_NOTE'
  | 'CLOSE_TICKET'
  | 'ARCHIVE_TICKET'
  | 'WAIT'
  | 'RUN_MACRO'
  | 'API_OPERATION'
  | 'CONDITION'

/**
 * Reservado para quando o backend expuser as operações correspondentes.
 * Não implementado ainda.
 */
export type ReservedAutomationActionType =
  | 'CREATE_TECHNICAL_TICKET'
  | 'SEND_NOTIFICATION'
  | 'SEND_EMAIL'
  | 'GENERATE_INVOICE'
  | 'SEND_INVOICE'
  | 'GENERATE_PIX'
  | 'RUN_DIAGNOSTIC'
  | 'SET_CATEGORY'
  | 'START_BOT_FLOW'

interface AutomationActionBase {
  id: string
}

export interface AutomationSendMessageAction extends AutomationActionBase {
  type: 'SEND_MESSAGE'
  text: string
}

export interface AutomationAddTagAction extends AutomationActionBase {
  type: 'ADD_TAG'
  tag: ConversationTag
}

export interface AutomationRemoveTagAction extends AutomationActionBase {
  type: 'REMOVE_TAG'
  tag: ConversationTag
}

export interface AutomationSetPriorityAction extends AutomationActionBase {
  type: 'SET_PRIORITY'
  priority: ConversationPriority
}

export interface AutomationTransferQueueAction extends AutomationActionBase {
  type: 'TRANSFER_QUEUE'
  queueId: string
}

export interface AutomationAssignAgentAction extends AutomationActionBase {
  type: 'ASSIGN_AGENT'
  agentId: string
}

export interface AutomationAddInternalNoteAction extends AutomationActionBase {
  type: 'ADD_INTERNAL_NOTE'
  text: string
}

export interface AutomationCloseTicketAction extends AutomationActionBase {
  type: 'CLOSE_TICKET'
  closeReason?: ConversationCloseReason
  note?: string
}

export interface AutomationArchiveTicketAction extends AutomationActionBase {
  type: 'ARCHIVE_TICKET'
}

export interface AutomationWaitAction extends AutomationActionBase {
  type: 'WAIT'
  ms: number
}

export interface AutomationRunMacroAction extends AutomationActionBase {
  type: 'RUN_MACRO'
  macroId: string
}

export interface AutomationApiOperationAction extends AutomationActionBase {
  type: 'API_OPERATION'
  /** Operação pré-autorizada no backend. Nunca uma URL arbitrária. */
  operation: string
  /** Chave de resultado disponível depois em context.results[resultKey]. */
  resultKey: string
  params?: Record<string, unknown>
}

/**
 * Ramificação dentro da sequência de ações (ex.: depois de consultar um
 * incidente regional, enviar uma mensagem diferente conforme o resultado).
 * Distinto dos `conditionGroups` da automação, que decidem se ela roda ou não.
 */
export interface AutomationConditionAction extends AutomationActionBase {
  type: 'CONDITION'
  condition: AutomationCondition
  then: AutomationAction[]
  else?: AutomationAction[]
}

export type AutomationAction =
  | AutomationSendMessageAction
  | AutomationAddTagAction
  | AutomationRemoveTagAction
  | AutomationSetPriorityAction
  | AutomationTransferQueueAction
  | AutomationAssignAgentAction
  | AutomationAddInternalNoteAction
  | AutomationCloseTicketAction
  | AutomationArchiveTicketAction
  | AutomationWaitAction
  | AutomationRunMacroAction
  | AutomationApiOperationAction
  | AutomationConditionAction

export type AutomationStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED'

export interface AutomationMetrics {
  executionsToday: number
  failuresToday: number
  successRatePercent: number | null
  lastExecutionAt?: string | null
}

export interface Automation {
  id: string
  name: string
  description?: string
  status: AutomationStatus
  /** Automações elegíveis para o mesmo evento rodam em ordem crescente de priority. */
  priority: number
  /** Se true, nenhuma automação de priority maior roda depois desta para o mesmo evento. */
  stopProcessing: boolean
  trigger: AutomationTrigger
  conditionGroups: AutomationConditionGroup[]
  actions: AutomationAction[]
  metrics?: AutomationMetrics
  createdAt: string
  updatedAt: string
  createdBy?: string
}

export interface AutomationInput {
  name: string
  description?: string
  status?: AutomationStatus
  priority?: number
  stopProcessing?: boolean
  trigger: AutomationTrigger
  conditionGroups: AutomationConditionGroup[]
  actions: AutomationAction[]
}

export type AutomationExecutionStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
export type AutomationExecutionStepType = 'TRIGGER' | 'CONDITION' | 'ACTION'
export type AutomationExecutionStepStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'

export interface AutomationExecutionStep {
  id: string
  type: AutomationExecutionStepType
  label: string
  status: AutomationExecutionStepStatus
  startedAt?: string
  finishedAt?: string
  error?: string
}

export interface AutomationExecution {
  id: string
  automationId: string
  automationName: string
  ticketId?: string
  conversationId?: string
  eventId: string
  status: AutomationExecutionStatus
  startedAt: string
  finishedAt?: string
  steps: AutomationExecutionStep[]
}

/** Dados de exemplo digitados pelo admin para a pré-visualização local (nunca altera um ticket real). */
export interface AutomationPreviewInput {
  message?: string
  tags?: ConversationTag[]
  priority?: ConversationPriority
  status?: ConversationStatus
  customerName?: string
  waitingMinutes?: number
}

export type AutomationPreviewStepStatus = 'WOULD_RUN' | 'SKIPPED' | 'NOT_APPLICABLE'

export interface AutomationPreviewStep {
  id: string
  type: AutomationExecutionStepType
  label: string
  status: AutomationPreviewStepStatus
  detail?: string
}

export interface AutomationPreviewResult {
  triggerMatched: boolean
  conditionsMatched: boolean
  steps: AutomationPreviewStep[]
}

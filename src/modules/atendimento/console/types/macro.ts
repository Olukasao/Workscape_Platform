import type { ConversationPriority, ConversationTag } from './domain'

export type MacroActionType =
  | 'SEND_MESSAGE'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'SET_PRIORITY'
  | 'ADD_INTERNAL_NOTE'
  | 'TRANSFER_QUEUE'
  | 'WAIT'
  | 'API_REQUEST'
  | 'CONDITION'

/**
 * Reservado para quando o backend expuser as operações correspondentes.
 * Não implementado ainda: ASSIGN_AGENT, CLOSE_TICKET, ARCHIVE_TICKET,
 * SET_CATEGORY, SET_STATUS, SEND_ATTACHMENT, RUN_DIAGNOSTIC, CREATE_TECHNICAL_TICKET.
 */
export type ReservedMacroActionType =
  | 'ASSIGN_AGENT'
  | 'CLOSE_TICKET'
  | 'ARCHIVE_TICKET'
  | 'SET_CATEGORY'
  | 'SET_STATUS'
  | 'SEND_ATTACHMENT'
  | 'RUN_DIAGNOSTIC'
  | 'CREATE_TECHNICAL_TICKET'

export type MacroConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'EXISTS'
  | 'NOT_EXISTS'
  | 'CONTAINS'
  | 'GREATER_THAN'
  | 'LESS_THAN'

export interface MacroCondition {
  variable: string
  operator: MacroConditionOperator
  value?: unknown
}

export type MacroActionErrorStrategy = 'STOP' | 'CONTINUE'

export interface MacroActionConfirm {
  title: string
  description?: string
  confirmLabel?: string
  skipLabel?: string
}

interface MacroActionBase {
  id: string
  onError?: MacroActionErrorStrategy
  /**
   * Quando presente, a execução pausa e pede confirmação manual do atendente
   * antes de rodar esta ação (ex.: "Transferir para N2?"). Usado em vez de
   * criar um tipo de ação dedicado para decisões interativas.
   */
  confirm?: MacroActionConfirm
}

export interface SendMessageAction extends MacroActionBase {
  type: 'SEND_MESSAGE'
  text: string
}

export interface AddTagAction extends MacroActionBase {
  type: 'ADD_TAG'
  tag: ConversationTag
}

export interface RemoveTagAction extends MacroActionBase {
  type: 'REMOVE_TAG'
  tag: ConversationTag
}

export interface SetPriorityAction extends MacroActionBase {
  type: 'SET_PRIORITY'
  priority: ConversationPriority
}

export interface AddInternalNoteAction extends MacroActionBase {
  type: 'ADD_INTERNAL_NOTE'
  text: string
}

export interface TransferQueueAction extends MacroActionBase {
  type: 'TRANSFER_QUEUE'
  queue: string
}

export interface WaitAction extends MacroActionBase {
  type: 'WAIT'
  ms: number
}

export interface ApiRequestAction extends MacroActionBase {
  type: 'API_REQUEST'
  /** Chave de resultado disponível depois em context.results[key]. */
  key: string
  /** Operação pré-autorizada no backend. Nunca uma URL arbitrária. */
  operation: string
  params?: Record<string, unknown>
}

export interface ConditionAction extends MacroActionBase {
  type: 'CONDITION'
  condition: MacroCondition
  then: MacroAction[]
  else?: MacroAction[]
}

export type MacroAction =
  | SendMessageAction
  | AddTagAction
  | RemoveTagAction
  | SetPriorityAction
  | AddInternalNoteAction
  | TransferQueueAction
  | WaitAction
  | ApiRequestAction
  | ConditionAction

export interface Macro {
  id: string
  name: string
  description?: string
  shortcut: string
  category?: string
  enabled: boolean
  actions: MacroAction[]
  createdAt?: string
  updatedAt?: string
}

export interface MacroInput {
  name: string
  description?: string
  shortcut: string
  category?: string
  enabled?: boolean
  actions: MacroAction[]
}

export interface MacroQueueOption {
  id: string
  label: string
  agentId: string
}

export interface MacroExecutionContext {
  executionId: string
  conversationId: string
  ticketId?: string
  customer?: unknown
  variables: Record<string, unknown>
  results: Record<string, unknown>
}

export type MacroStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'awaiting_confirmation'

export interface MacroExecutionStep {
  /** Caminho da ação dentro da árvore (ex.: "3" ou "6.then.0") — identifica o passo de forma estável. */
  path: string
  action: MacroAction
  status: MacroStepStatus
  error?: string
  startedAt?: string
  finishedAt?: string
}

export type MacroExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface MacroExecutionState {
  executionId: string | null
  macro: Macro | null
  status: MacroExecutionStatus
  steps: MacroExecutionStep[]
  context: MacroExecutionContext | null
}

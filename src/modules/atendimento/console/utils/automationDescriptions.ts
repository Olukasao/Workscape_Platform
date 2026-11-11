import type {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationConditionGroup,
  AutomationConditionOperator,
  AutomationTrigger,
  AutomationTriggerType,
} from '../types/automation'
import { getConversationTagLabel } from './conversationTags'
import { getConversationPriorityLabel } from './priority'
import { createClientMessageId } from './uuid'

export const actionTypeLabels: Record<AutomationActionType, string> = {
  SEND_MESSAGE: 'Enviar mensagem',
  ADD_TAG: 'Adicionar categoria',
  REMOVE_TAG: 'Remover categoria',
  SET_PRIORITY: 'Definir prioridade',
  TRANSFER_QUEUE: 'Transferir para fila',
  ASSIGN_AGENT: 'Atribuir a um atendente',
  ADD_INTERNAL_NOTE: 'Criar nota interna',
  CLOSE_TICKET: 'Encerrar atendimento',
  ARCHIVE_TICKET: 'Arquivar atendimento',
  WAIT: 'Aguardar',
  RUN_MACRO: 'Executar macro',
  API_OPERATION: 'Consultar operação',
  CONDITION: 'Condição',
}

export function createDefaultAutomationAction(type: AutomationActionType): AutomationAction {
  const id = createClientMessageId()

  switch (type) {
    case 'SEND_MESSAGE':
      return { id, type, text: '' }
    case 'ADD_TAG':
      return { id, type, tag: 'no_connection' }
    case 'REMOVE_TAG':
      return { id, type, tag: 'no_connection' }
    case 'SET_PRIORITY':
      return { id, type, priority: 'medium' }
    case 'TRANSFER_QUEUE':
      return { id, type, queueId: '' }
    case 'ASSIGN_AGENT':
      return { id, type, agentId: '' }
    case 'ADD_INTERNAL_NOTE':
      return { id, type, text: '' }
    case 'CLOSE_TICKET':
      return { id, type }
    case 'ARCHIVE_TICKET':
      return { id, type }
    case 'WAIT':
      return { id, type, ms: 60_000 }
    case 'RUN_MACRO':
      return { id, type, macroId: '' }
    case 'API_OPERATION':
      return { id, type, operation: '', resultKey: '' }
    case 'CONDITION':
      return {
        id,
        type,
        condition: { id: createClientMessageId(), field: '', operator: 'EQUALS', value: '' },
        then: [],
        else: [],
      }
  }
}

export const triggerTypeLabels: Record<AutomationTriggerType, string> = {
  TICKET_CREATED: 'Ticket criado',
  MESSAGE_RECEIVED: 'Nova mensagem recebida',
  MESSAGE_SENT: 'Mensagem enviada pelo atendente',
  TICKET_ASSIGNED: 'Ticket atribuído',
  TICKET_TRANSFERRED: 'Ticket transferido',
  TICKET_CLOSED: 'Ticket encerrado',
  TAG_ADDED: 'Categoria adicionada',
  PRIORITY_CHANGED: 'Prioridade alterada',
  CUSTOMER_INACTIVE: 'Cliente ficou inativo',
  AGENT_INACTIVE: 'Atendente ficou inativo',
  SLA_WARNING: 'SLA próximo do limite',
  SLA_BREACHED: 'SLA estourado',
}

export function describeTrigger(trigger: AutomationTrigger): string {
  const base = triggerTypeLabels[trigger.type]

  if (trigger.type === 'CUSTOMER_INACTIVE' || trigger.type === 'AGENT_INACTIVE') {
    return `${base} por ${trigger.minutes} min`
  }
  if (trigger.type === 'SLA_WARNING') {
    return `${base} (${trigger.thresholdPercent}%)`
  }
  if (trigger.type === 'TAG_ADDED' && trigger.tag) {
    return `${base}: ${getConversationTagLabel(trigger.tag)}`
  }

  return base
}

export const conditionOperatorLabels: Record<AutomationConditionOperator, string> = {
  EQUALS: 'é igual a',
  NOT_EQUALS: 'é diferente de',
  CONTAINS: 'contém',
  NOT_CONTAINS: 'não contém',
  STARTS_WITH: 'começa com',
  ENDS_WITH: 'termina com',
  EXISTS: 'existe',
  NOT_EXISTS: 'não existe',
  GREATER_THAN: 'é maior que',
  GREATER_THAN_OR_EQUAL: 'é maior ou igual a',
  LESS_THAN: 'é menor que',
  LESS_THAN_OR_EQUAL: 'é menor ou igual a',
  IN: 'está em',
  NOT_IN: 'não está em',
}

function formatConditionValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  return String(value ?? '')
}

export function describeCondition(condition: AutomationCondition): string {
  const operatorLabel = conditionOperatorLabels[condition.operator]

  if (condition.operator === 'EXISTS' || condition.operator === 'NOT_EXISTS') {
    return `${condition.field} ${operatorLabel}`
  }

  return `${condition.field} ${operatorLabel} "${formatConditionValue(condition.value)}"`
}

export function describeConditionGroup(group: AutomationConditionGroup): string {
  if (group.conditions.length === 0) return 'Sem condições (sempre verdadeiro)'

  return group.conditions.map(describeCondition).join(group.operator === 'OR' ? '  OU  ' : '  E  ')
}

export function describeAutomationAction(action: AutomationAction): string {
  switch (action.type) {
    case 'SEND_MESSAGE':
      return 'Enviar mensagem ao cliente'
    case 'ADD_TAG':
      return `Adicionar categoria ${getConversationTagLabel(action.tag)}`
    case 'REMOVE_TAG':
      return `Remover categoria ${getConversationTagLabel(action.tag)}`
    case 'SET_PRIORITY':
      return `Definir prioridade ${getConversationPriorityLabel(action.priority)}`
    case 'TRANSFER_QUEUE':
      return `Transferir para fila ${action.queueId || '(não definida)'}`
    case 'ASSIGN_AGENT':
      return 'Atribuir a um atendente específico'
    case 'ADD_INTERNAL_NOTE':
      return 'Criar nota interna'
    case 'CLOSE_TICKET':
      return 'Encerrar atendimento'
    case 'ARCHIVE_TICKET':
      return 'Arquivar atendimento'
    case 'WAIT':
      return `Aguardar ${Math.round(action.ms / 60000)} min`
    case 'RUN_MACRO':
      return 'Executar macro'
    case 'API_OPERATION':
      return `Consultar ${action.operation || '(operação não definida)'}`
    case 'CONDITION':
      return `Verificar condição (${action.condition.field || '—'})`
    default:
      return 'Ação'
  }
}

export function countAutomationActions(actions: AutomationAction[]): number {
  return actions.reduce((total, action) => {
    if (action.type === 'CONDITION') {
      return total + 1 + countAutomationActions(action.then) + countAutomationActions(action.else ?? [])
    }
    return total + 1
  }, 0)
}

/** Lista plana de descrições, incluindo os ramos de CONDITION — usada no preview de teste. */
export function describeAutomationActions(actions: AutomationAction[], depth = 0): string[] {
  return actions.flatMap((action) => {
    const prefix = depth > 0 ? `${'  '.repeat(depth)}↳ ` : ''
    const line = `${prefix}${describeAutomationAction(action)}`

    if (action.type === 'CONDITION') {
      const thenLines = describeAutomationActions(action.then, depth + 1).map((text) => `${text} [se verdadeiro]`)
      const elseLines = describeAutomationActions(action.else ?? [], depth + 1).map((text) => `${text} [se falso]`)
      return [line, ...thenLines, ...elseLines]
    }

    return [line]
  })
}

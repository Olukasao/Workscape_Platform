import type { Macro, MacroAction, MacroActionType } from '../types/macro'
import { getConversationTagLabel, normalizeLabel } from './conversationTags'
import { getConversationPriorityLabel } from './priority'
import { createClientMessageId } from './uuid'

export function createDefaultAction(type: MacroActionType): MacroAction {
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
    case 'ADD_INTERNAL_NOTE':
      return { id, type, text: '' }
    case 'TRANSFER_QUEUE':
      return { id, type, queue: '' }
    case 'WAIT':
      return { id, type, ms: 1000 }
    case 'API_REQUEST':
      return { id, type, key: '', operation: '' }
    case 'CONDITION':
      return { id, type, condition: { variable: '', operator: 'EQUALS', value: '' }, then: [], else: [] }
  }
}

/** Extrai o token de atalho ("/sem") de um valor digitado no composer, se houver. */
export function parseMacroTrigger(inputValue: string): string | null {
  const trimmed = inputValue.trim()
  if (!trimmed.startsWith('/')) return null
  return trimmed.toLowerCase()
}

export function searchMacros(
  macros: Macro[],
  query: string,
  options: { includeDisabled?: boolean } = {},
): Macro[] {
  const normalizedQuery = normalizeLabel(query.replace(/^\//, ''))
  const candidates = options.includeDisabled ? macros : macros.filter((macro) => macro.enabled)

  if (!normalizedQuery) return candidates

  return candidates.filter((macro) => {
    const haystack = [macro.shortcut.replace(/^\//, ''), macro.name, macro.description ?? '', macro.category ?? '']
      .map(normalizeLabel)
      .join(' ')

    return haystack.includes(normalizedQuery)
  })
}

export function groupMacrosByCategory(macros: Macro[]): Array<{ category: string; macros: Macro[] }> {
  const groups = new Map<string, Macro[]>()

  for (const macro of macros) {
    const category = macro.category?.trim() || 'Geral'
    const bucket = groups.get(category) ?? []
    bucket.push(macro)
    groups.set(category, bucket)
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
    .map(([category, categoryMacros]) => ({ category, macros: categoryMacros }))
}

export function countMacroActions(actions: MacroAction[]): number {
  return actions.reduce((total, action) => {
    if (action.type === 'CONDITION') {
      return total + 1 + countMacroActions(action.then) + countMacroActions(action.else ?? [])
    }
    return total + 1
  }, 0)
}

function describeSingleAction(action: MacroAction): string {
  switch (action.type) {
    case 'SEND_MESSAGE':
      return `Enviar mensagem ao cliente`
    case 'ADD_TAG':
      return `Adicionar categoria ${getConversationTagLabel(action.tag)}`
    case 'REMOVE_TAG':
      return `Remover categoria ${getConversationTagLabel(action.tag)}`
    case 'SET_PRIORITY':
      return `Definir prioridade ${getConversationPriorityLabel(action.priority)}`
    case 'ADD_INTERNAL_NOTE':
      return `Criar nota interna`
    case 'TRANSFER_QUEUE':
      return `Transferir para ${action.queue}`
    case 'WAIT':
      return `Aguardar ${(action.ms / 1000).toFixed(1)}s`
    case 'API_REQUEST':
      return `Consultar ${action.operation}`
    case 'CONDITION':
      return `Verificar condição (${action.condition.variable})`
    default:
      return 'Ação'
  }
}

/** Descrição humana de uma ação, usada no modal de confirmação e no editor. */
export function describeMacroAction(action: MacroAction): string {
  const base = describeSingleAction(action)
  return action.confirm ? `${base} (confirmação manual)` : base
}

/** Lista plana de descrições, incluindo os ramos de CONDITION, para o resumo da confirmação. */
export function describeMacroActions(actions: MacroAction[], depth = 0): string[] {
  return actions.flatMap((action) => {
    const prefix = depth > 0 ? `${'  '.repeat(depth)}↳ ` : ''
    const line = `${prefix}${describeMacroAction(action)}`

    if (action.type === 'CONDITION') {
      const thenLines = describeMacroActions(action.then, depth + 1).map((text) => `${text} [se verdadeiro]`)
      const elseLines = describeMacroActions(action.else ?? [], depth + 1).map((text) => `${text} [se falso]`)
      return [line, ...thenLines, ...elseLines]
    }

    return [line]
  })
}

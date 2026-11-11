import type { Automation, AutomationAction } from '../types/automation'

export interface AutomationValidationContext {
  queueIds: string[]
  macroIds: string[]
}

type ValidatableAutomation = Pick<Automation, 'trigger' | 'actions' | 'conditionGroups'>

function validateActions(actions: AutomationAction[], context: AutomationValidationContext, pathLabel: string): string[] {
  const errors: string[] = []

  actions.forEach((action, index) => {
    const position = `${pathLabel}${index + 1}`

    if (action.type === 'TRANSFER_QUEUE' && !context.queueIds.includes(action.queueId)) {
      errors.push(`Ação ${position}: fila "${action.queueId || '—'}" não encontrada.`)
    }

    if (action.type === 'RUN_MACRO' && !context.macroIds.includes(action.macroId)) {
      errors.push(`Ação ${position}: macro selecionada não foi encontrada.`)
    }

    if ((action.type === 'SEND_MESSAGE' || action.type === 'ADD_INTERNAL_NOTE') && !action.text.trim()) {
      errors.push(`Ação ${position}: informe o texto.`)
    }

    if (action.type === 'API_OPERATION' && (!action.operation.trim() || !action.resultKey.trim())) {
      errors.push(`Ação ${position}: informe a operação e a chave de resultado.`)
    }

    if (action.type === 'ASSIGN_AGENT' && !action.agentId.trim()) {
      errors.push(`Ação ${position}: selecione um atendente.`)
    }

    if (action.type === 'CONDITION') {
      if (!action.condition.field.trim()) {
        errors.push(`Ação ${position}: condição sem campo selecionado.`)
      }
      errors.push(...validateActions(action.then, context, `${position}.then.`))
      errors.push(...validateActions(action.else ?? [], context, `${position}.else.`))
    }
  })

  return errors
}

/** Usado para bloquear "Salvar e ativar" até a automação estar consistente. */
export function validateAutomation(
  automation: ValidatableAutomation,
  context: AutomationValidationContext,
): string[] {
  const errors: string[] = []

  if (!automation.trigger) {
    errors.push('Selecione um evento (QUANDO).')
  }

  if (automation.actions.length === 0) {
    errors.push('Adicione ao menos uma ação (ENTÃO).')
  }

  automation.conditionGroups.forEach((group, groupIndex) => {
    group.conditions.forEach((condition, conditionIndex) => {
      if (!condition.field.trim()) {
        errors.push(`Condição ${groupIndex + 1}.${conditionIndex + 1}: selecione um campo.`)
      }

      const needsValue = condition.operator !== 'EXISTS' && condition.operator !== 'NOT_EXISTS'
      if (needsValue && (condition.value === undefined || condition.value === '')) {
        errors.push(`Condição ${groupIndex + 1}.${conditionIndex + 1}: informe um valor.`)
      }
    })
  })

  errors.push(...validateActions(automation.actions, context, ''))

  return errors
}

function someAction(actions: AutomationAction[], predicate: (action: AutomationAction) => boolean): boolean {
  return actions.some(
    (action) =>
      predicate(action) ||
      (action.type === 'CONDITION' &&
        (someAction(action.then, predicate) || someAction(action.else ?? [], predicate))),
  )
}

export function automationSendsMessages(automation: ValidatableAutomation): boolean {
  return someAction(automation.actions, (action) => action.type === 'SEND_MESSAGE')
}

export function automationClosesTickets(automation: ValidatableAutomation): boolean {
  return someAction(automation.actions, (action) => action.type === 'CLOSE_TICKET')
}

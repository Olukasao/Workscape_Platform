import type {
  Automation,
  AutomationAction,
  AutomationPreviewInput,
  AutomationPreviewResult,
  AutomationPreviewStep,
  AutomationTrigger,
} from '../types/automation'
import { evaluateAllGroups, evaluateCondition } from './automationConditions'
import { describeAutomationAction, describeCondition, describeTrigger } from './automationDescriptions'
import { getReadableError } from './errors'

function buildScope(input: AutomationPreviewInput): Record<string, unknown> {
  return {
    message: { text: input.message ?? '' },
    conversation: {
      tags: input.tags ?? [],
      priority: input.priority,
      status: input.status,
      waitingMinutes: input.waitingMinutes ?? 0,
    },
    customer: { name: input.customerName },
  }
}

/**
 * Heurística local: só decide se os dados de exemplo digitados fazem sentido
 * para o tipo de evento escolhido. O trigger "de verdade" só existe quando o
 * backend implementar o motor (ver README, Pendências de backend).
 */
function matchesTrigger(trigger: AutomationTrigger, input: AutomationPreviewInput): boolean {
  if (trigger.type === 'MESSAGE_RECEIVED' || trigger.type === 'MESSAGE_SENT') {
    return Boolean(input.message?.trim())
  }

  if (trigger.type === 'CUSTOMER_INACTIVE' || trigger.type === 'AGENT_INACTIVE') {
    return (input.waitingMinutes ?? 0) >= trigger.minutes
  }

  return true
}

export type AutomationOperationRunner = (operation: string, params: Record<string, unknown>) => Promise<unknown>

async function runActionsPreview(
  actions: AutomationAction[],
  scope: Record<string, unknown>,
  steps: AutomationPreviewStep[],
  active: boolean,
  runOperation: AutomationOperationRunner,
): Promise<void> {
  for (const action of actions) {
    if (action.type === 'CONDITION') {
      const matched = active && evaluateCondition(action.condition, scope)

      steps.push({
        id: action.id,
        type: 'CONDITION',
        label: describeAutomationAction(action),
        status: active ? (matched ? 'WOULD_RUN' : 'SKIPPED') : 'NOT_APPLICABLE',
        detail: active ? (matched ? 'condição verdadeira' : 'condição falsa') : undefined,
      })

      await runActionsPreview(matched ? action.then : (action.else ?? []), scope, steps, matched, runOperation)
      continue
    }

    if (!active) {
      steps.push({ id: action.id, type: 'ACTION', label: describeAutomationAction(action), status: 'NOT_APPLICABLE' })
      continue
    }

    if (action.type === 'API_OPERATION') {
      try {
        const result = await runOperation(action.operation, action.params ?? {})
        scope[action.resultKey] = result
        steps.push({
          id: action.id,
          type: 'ACTION',
          label: describeAutomationAction(action),
          status: 'WOULD_RUN',
          detail: JSON.stringify(result),
        })
      } catch (error) {
        steps.push({
          id: action.id,
          type: 'ACTION',
          label: describeAutomationAction(action),
          status: 'SKIPPED',
          detail: getReadableError(error, 'Operação indisponível (endpoint pendente no backend).'),
        })
      }
      continue
    }

    if (action.type === 'RUN_MACRO') {
      steps.push({
        id: action.id,
        type: 'ACTION',
        label: describeAutomationAction(action),
        status: 'WOULD_RUN',
        detail: 'A execução real da macro acontece no backend quando a automação estiver ativa.',
      })
      continue
    }

    steps.push({ id: action.id, type: 'ACTION', label: describeAutomationAction(action), status: 'WOULD_RUN' })
  }
}

/**
 * Preview 100% local e seguro: nunca chama um service que altera um ticket
 * real (não usa conversationsApi/chatSocket). Usado pelo botão "Testar
 * automação" no frontend e também pelo mock do endpoint de teste do backend
 * (mockServer.testAutomation), para que os dois caminhos deem o mesmo resultado.
 */
export async function buildAutomationPreview(
  automation: Automation,
  input: AutomationPreviewInput,
  runOperation: AutomationOperationRunner,
): Promise<AutomationPreviewResult> {
  const scope = buildScope(input)
  const triggerMatched = matchesTrigger(automation.trigger, input)
  const conditionsMatched = triggerMatched && evaluateAllGroups(automation.conditionGroups, scope)

  const steps: AutomationPreviewStep[] = [
    {
      id: 'trigger',
      type: 'TRIGGER',
      label: describeTrigger(automation.trigger),
      status: triggerMatched ? 'WOULD_RUN' : 'SKIPPED',
    },
    ...automation.conditionGroups.flatMap((group) =>
      group.conditions.map((condition) => ({
        id: condition.id,
        type: 'CONDITION' as const,
        label: describeCondition(condition),
        status: (!triggerMatched
          ? 'NOT_APPLICABLE'
          : evaluateCondition(condition, scope)
            ? 'WOULD_RUN'
            : 'SKIPPED') as AutomationPreviewStep['status'],
      })),
    ),
  ]

  await runActionsPreview(automation.actions, scope, steps, conditionsMatched, runOperation)

  return { triggerMatched, conditionsMatched, steps }
}

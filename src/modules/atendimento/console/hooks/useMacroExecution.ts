import { useCallback, useRef, useState } from 'react'
import { macrosApi } from '../services/api/macrosApi'
import type { ConversationDetail, ConversationPriority, ConversationTag } from '../types/domain'
import type {
  Macro,
  MacroAction,
  MacroExecutionContext,
  MacroExecutionState,
  MacroExecutionStep,
} from '../types/macro'
import { evaluateCondition } from '../utils/macroConditions'
import { renderMacroTemplate } from '../utils/macroTemplate'
import { createClientMessageId } from '../utils/uuid'

/**
 * Ações que o motor de execução precisa para agir num atendimento. Todas
 * reaproveitam serviços/funções já existentes (ver AtendimentoPage) — o hook
 * não reimplementa envio de mensagem, tags, notas ou transferência.
 */
export interface MacroActionRunner {
  getTags(): ConversationTag[]
  sendMessage(text: string): void
  updateTags(tags: ConversationTag[]): Promise<void>
  addNote(text: string): Promise<void>
  setPriority(priority: ConversationPriority): Promise<void>
  transferToAgent(agentId: string): Promise<void>
}

type ErrorDecision = 'retry' | 'continue' | 'cancel'
type PendingGate = { kind: 'confirm'; path: string; resolve(proceed: boolean): void } | {
  kind: 'error'
  path: string
  resolve(decision: ErrorDecision): void
}

const emptyState: MacroExecutionState = {
  executionId: null,
  macro: null,
  status: 'idle',
  steps: [],
  context: null,
}

export function useMacroExecution(runner: MacroActionRunner) {
  const [state, setState] = useState<MacroExecutionState>(emptyState)
  const [pendingGate, setPendingGate] = useState<{ kind: 'confirm' | 'error'; path: string } | null>(null)
  const pendingGateRef = useRef<PendingGate | null>(null)
  const cancelledRef = useRef(false)

  const upsertStep = useCallback((step: MacroExecutionStep) => {
    setState((current) => {
      const exists = current.steps.some((item) => item.path === step.path)
      return {
        ...current,
        steps: exists
          ? current.steps.map((item) => (item.path === step.path ? step : item))
          : [...current.steps, step],
      }
    })
  }, [])

  function waitForConfirm(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      pendingGateRef.current = { kind: 'confirm', path, resolve }
      setPendingGate({ kind: 'confirm', path })
    })
  }

  function waitForErrorDecision(path: string): Promise<ErrorDecision> {
    return new Promise((resolve) => {
      pendingGateRef.current = { kind: 'error', path, resolve }
      setPendingGate({ kind: 'error', path })
    })
  }

  function clearGate(): void {
    pendingGateRef.current = null
    setPendingGate(null)
  }

  async function resolveQueueAgent(queue: string): Promise<string> {
    const queues = await macrosApi.listQueues()
    const match = queues.find((item) => item.id === queue)
    if (!match) {
      throw new Error(
        `Fila "${queue}" não encontrada. O backend ainda não expõe as filas de transferência (endpoint pendente).`,
      )
    }
    return match.agentId
  }

  async function runSingleAction(
    action: Exclude<MacroAction, { type: 'CONDITION' }>,
    context: MacroExecutionContext,
  ): Promise<void> {
    switch (action.type) {
      case 'SEND_MESSAGE':
        runner.sendMessage(renderMacroTemplate(action.text, context))
        return
      case 'ADD_TAG': {
        const current = runner.getTags()
        if (!current.includes(action.tag)) await runner.updateTags([...current, action.tag])
        return
      }
      case 'REMOVE_TAG': {
        const current = runner.getTags()
        if (current.includes(action.tag)) await runner.updateTags(current.filter((tag) => tag !== action.tag))
        return
      }
      case 'SET_PRIORITY':
        await runner.setPriority(action.priority)
        context.results.priority = action.priority
        return
      case 'ADD_INTERNAL_NOTE':
        await runner.addNote(renderMacroTemplate(action.text, context))
        return
      case 'TRANSFER_QUEUE': {
        const agentId = await resolveQueueAgent(action.queue)
        await runner.transferToAgent(agentId)
        return
      }
      case 'WAIT':
        await new Promise((resolve) => window.setTimeout(resolve, action.ms))
        return
      case 'API_REQUEST': {
        const result = await macrosApi.runOperation(action.operation, action.params ?? {})
        context.results[action.key] = result
        return
      }
    }
  }

  async function attemptAction(
    action: Exclude<MacroAction, { type: 'CONDITION' }>,
    context: MacroExecutionContext,
  ): Promise<'ok' | 'cancelled'> {
    if (cancelledRef.current) return 'cancelled'

    upsertStep({ path: action.id, action, status: 'running', startedAt: new Date().toISOString() })

    try {
      await runSingleAction(action, context)
      upsertStep({ path: action.id, action, status: 'success', finishedAt: new Date().toISOString() })
      return 'ok'
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao executar a ação.'
      upsertStep({ path: action.id, action, status: 'failed', error: message, finishedAt: new Date().toISOString() })

      if (action.onError === 'CONTINUE') return 'ok'

      const decision = await waitForErrorDecision(action.id)
      clearGate()

      if (decision === 'retry') return attemptAction(action, context)
      if (decision === 'continue') return 'ok'
      return 'cancelled'
    }
  }

  async function runAction(action: MacroAction, context: MacroExecutionContext): Promise<'ok' | 'cancelled'> {
    if (cancelledRef.current) return 'cancelled'

    if (action.type === 'CONDITION') {
      const matched = evaluateCondition(action.condition, context)
      return runActions(matched ? action.then : (action.else ?? []), context)
    }

    if (action.confirm) {
      upsertStep({ path: action.id, action, status: 'awaiting_confirmation' })
      const proceed = await waitForConfirm(action.id)
      clearGate()

      if (!proceed) {
        upsertStep({ path: action.id, action, status: 'skipped' })
        return 'ok'
      }
    }

    return attemptAction(action, context)
  }

  async function runActions(actions: MacroAction[], context: MacroExecutionContext): Promise<'ok' | 'cancelled'> {
    for (const action of actions) {
      const result = await runAction(action, context)
      if (result === 'cancelled') return 'cancelled'
    }
    return 'ok'
  }

  // Função simples (sem useCallback): runAction/runActions fecham sobre o `runner`
  // mais recente a cada render, então memoizar aqui só reintroduziria closures antigas.
  async function start(macro: Macro, conversation: ConversationDetail) {
    cancelledRef.current = false
    const executionId = createClientMessageId()
    const context: MacroExecutionContext = {
      executionId,
      conversationId: conversation.id,
      ticketId: conversation.ticketNumber,
      customer: conversation.customer,
      variables: {},
      results: {},
    }

    setState({ executionId, macro, status: 'running', steps: [], context })

    macrosApi.execute(macro.id, { conversationId: conversation.id, executionId }).catch(() => {
      // Best-effort: backend ainda não tem o endpoint de execução (ver macrosApi.execute).
    })

    const outcome = await runActions(macro.actions, context)

    setState((current) => ({
      ...current,
      status:
        outcome === 'cancelled'
          ? 'cancelled'
          : current.steps.some((step) => step.status === 'failed')
            ? 'failed'
            : 'completed',
    }))
  }

  const confirmStep = useCallback((proceed: boolean) => {
    const gate = pendingGateRef.current
    if (gate?.kind === 'confirm') gate.resolve(proceed)
  }, [])

  const resolveError = useCallback((decision: ErrorDecision) => {
    const gate = pendingGateRef.current
    if (gate?.kind === 'error') gate.resolve(decision)
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    const gate = pendingGateRef.current
    if (gate?.kind === 'confirm') gate.resolve(false)
    if (gate?.kind === 'error') gate.resolve('cancel')
  }, [])

  const reset = useCallback(() => {
    cancelledRef.current = false
    pendingGateRef.current = null
    setPendingGate(null)
    setState(emptyState)
  }, [])

  return {
    state,
    pendingGate,
    locked: state.status === 'running',
    start,
    confirmStep,
    resolveError,
    cancel,
    reset,
  }
}

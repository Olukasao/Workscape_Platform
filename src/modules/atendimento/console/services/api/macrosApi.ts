import { appConfig } from '../../config'
import { mockServer } from '../../mocks/mockServer'
import type { Macro, MacroAction, MacroInput, MacroQueueOption } from '../../types/macro'
import { apiRequest } from './httpClient'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : String(value ?? fallback)
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function normalizeMacroAction(value: unknown): MacroAction | null {
  const record = asRecord(value)
  if (typeof record.type !== 'string') return null

  return record as unknown as MacroAction
}

export function normalizeMacro(value: unknown): Macro {
  const record = asRecord(value)
  const actions = Array.isArray(record.actions)
    ? record.actions.map(normalizeMacroAction).filter((action): action is MacroAction => action !== null)
    : []

  return {
    id: asString(record.id),
    name: asString(record.name),
    description: asOptionalString(record.description),
    shortcut: asString(record.shortcut),
    category: asOptionalString(record.category),
    enabled: record.enabled === undefined ? true : Boolean(record.enabled),
    actions,
    createdAt: asOptionalString(record.createdAt ?? record.created_at),
    updatedAt: asOptionalString(record.updatedAt ?? record.updated_at),
  }
}

export interface MacroExecutionHandle {
  executionId: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
}

/**
 * Serviço de Macros.
 *
 * Pendências de backend (ver README, seção "Macros"): nenhum destes endpoints
 * existe ainda na acessanet-chat-api. Em produção, estas chamadas falharão até
 * o backend implementá-los — o erro aparece normalmente no passo da execução
 * em vez de ser escondido. Em desenvolvimento (VITE_USE_MOCK=true) tudo
 * funciona via mockServer.
 */
export const macrosApi = {
  async list(): Promise<Macro[]> {
    if (appConfig.useMock) return mockServer.listMacros()

    const response = await apiRequest<unknown>('/api/agent/macros', { unwrap: false })
    const record = asRecord(response)
    const items = Array.isArray(record.macros) ? record.macros : Array.isArray(response) ? response : []
    return items.map(normalizeMacro)
  },

  async get(id: string): Promise<Macro> {
    if (appConfig.useMock) return mockServer.getMacro(id)

    const response = await apiRequest<unknown>(`/api/agent/macros/${id}`)
    return normalizeMacro(response)
  },

  async create(input: MacroInput): Promise<Macro> {
    if (appConfig.useMock) return mockServer.createMacro(input)

    const response = await apiRequest<unknown>('/api/agent/macros', {
      method: 'POST',
      body: input,
    })
    return normalizeMacro(response)
  },

  async update(id: string, patch: Partial<MacroInput>): Promise<Macro> {
    if (appConfig.useMock) return mockServer.updateMacro(id, patch)

    const response = await apiRequest<unknown>(`/api/agent/macros/${id}`, {
      method: 'PATCH',
      body: patch,
    })
    return normalizeMacro(response)
  },

  async remove(id: string): Promise<void> {
    if (appConfig.useMock) return mockServer.deleteMacro(id)

    return apiRequest<void>(`/api/agent/macros/${id}`, { method: 'DELETE' })
  },

  /**
   * Registra a execução no backend (auditoria/idempotência). Hoje, sem o motor
   * de execução no backend (ver seção 28 do pedido), o hook useMacroExecution
   * roda as ações sequencialmente no frontend reaproveitando os services já
   * existentes — esta chamada é best-effort e não bloqueia a execução local
   * se falhar (ex.: endpoint ainda não implementado).
   */
  async execute(
    macroId: string,
    input: { conversationId: string; ticketId?: string; executionId: string },
  ): Promise<MacroExecutionHandle> {
    if (appConfig.useMock) return mockServer.executeMacro(macroId, input)

    const response = await apiRequest<unknown>(`/api/agent/macros/${macroId}/execute`, {
      method: 'POST',
      body: input,
      unwrap: false,
    })
    const record = asRecord(response)
    return {
      executionId: asString(record.executionId ?? input.executionId),
      status: record.status === 'COMPLETED' || record.status === 'FAILED' ? record.status : 'RUNNING',
    }
  },

  async listQueues(): Promise<MacroQueueOption[]> {
    if (appConfig.useMock) return mockServer.listMacroQueues()

    const response = await apiRequest<unknown>('/api/agent/macro-queues', { unwrap: false })
    const record = asRecord(response)
    const items = Array.isArray(record.queues) ? record.queues : Array.isArray(response) ? response : []

    return items
      .map((item) => {
        const queueRecord = asRecord(item)
        return {
          id: asString(queueRecord.id),
          label: asString(queueRecord.label, asString(queueRecord.id)),
          agentId: asString(queueRecord.agentId ?? queueRecord.agent_id),
        }
      })
      .filter((queue) => queue.id && queue.agentId)
  },

  /**
   * Executa uma operação pré-autorizada no backend (ex.: "connectionStatus").
   * Nunca aceita URL arbitrária definida pelo frontend — a allowlist de
   * operações vive no backend.
   */
  async runOperation(operation: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (appConfig.useMock) return mockServer.runMacroOperation(operation, params)

    return apiRequest<unknown>('/api/agent/macro-operations/execute', {
      method: 'POST',
      body: { operation, params },
      unwrap: false,
    })
  },
}

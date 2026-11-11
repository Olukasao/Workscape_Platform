import { appConfig } from '../../config'
import { mockServer } from '../../mocks/mockServer'
import type {
  Automation,
  AutomationAction,
  AutomationExecution,
  AutomationInput,
  AutomationPreviewInput,
} from '../../types/automation'
import type { PaginatedResponse } from '../../types/domain'
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

function normalizeAction(value: unknown): AutomationAction | null {
  const record = asRecord(value)
  if (typeof record.type !== 'string') return null

  return record as unknown as AutomationAction
}

export function normalizeAutomation(value: unknown): Automation {
  const record = asRecord(value)
  const actions = Array.isArray(record.actions)
    ? record.actions.map(normalizeAction).filter((action): action is AutomationAction => action !== null)
    : []
  const conditionGroups = Array.isArray(record.conditionGroups) ? (record.conditionGroups as Automation['conditionGroups']) : []

  return {
    id: asString(record.id),
    name: asString(record.name),
    description: asOptionalString(record.description),
    status: record.status === 'ACTIVE' || record.status === 'PAUSED' ? record.status : 'DRAFT',
    priority: Number.isFinite(Number(record.priority)) ? Number(record.priority) : 10,
    stopProcessing: Boolean(record.stopProcessing),
    trigger: (record.trigger as Automation['trigger']) ?? { type: 'MESSAGE_RECEIVED' },
    conditionGroups,
    actions,
    metrics: record.metrics as Automation['metrics'],
    createdAt: asString(record.createdAt ?? record.created_at, new Date().toISOString()),
    updatedAt: asString(record.updatedAt ?? record.updated_at, new Date().toISOString()),
    createdBy: asOptionalString(record.createdBy ?? record.created_by),
  }
}

export interface AutomationTestResult {
  dryRun: true
  triggerMatched: boolean
  conditionsMatched: boolean
  steps: Array<{ label: string; status: string; detail?: string }>
}

/**
 * Serviço de Automações.
 *
 * Pendências de backend (ver README, seção "Automações"): nenhum destes
 * endpoints existe ainda na acessanet-chat-api — o motor de execução real
 * (triggers, timers, anti-loop, idempotência) deve viver lá. Em produção,
 * estas chamadas falham até o backend implementá-las; em desenvolvimento
 * (VITE_USE_MOCK=true) tudo funciona via mockServer. A validação de
 * trigger/condições sem tocar um ticket real é feita localmente por
 * `useAutomationPreview` (src/hooks/useAutomationPreview.ts), não depende
 * deste endpoint de teste.
 */
export const automationsApi = {
  async list(): Promise<Automation[]> {
    if (appConfig.useMock) return mockServer.listAutomations()

    const response = await apiRequest<unknown>('/api/agent/automations', { unwrap: false })
    const record = asRecord(response)
    const items = Array.isArray(record.automations) ? record.automations : Array.isArray(response) ? response : []
    return items.map(normalizeAutomation)
  },

  async get(id: string): Promise<Automation> {
    if (appConfig.useMock) return mockServer.getAutomation(id)

    const response = await apiRequest<unknown>(`/api/agent/automations/${id}`)
    return normalizeAutomation(response)
  },

  async create(input: AutomationInput): Promise<Automation> {
    if (appConfig.useMock) return mockServer.createAutomation(input)

    const response = await apiRequest<unknown>('/api/agent/automations', {
      method: 'POST',
      body: input,
    })
    return normalizeAutomation(response)
  },

  async update(id: string, patch: Partial<AutomationInput>): Promise<Automation> {
    if (appConfig.useMock) return mockServer.updateAutomation(id, patch)

    const response = await apiRequest<unknown>(`/api/agent/automations/${id}`, {
      method: 'PATCH',
      body: patch,
    })
    return normalizeAutomation(response)
  },

  async remove(id: string): Promise<void> {
    if (appConfig.useMock) return mockServer.deleteAutomation(id)

    return apiRequest<void>(`/api/agent/automations/${id}`, { method: 'DELETE' })
  },

  async enable(id: string): Promise<Automation> {
    if (appConfig.useMock) return mockServer.enableAutomation(id)

    const response = await apiRequest<unknown>(`/api/agent/automations/${id}/enable`, { method: 'POST' })
    return normalizeAutomation(response)
  },

  async disable(id: string): Promise<Automation> {
    if (appConfig.useMock) return mockServer.disableAutomation(id)

    const response = await apiRequest<unknown>(`/api/agent/automations/${id}/disable`, { method: 'POST' })
    return normalizeAutomation(response)
  },

  /**
   * Teste autoritativo contra o backend (dryRun: true, não deve alterar nenhum
   * ticket real). Pendente — ainda não existe na chat-api. O editor usa o
   * preview local (useAutomationPreview) como alternativa sempre disponível.
   */
  async test(id: string, input: AutomationPreviewInput): Promise<AutomationTestResult> {
    if (appConfig.useMock) return mockServer.testAutomation(id, input)

    return apiRequest<AutomationTestResult>(`/api/agent/automations/${id}/test`, {
      method: 'POST',
      body: { ...input, dryRun: true },
      unwrap: false,
    })
  },

  async listExecutions(automationId?: string): Promise<PaginatedResponse<AutomationExecution>> {
    if (appConfig.useMock) return mockServer.listAutomationExecutions(automationId)

    const query = automationId ? `?automationId=${encodeURIComponent(automationId)}` : ''
    const response = await apiRequest<unknown>(`/api/agent/automation-executions${query}`, { unwrap: false })
    const record = asRecord(response)
    const items = Array.isArray(record.data) ? record.data : Array.isArray(response) ? response : []

    return {
      data: items as AutomationExecution[],
      pagination: { hasMore: false },
    }
  },

  async getExecution(executionId: string): Promise<AutomationExecution> {
    if (appConfig.useMock) return mockServer.getAutomationExecution(executionId)

    return apiRequest<AutomationExecution>(`/api/agent/automation-executions/${executionId}`)
  },
}

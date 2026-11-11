import { appConfig } from '../../config'
import { mockServer } from '../../mocks/mockServer'
import type { MonitoringAgent, MonitoringOverview, MonitoringQueue } from '../../types/domain'
import { apiRequest } from './httpClient'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeOverview(value: unknown): MonitoringOverview {
  const r = asRecord(value)
  return {
    activeNow: asNumber(r.activeNow),
    waitingForAgent: asNumber(r.waitingForAgent),
    waitingForCustomer: asNumber(r.waitingForCustomer),
    closedToday: asNumber(r.closedToday),
    longestWaitSeconds: asOptionalNumber(r.longestWaitSeconds),
    avgWaitSeconds: asOptionalNumber(r.avgWaitSeconds),
    avgHandleSeconds: asOptionalNumber(r.avgHandleSeconds),
    agentsOnline: asNumber(r.agentsOnline),
    agentsInvisible: asNumber(r.agentsInvisible),
    agentsOffline: asNumber(r.agentsOffline),
    agentsTotal: asNumber(r.agentsTotal),
  }
}

function normalizeQueue(value: unknown): MonitoringQueue {
  const r = asRecord(value)
  return {
    tag: (r.tag as MonitoringQueue['tag']) ?? 'sem_categoria',
    waiting: asNumber(r.waiting),
    inProgress: asNumber(r.inProgress),
    agentsOnline: asNumber(r.agentsOnline),
    longestWaitSeconds: asOptionalNumber(r.longestWaitSeconds),
  }
}

function normalizeAgent(value: unknown): MonitoringAgent {
  const r = asRecord(value)
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    role: (r.role as MonitoringAgent['role']) ?? 'agent',
    attendanceStatus: (r.attendanceStatus as MonitoringAgent['attendanceStatus']) ?? 'AVAILABLE',
    statusSinceSeconds: asOptionalNumber(r.statusSinceSeconds),
    activeConversations: asNumber(r.activeConversations),
    oldestActiveSeconds: asOptionalNumber(r.oldestActiveSeconds),
  }
}

export const monitoringApi = {
  async getOverview(): Promise<MonitoringOverview> {
    if (appConfig.useMock) return mockServer.getMonitoringOverview()

    return normalizeOverview(await apiRequest<unknown>('/api/agent/monitoring/overview', { unwrap: false }))
  },

  async getQueues(): Promise<MonitoringQueue[]> {
    if (appConfig.useMock) return mockServer.getMonitoringQueues()

    const response = await apiRequest<unknown>('/api/agent/monitoring/queues', { unwrap: false })
    const record = asRecord(response)
    return Array.isArray(record.queues) ? record.queues.map(normalizeQueue) : []
  },

  async getAgents(): Promise<MonitoringAgent[]> {
    if (appConfig.useMock) return mockServer.getMonitoringAgents()

    const response = await apiRequest<unknown>('/api/agent/monitoring/agents', { unwrap: false })
    const record = asRecord(response)
    return Array.isArray(record.agents) ? record.agents.map(normalizeAgent) : []
  },
}

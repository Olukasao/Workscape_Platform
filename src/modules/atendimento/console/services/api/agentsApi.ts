import { appConfig } from '../../config'
import { mockServer } from '../../mocks/mockServer'
import type { AgentOption, AgentPresence, AgentRole, AttendanceStatus } from '../../types/domain'
import {
  isAttendanceStatusValue,
  normalizeAgentRole,
  normalizeAttendanceStatus,
} from '../../utils/agents'
import { apiRequest } from './httpClient'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function extractAgents(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload

  const record = asRecord(payload)
  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    const nested = extractAgents(record.data)
    if (nested.length > 0) return nested
  }

  const candidates = [
    record.agents,
    record.usuarios,
    record.users,
    record.items,
    record.data,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

function extractAgentPayload(payload: unknown): Record<string, unknown> {
  const record = asRecord(payload)
  const candidates = [record.data, record.agent, record.user, record.member, record.usuario]

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return extractAgentPayload(candidate)
    }
  }

  return record
}

function normalizePresence(value: unknown): AgentPresence {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'online' || normalized === 'away' || normalized === 'offline') return normalized
  if (normalized === 'ausente') return 'away'
  if (normalized === 'active' || normalized === 'ativo') return 'online'

  return 'offline'
}

function normalizeOnline(value: unknown, presence: AgentPresence): boolean {
  if (typeof value === 'boolean') return value

  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'online') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'offline') return false

  return presence === 'online'
}

function normalizeAgent(agent: unknown): AgentOption | null {
  const item = extractAgentPayload(agent)
  const id = String(item.id ?? item.usuario_id ?? '').trim()
  const name = asOptionalString(item.name ?? item.nome ?? item.displayName ?? item.display_name)

  if (!id || !name) return null

  const attendanceStatus = normalizeAttendanceStatus(
    item.attendanceStatus ??
      item.attendance_status ??
      item.availabilityStatus ??
      item.availability_status ??
      item.status,
  )
  const presenceSource = isAttendanceStatusValue(item.status)
    ? item.presence ?? item.presenca ?? item.onlineStatus ?? item.online_status
    : item.presence ?? item.presenca ?? item.onlineStatus ?? item.online_status ?? item.status
  const presence = normalizePresence(presenceSource)
  const online = normalizeOnline(item.online, presence)

  return {
    id,
    name,
    email: asOptionalString(item.email) ?? '',
    role: normalizeAgentRole(item.role ?? item.perfil),
    attendanceStatus,
    attendanceStatusChangedAt: asOptionalString(
      item.attendanceStatusChangedAt ??
        item.attendance_status_changed_at ??
        item.availabilityStatusChangedAt ??
        item.availability_status_changed_at ??
        item.statusChangedAt ??
        item.status_changed_at,
    ),
    presence,
    online,
    departmentName: asOptionalString(item.departmentName ?? item.department_name ?? item.setor_nome),
    avatarUrl: asOptionalString(item.avatarUrl ?? item.avatar_url ?? item.avatar),
    lastSeenAt: asOptionalString(item.lastSeenAt ?? item.last_seen_at ?? item.ultimo_acesso),
  }
}

function normalizeAgents(payload: unknown): AgentOption[] {
  return extractAgents(payload)
    .map(normalizeAgent)
    .filter((agent): agent is AgentOption => agent !== null)
    .sort((left, right) => {
      if (left.online !== right.online) return left.online ? -1 : 1
      return left.name.localeCompare(right.name, 'pt-BR')
    })
}

async function listAttendanceAgents(): Promise<AgentOption[]> {
  const response = await apiRequest<unknown>('/api/agent/agents', { unwrap: false })
  return normalizeAgents(response)
}

async function listAttendanceMembers(): Promise<AgentOption[]> {
  const response = await apiRequest<unknown>('/api/agent/members', { unwrap: false })
  return normalizeAgents(response)
}

async function listInternalChatAgents(): Promise<AgentOption[]> {
  const response = await apiRequest<unknown>('/api/agent/internal-chat/agents', { unwrap: false })
  return normalizeAgents(response)
}

export const agentsApi = {
  async list(): Promise<AgentOption[]> {
    if (appConfig.useMock) return mockServer.listAgents()

    try {
      return await listInternalChatAgents()
    } catch {
      return listAttendanceAgents()
    }
  },

  async listMembers(): Promise<AgentOption[]> {
    if (appConfig.useMock) return mockServer.listMembers()

    try {
      return await listAttendanceMembers()
    } catch {
      return listAttendanceAgents()
    }
  },

  async updateOwnAttendanceStatus(status: AttendanceStatus): Promise<AgentOption> {
    if (appConfig.useMock) return mockServer.updateOwnAttendanceStatus(status)

    const response = await apiRequest<unknown>('/api/agent/users/me/status', {
      method: 'PATCH',
      body: {
        status,
        attendanceStatus: status,
        attendance_status: status,
      },
      unwrap: false,
    })
    const normalized = normalizeAgent(response)
    if (!normalized) throw new Error('Resposta inválida ao atualizar status.')

    return normalized
  },

  async updateMemberAttendanceStatus(userId: string, status: AttendanceStatus): Promise<AgentOption> {
    if (appConfig.useMock) return mockServer.updateMemberAttendanceStatus(userId, status)

    const response = await apiRequest<unknown>(`/api/agent/users/${userId}/status`, {
      method: 'PATCH',
      body: {
        status,
        attendanceStatus: status,
        attendance_status: status,
      },
      unwrap: false,
    })
    const normalized = normalizeAgent(response)
    if (!normalized) throw new Error('Resposta inválida ao atualizar status.')

    return normalized
  },

  async updateMemberRole(userId: string, role: AgentRole): Promise<AgentOption> {
    if (appConfig.useMock) return mockServer.updateMemberRole(userId, role)

    const response = await apiRequest<unknown>(`/api/agent/users/${userId}/role`, {
      method: 'PATCH',
      body: { role },
      unwrap: false,
    })
    const normalized = normalizeAgent(response)
    if (!normalized) throw new Error('Resposta inválida ao atualizar cargo.')

    return normalized
  },
}

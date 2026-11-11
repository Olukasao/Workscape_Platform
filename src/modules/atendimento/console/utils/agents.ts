import type { AgentRole, AttendanceStatus } from '../types/domain'

export const attendanceStatusOptions: Array<{
  id: AttendanceStatus
  label: string
  helper: string
}> = [
  {
    id: 'AVAILABLE',
    label: 'Disponível',
    helper: 'Você voltará a receber novos chamados normalmente.',
  },
  {
    id: 'INVISIBLE',
    label: 'Invisível',
    helper: 'Você ficará invisível para a distribuição de novos chamados.',
  },
]

export const manageableRoleOptions: Array<{ id: AgentRole; label: string }> = [
  { id: 'attendant', label: 'Atendente' },
  { id: 'admin', label: 'Administrador' },
]

export function normalizeAgentRole(value: unknown): AgentRole {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (normalized === 'admin' || normalized === 'administrador') return 'admin'
  if (normalized === 'supervisor') return 'supervisor'
  if (normalized === 'attendant' || normalized === 'atendente' || normalized === 'agent') {
    return 'attendant'
  }

  return 'attendant'
}

export function normalizeAttendanceStatus(value: unknown): AttendanceStatus {
  const normalized = String(value ?? '').trim().toUpperCase()

  if (normalized === 'INVISIBLE' || normalized === 'INVISIVEL' || normalized === 'HIDDEN') {
    return 'INVISIBLE'
  }

  return 'AVAILABLE'
}

export function isAttendanceStatusValue(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toUpperCase()
  return normalized === 'AVAILABLE' || normalized === 'INVISIBLE'
}

export function getAgentRoleLabel(role?: string): string {
  if (role === 'admin') return 'Administrador'
  if (role === 'supervisor') return 'Supervisor'

  return 'Atendente'
}

export function getAttendanceStatusLabel(status?: AttendanceStatus): string {
  return status === 'INVISIBLE' ? 'Invisível' : 'Disponível'
}

export function getAttendanceStatusIndicator(status?: AttendanceStatus): string {
  return status === 'INVISIBLE' ? '⚫' : '🟢'
}

export function getAttendanceStatusHelper(status: AttendanceStatus): string {
  return attendanceStatusOptions.find((option) => option.id === status)?.helper ?? ''
}

export function formatInvisibleDuration(since?: string, now = Date.now()): string {
  if (!since) return ''

  const startedAt = new Date(since).getTime()
  if (!Number.isFinite(startedAt)) return ''

  const elapsedMinutes = Math.max(0, Math.floor((now - startedAt) / 60_000))
  if (elapsedMinutes < 1) return 'Invisível há menos de 1 min'
  if (elapsedMinutes < 60) return `Invisível há ${elapsedMinutes} min`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  const remainingMinutes = elapsedMinutes % 60
  const hourLabel = elapsedHours === 1 ? '1 h' : `${elapsedHours} h`

  if (remainingMinutes === 0) return `Invisível há ${hourLabel}`

  return `Invisível há ${hourLabel} ${remainingMinutes} min`
}

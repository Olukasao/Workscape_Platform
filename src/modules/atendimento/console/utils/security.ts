export function maskCpf(value?: string): string {
  if (!value) return 'Não informado'

  const digits = value.replace(/\D/g, '')
  if (digits.length !== 11) return value

  return `***.***.***-${digits.slice(-2)}`
}

export function maskDocument(value?: string | null): string {
  if (!value) return '—'

  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) return `***.***.***-${digits.slice(-2)}`
  if (digits.length === 14) return `**.***.***/****-${digits.slice(-2)}`

  return value
}

export function canTransfer(role?: string): boolean {
  return role === 'supervisor' || role === 'admin'
}

export function canCloseConversation(role?: string): boolean {
  return role === 'attendant' || role === 'agent' || role === 'supervisor' || role === 'admin'
}

export function canManageMembers(role?: string): boolean {
  return role === 'admin'
}

export function canViewMonitoring(role?: string): boolean {
  return role === 'supervisor' || role === 'admin'
}

export function canViewAuditLog(role?: string): boolean {
  return role === 'supervisor' || role === 'admin'
}

export function canViewSalesAudit(role?: string): boolean {
  return role === 'supervisor' || role === 'admin'
}

export function canManageCampaigns(role?: string): boolean {
  return role === 'supervisor' || role === 'admin'
}

export function canSendCampaigns(role?: string): boolean {
  return role === 'admin'
}

export function canReopenConversation(role?: string): boolean {
  return role === 'supervisor' || role === 'admin'
}

export function canManageMacros(role?: string): boolean {
  return role === 'supervisor' || role === 'admin'
}

export function canViewAutomations(role?: string): boolean {
  return role === 'supervisor' || role === 'admin'
}

export function canManageAutomations(role?: string): boolean {
  return role === 'admin'
}

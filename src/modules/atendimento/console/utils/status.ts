import type { ConversationStatus } from '../types/domain'

export const statusLabels: Record<ConversationStatus, string> = {
  new: 'Novo',
  open: 'Em atendimento',
  waiting_customer: 'Aguardando cliente',
  waiting_agent: 'Aguardando atendente',
  closed: 'Encerrado',
}

export function getStatusLabel(status: ConversationStatus): string {
  return statusLabels[status]
}

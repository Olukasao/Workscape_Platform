import type { ConversationCloseReason } from '../types/domain'

export const closeReasonOptions: Array<{
  id: ConversationCloseReason
  label: string
}> = [
  { id: 'resolved', label: 'Resolvido' },
  { id: 'no_customer_response', label: 'Cliente não respondeu' },
  { id: 'sent_to_technician', label: 'Encaminhado para técnico' },
  { id: 'duplicate', label: 'Duplicado' },
  { id: 'other', label: 'Outro' },
]

export function getCloseReasonLabel(reason?: ConversationCloseReason | null): string | undefined {
  return closeReasonOptions.find((option) => option.id === reason)?.label
}

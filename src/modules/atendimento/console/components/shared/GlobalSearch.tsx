import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ConversationSummary } from '../../types/domain'

interface GlobalSearchProps {
  open: boolean
  conversations: ConversationSummary[]
  onClose(): void
  onSelect(conversationId: string): void
}

export function GlobalSearch({ open, conversations, onClose, onSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return

    setQuery('')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  if (!open) return null

  const normalized = query.trim().toLowerCase()
  const results = (
    normalized
      ? conversations.filter((conversation) =>
          [
            conversation.customerName,
            conversation.subject,
            conversation.ticketNumber,
            conversation.customer?.contractNumber,
          ]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(normalized)),
        )
      : conversations
  ).slice(0, 20)

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel search-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Busca rápida"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="search-panel-input">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
              if (event.key === 'Enter' && results[0]) onSelect(results[0].id)
            }}
            placeholder="Buscar cliente, chamado, contrato ou categoria..."
          />
          <kbd>Esc</kbd>
        </div>
        <div className="search-panel-results">
          {results.length === 0 && (
            <p className="empty-state">Nenhum atendimento encontrado na fila carregada.</p>
          )}
          {results.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              className="search-result-item"
              onClick={() => onSelect(conversation.id)}
            >
              <strong>{conversation.customerName}</strong>
              <span>{conversation.subject ?? 'Atendimento'}</span>
              {conversation.ticketNumber && <span className="search-result-ticket">#{conversation.ticketNumber}</span>}
            </button>
          ))}
        </div>
        <footer className="search-panel-footer">
          Busca nos atendimentos já carregados nesta sessão. Troque o filtro da fila para ampliar a busca.
        </footer>
      </section>
    </div>
  )
}

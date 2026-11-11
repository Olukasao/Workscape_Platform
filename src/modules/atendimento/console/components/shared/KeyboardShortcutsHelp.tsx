import { Keyboard } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose(): void
}

const shortcuts: Array<{ keys: string; description: string }> = [
  { keys: 'Ctrl + K', description: 'Busca rápida de atendimentos' },
  { keys: 'Enter', description: 'Enviar mensagem' },
  { keys: 'Shift + Enter', description: 'Nova linha na mensagem' },
  { keys: '/', description: 'Abrir respostas rápidas no campo de mensagem' },
  { keys: 'Alt + T', description: 'Transferir atendimento' },
  { keys: 'Alt + E', description: 'Encerrar atendimento' },
  { keys: '?', description: 'Abrir esta lista de atalhos' },
]

export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-icon">
          <Keyboard size={22} aria-hidden="true" />
        </div>
        <h2 id="shortcuts-title">Atalhos de teclado</h2>
        <ul className="shortcuts-list">
          {shortcuts.map((item) => (
            <li key={item.keys}>
              <kbd>{item.keys}</kbd>
              <span>{item.description}</span>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" className="secondary-action" onClick={onClose}>
            Fechar
          </button>
        </div>
      </section>
    </div>
  )
}

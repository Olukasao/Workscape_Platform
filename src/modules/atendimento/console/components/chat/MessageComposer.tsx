import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { SendHorizonal } from 'lucide-react'
import type { QuickReply } from '../../types/domain'
import type { Macro } from '../../types/macro'
import { MacroMenu } from '../macros/MacroMenu'
import { MacroSuggestion } from '../macros/MacroSuggestion'
import { searchMacros } from '../../utils/macroShortcuts'

interface MessageComposerProps {
  disabled?: boolean
  agentName?: string
  quickReplies?: QuickReply[]
  macros?: Macro[]
  recentMacros?: Macro[]
  favoriteMacroIds?: string[]
  onSend(body: string): void
  onTriggerMacro?(macro: Macro): void
  onTypingStart(): void
  onTypingStop(): void
}

type ComposerSuggestion = { kind: 'reply'; reply: QuickReply } | { kind: 'macro'; macro: Macro }

export function MessageComposer({
  disabled,
  agentName,
  quickReplies = [],
  macros = [],
  recentMacros = [],
  favoriteMacroIds = [],
  onSend,
  onTriggerMacro,
  onTypingStart,
  onTypingStop,
}: MessageComposerProps) {
  const [value, setValue] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(true)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const typingTimerRef = useRef<number | null>(null)

  const matchingReplies = useMemo(() => {
    const trimmed = value.trim()
    if (disabled || !trimmed.startsWith('/')) return []

    return quickReplies.filter((reply) => reply.active && reply.shortcut.startsWith(trimmed.toLowerCase()))
  }, [value, quickReplies, disabled])

  const matchingMacros = useMemo(() => {
    const trimmed = value.trim()
    if (disabled || !trimmed.startsWith('/')) return []

    return searchMacros(macros, trimmed)
  }, [value, macros, disabled])

  const suggestions = useMemo<ComposerSuggestion[]>(
    () => [
      ...matchingReplies.map((reply): ComposerSuggestion => ({ kind: 'reply', reply })),
      ...matchingMacros.map((macro): ComposerSuggestion => ({ kind: 'macro', macro })),
    ],
    [matchingReplies, matchingMacros],
  )

  const showSuggestions = suggestionsOpen && suggestions.length > 0

  function stopTypingLater(): void {
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)

    typingTimerRef.current = window.setTimeout(() => {
      onTypingStop()
    }, 1_200)
  }

  function updateValue(nextValue: string): void {
    setValue(nextValue)
    setSuggestionsOpen(true)
    setHighlightedIndex(0)
    if (!disabled) {
      onTypingStart()
      stopTypingLater()
    }
  }

  function submitMessage(): void {
    const body = value.trim()
    if (!body || disabled) return

    onSend(body)
    setValue('')
    onTypingStop()
  }

  function applySuggestion(suggestion: ComposerSuggestion): void {
    if (suggestion.kind === 'reply') {
      updateValue(suggestion.reply.body)
      return
    }

    setSuggestionsOpen(false)
    setValue('')
    onTriggerMacro?.(suggestion.macro)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitMessage()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (showSuggestions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightedIndex((index) => (index + 1) % suggestions.length)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightedIndex((index) => (index - 1 + suggestions.length) % suggestions.length)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setSuggestionsOpen(false)
        return
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        const target = suggestions[highlightedIndex]
        if (target) applySuggestion(target)
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitMessage()
    }
  }

  return (
    <form className="message-composer" onSubmit={handleSubmit}>
      {agentName && !disabled && (
        <div className="composer-agent">
          Enviando como <strong>{agentName}</strong>
        </div>
      )}

      {showSuggestions && (
        <div className="quick-replies" role="listbox" aria-label="Respostas rápidas e macros">
          {suggestions.map((suggestion, index) => {
            if (suggestion.kind === 'reply') {
              return (
                <button
                  type="button"
                  key={`reply-${suggestion.reply.id}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => applySuggestion(suggestion)}
                  className={`quick-reply ${highlightedIndex === index ? 'highlighted' : ''}`}
                >
                  <strong>{suggestion.reply.shortcut}</strong>
                  <span>{suggestion.reply.title}</span>
                </button>
              )
            }

            return (
              <MacroSuggestion
                key={`macro-${suggestion.macro.id}`}
                macro={suggestion.macro}
                highlighted={highlightedIndex === index}
                favorite={favoriteMacroIds.includes(suggestion.macro.id)}
                onHighlight={() => setHighlightedIndex(index)}
                onSelect={() => applySuggestion(suggestion)}
              />
            )
          })}
        </div>
      )}

      <label className={`composer-input ${onTriggerMacro && !disabled ? 'has-macro-button' : ''}`}>
        <span className="sr-only">Digite uma mensagem</span>
        <textarea
          value={value}
          onChange={(event) => updateValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          rows={1}
          disabled={disabled}
        />
        {onTriggerMacro && !disabled && (
          <MacroMenu
            macros={macros}
            recentMacros={recentMacros}
            favoriteIds={favoriteMacroIds}
            onSelect={(macro) => {
              setSuggestionsOpen(false)
              onTriggerMacro(macro)
            }}
          />
        )}
      </label>
      <button
        className="send-button"
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Enviar mensagem"
        title="Enviar mensagem"
      >
        <SendHorizonal size={20} aria-hidden="true" />
      </button>
    </form>
  )
}

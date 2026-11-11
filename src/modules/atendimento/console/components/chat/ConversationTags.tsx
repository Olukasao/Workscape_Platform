import { Check, Tag } from 'lucide-react'
import type { ConversationTag } from '../../types/domain'
import { conversationTagOptions } from '../../utils/conversationTags'

interface ConversationTagsProps {
  selectedTags: ConversationTag[]
  disabled?: boolean
  updating?: boolean
  onChange(tags: ConversationTag[]): void
}

export function ConversationTags({
  selectedTags,
  disabled,
  updating,
  onChange,
}: ConversationTagsProps) {
  const selectedSet = new Set(selectedTags)

  function toggleTag(tag: ConversationTag) {
    if (disabled || updating) return

    const nextTags = selectedSet.has(tag)
      ? selectedTags.filter((selectedTag) => selectedTag !== tag)
      : [...selectedTags, tag]

    onChange(nextTags)
  }

  return (
    <section className="conversation-tags-panel" aria-label="Categorias">
      <div className="tags-heading">
        <Tag size={16} aria-hidden="true" />
        <h3>Categorias</h3>
        {updating && <span>Salvando...</span>}
      </div>
      <div className="tag-options">
        {conversationTagOptions.map((tag) => {
          const selected = selectedSet.has(tag.id)

          return (
            <button
              key={tag.id}
              type="button"
              className={`tag-chip ${selected ? 'selected' : ''}`}
              aria-pressed={selected}
              disabled={disabled || updating}
              onClick={() => toggleTag(tag.id)}
            >
              {selected && <Check size={13} aria-hidden="true" />}
              {tag.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}

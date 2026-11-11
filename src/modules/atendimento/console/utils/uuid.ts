export function createClientMessageId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  const random = Math.random().toString(36).slice(2)
  return `client-${Date.now()}-${random}`
}

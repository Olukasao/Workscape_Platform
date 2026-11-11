export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function formatCpf(value: string): string {
  return normalizeCpf(value)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

export function isCompleteCpf(value: string): boolean {
  return normalizeCpf(value).length === 11
}

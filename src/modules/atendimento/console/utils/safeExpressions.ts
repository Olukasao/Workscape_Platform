/**
 * Primitivas compartilhadas para avaliar condições/templates declarativos sem
 * eval/Function — usadas por Macros (macroConditions.ts/macroTemplate.ts) e
 * por Automações (automationConditions.ts). Nunca interpretam JavaScript.
 */

/** Resolve um caminho tipo "regionalIncident.affected" num objeto simples. */
export function resolvePath(scope: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || value === undefined || typeof value !== 'object') return undefined
    return (value as Record<string, unknown>)[key]
  }, scope)
}

export function toComparableNumber(value: unknown): number | null {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

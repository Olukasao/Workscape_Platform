import type { MacroCondition, MacroExecutionContext } from '../types/macro'
import { resolvePath, toComparableNumber } from './safeExpressions'

/**
 * Resolve um caminho tipo "regionalIncident.affected" dentro do contexto de
 * execução, sem eval/Function — apenas navegação manual por propriedades.
 */
export function resolveContextPath(context: MacroExecutionContext, path: string): unknown {
  const scope: Record<string, unknown> = {
    ...context.variables,
    ...context.results,
    customer: context.customer,
  }

  return resolvePath(scope, path)
}

export function evaluateCondition(condition: MacroCondition, context: MacroExecutionContext): boolean {
  const actual = resolveContextPath(context, condition.variable)

  switch (condition.operator) {
    case 'EXISTS':
      return actual !== undefined && actual !== null
    case 'NOT_EXISTS':
      return actual === undefined || actual === null
    case 'EQUALS':
      return actual === condition.value
    case 'NOT_EQUALS':
      return actual !== condition.value
    case 'CONTAINS':
      if (Array.isArray(actual)) return actual.includes(condition.value)
      if (typeof actual === 'string') return actual.includes(String(condition.value ?? ''))
      return false
    case 'GREATER_THAN': {
      const left = toComparableNumber(actual)
      const right = toComparableNumber(condition.value)
      return left !== null && right !== null && left > right
    }
    case 'LESS_THAN': {
      const left = toComparableNumber(actual)
      const right = toComparableNumber(condition.value)
      return left !== null && right !== null && left < right
    }
    default:
      return false
  }
}

import type { AutomationCondition, AutomationConditionGroup } from '../types/automation'
import { resolvePath, toComparableNumber } from './safeExpressions'

function asText(value: unknown): string {
  return String(value ?? '').toLowerCase()
}

export function evaluateCondition(condition: AutomationCondition, scope: Record<string, unknown>): boolean {
  const actual = resolvePath(scope, condition.field)

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
      return asText(actual).includes(asText(condition.value))
    case 'NOT_CONTAINS':
      if (Array.isArray(actual)) return !actual.includes(condition.value)
      return !asText(actual).includes(asText(condition.value))
    case 'STARTS_WITH':
      return asText(actual).startsWith(asText(condition.value))
    case 'ENDS_WITH':
      return asText(actual).endsWith(asText(condition.value))
    case 'GREATER_THAN': {
      const left = toComparableNumber(actual)
      const right = toComparableNumber(condition.value)
      return left !== null && right !== null && left > right
    }
    case 'GREATER_THAN_OR_EQUAL': {
      const left = toComparableNumber(actual)
      const right = toComparableNumber(condition.value)
      return left !== null && right !== null && left >= right
    }
    case 'LESS_THAN': {
      const left = toComparableNumber(actual)
      const right = toComparableNumber(condition.value)
      return left !== null && right !== null && left < right
    }
    case 'LESS_THAN_OR_EQUAL': {
      const left = toComparableNumber(actual)
      const right = toComparableNumber(condition.value)
      return left !== null && right !== null && left <= right
    }
    case 'IN':
      return Array.isArray(condition.value) && condition.value.includes(actual)
    case 'NOT_IN':
      return Array.isArray(condition.value) && !condition.value.includes(actual)
    default:
      return false
  }
}

/** Dentro de um grupo: AND exige todas as condições, OR exige pelo menos uma. */
export function evaluateConditionGroup(group: AutomationConditionGroup, scope: Record<string, unknown>): boolean {
  if (group.conditions.length === 0) return true

  return group.operator === 'OR'
    ? group.conditions.some((condition) => evaluateCondition(condition, scope))
    : group.conditions.every((condition) => evaluateCondition(condition, scope))
}

/** Entre grupos: sempre AND (todos os grupos precisam ser satisfeitos). */
export function evaluateAllGroups(groups: AutomationConditionGroup[], scope: Record<string, unknown>): boolean {
  return groups.every((group) => evaluateConditionGroup(group, scope))
}

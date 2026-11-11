import type { MacroExecutionContext } from '../types/macro'
import { resolveContextPath } from './macroConditions'

const TEMPLATE_TOKEN = /\{\{\s*([\w.]+)\s*\}\}/g

/**
 * Renderer de templates próprio: só substitui tokens {{caminho}} por valores
 * do contexto de execução. Nunca executa JavaScript (sem eval/Function).
 */
export function renderMacroTemplate(text: string, context: MacroExecutionContext): string {
  return text.replace(TEMPLATE_TOKEN, (_match, path: string) => {
    const value = resolveContextPath(context, path)
    if (value === undefined || value === null) return ''
    if (typeof value === 'object') return ''
    return String(value)
  })
}

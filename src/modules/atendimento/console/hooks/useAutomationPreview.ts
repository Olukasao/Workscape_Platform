import { useCallback, useState } from 'react'
import { macrosApi } from '../services/api/macrosApi'
import type { Automation, AutomationPreviewInput, AutomationPreviewResult } from '../types/automation'
import { buildAutomationPreview } from '../utils/automationPreview'
import { getReadableError } from '../utils/errors'

export function useAutomationPreview() {
  const [result, setResult] = useState<AutomationPreviewResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async (automation: Automation, input: AutomationPreviewInput) => {
    setRunning(true)
    setError('')

    try {
      const preview = await buildAutomationPreview(automation, input, (operation, params) =>
        macrosApi.runOperation(operation, params),
      )
      setResult(preview)
    } catch (err) {
      setError(getReadableError(err, 'Não foi possível simular a automação.'))
    } finally {
      setRunning(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError('')
  }, [])

  return { result, running, error, run, reset }
}

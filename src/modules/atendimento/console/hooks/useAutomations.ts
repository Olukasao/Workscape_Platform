import { useCallback, useEffect, useState } from 'react'
import { automationsApi } from '../services/api/automationsApi'
import type { Automation } from '../types/automation'
import { getReadableError } from '../utils/errors'

export function useAutomations() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    return automationsApi
      .list()
      .then(setAutomations)
      .catch((err) => setError(getReadableError(err, 'Não foi possível carregar as automações.')))
      .finally(() => setLoading(false))
  }, [])

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    void reload()
  }, [reload])

  return { automations, loading, error, reload }
}

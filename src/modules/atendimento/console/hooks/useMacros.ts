import { useCallback, useEffect, useMemo, useState } from 'react'
import { macrosApi } from '../services/api/macrosApi'
import type { Macro } from '../types/macro'
import { getReadableError } from '../utils/errors'

const RECENTS_KEY = 'acessanet-atendimento:macro-recents'
const FAVORITES_KEY = 'acessanet-atendimento:macro-favorites'
const MAX_RECENTS = 6

/**
 * Favoritos/recentes guardam só ids de macro no localStorage — nunca dados de
 * cliente ou de atendimento. Quando existir API de preferências, trocar por ela.
 */
function readIdList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeIdList(key: string, ids: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // localStorage indisponível (modo privado, storage bloqueado etc.) — não é crítico aqui.
  }
}

export function useMacros() {
  const [macros, setMacros] = useState<Macro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recentIds, setRecentIds] = useState<string[]>(() => readIdList(RECENTS_KEY))
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readIdList(FAVORITES_KEY))

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    return macrosApi
      .list()
      .then(setMacros)
      .catch((err) => setError(getReadableError(err, 'Não foi possível carregar as macros.')))
      .finally(() => setLoading(false))
  }, [])

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    void reload()
  }, [reload])

  const registerRecent = useCallback((macroId: string) => {
    setRecentIds((current) => {
      const next = [macroId, ...current.filter((id) => id !== macroId)].slice(0, MAX_RECENTS)
      writeIdList(RECENTS_KEY, next)
      return next
    })
  }, [])

  const toggleFavorite = useCallback((macroId: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(macroId)
        ? current.filter((id) => id !== macroId)
        : [...current, macroId]
      writeIdList(FAVORITES_KEY, next)
      return next
    })
  }, [])

  const recentMacros = useMemo(
    () => recentIds.map((id) => macros.find((macro) => macro.id === id)).filter((macro): macro is Macro => Boolean(macro)),
    [recentIds, macros],
  )

  const favoriteMacros = useMemo(
    () => favoriteIds.map((id) => macros.find((macro) => macro.id === id)).filter((macro): macro is Macro => Boolean(macro)),
    [favoriteIds, macros],
  )

  return {
    macros,
    loading,
    error,
    reload,
    recentMacros,
    favoriteMacros,
    favoriteIds,
    registerRecent,
    toggleFavorite,
  }
}

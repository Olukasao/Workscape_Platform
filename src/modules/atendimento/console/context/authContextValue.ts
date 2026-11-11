import { createContext } from 'react'
import type { AgentUser } from '../types/domain'

/** Quem está logado no atendimento (vem do login do Workspace; o resto do contexto do painel não existe aqui). */
export interface AuthContextValue {
  user: AgentUser | null
  updateUser(user: AgentUser): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

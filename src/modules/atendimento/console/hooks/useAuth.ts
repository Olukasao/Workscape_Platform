import { useContext } from 'react'
import { AuthContext } from '../context/authContextValue'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro do provedor do Atendimento.')

  return context
}

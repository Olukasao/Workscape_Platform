// Substituto do cliente HTTP do painel: em vez de fetch + cookie, as chamadas vão pelo processo principal do Workspace
// (que guarda o token de atendimento e só aceita caminhos conhecidos). O resto do código copiado do painel não muda.
import { chamar } from '../../../chamar'

export class ApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

export class UnauthorizedError extends ApiError {
  constructor(payload?: unknown) {
    super('Sessão expirada. Faça login novamente.', 401, payload)
    this.name = 'UnauthorizedError'
  }
}

export function setAccessToken(_token: string | null): void {}
export function getAccessToken(): string | null {
  return null
}

interface ApiRequestOptions {
  method?: string
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  unwrap?: boolean
}

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if ('data' in record) return record.data as T
  }

  return payload as T
}

export async function apiRequest<T>(path: string, { method = 'GET', body, unwrap = true }: ApiRequestOptions = {}): Promise<T> {
  const [caminho = '', consulta = ''] = path.split('?')
  const query: Record<string, string> = {}
  new URLSearchParams(consulta).forEach((valor, chave) => { query[chave] = valor })
  const verbo = method.toUpperCase() as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

  try {
    const payload = await chamar<unknown>(verbo as never, caminho, { ...(Object.keys(query).length ? { query } : {}), ...(body !== undefined ? { body } : {}) })
    if (payload === null || payload === undefined) return undefined as T
    return unwrap ? unwrapData<T>(payload) : (payload as T)
  } catch (erro) {
    const texto = erro instanceof Error ? erro.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Erro inesperado.'
    if (/invalid_token|authorization_required|Sessão do atendimento expirada/i.test(texto)) throw new UnauthorizedError()
    throw new ApiError(texto, 400)
  }
}

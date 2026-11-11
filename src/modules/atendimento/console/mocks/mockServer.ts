// O modo de demonstração do painel não existe no Workspace. Este objeto só satisfaz as importações: qualquer uso acusa erro claro.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mockServer: Record<string, (...args: any[]) => any> = new Proxy({} as Record<string, (...args: any[]) => any>, {
  get: (_alvo, nome) => () => {
    throw new Error(`Modo de demonstração desligado (${String(nome)}).`)
  },
})

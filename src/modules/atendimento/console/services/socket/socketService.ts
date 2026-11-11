// Eventos em tempo real do painel, ligados aos eventos da chat-api que o processo principal do Workspace já recebe.
type Ouvinte = (dados: unknown) => void

export const chatSocket = {
  /** Escuta um evento da chat-api; devolve a função que cancela. */
  on(evento: string, ouvinte: Ouvinte): () => void {
    return window.desktop?.onAtendimento?.('atendimento:evento', ({ tipo, dados }: { tipo: string; dados: unknown }) => {
      if (tipo === evento) ouvinte(dados)
    }) ?? (() => undefined)
  },
}

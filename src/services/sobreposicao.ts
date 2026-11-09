import { create } from "zustand";

/** Camadas do app que precisam ficar acima das páginas nativas (Navegador, versão web da agenda). */
export const useSobreposicao = create<{ paleta: boolean; setPaleta: (aberta: boolean) => void; chamada: boolean; setChamada: (tocando: boolean) => void }>((set) => ({
  paleta: false,
  setPaleta: (paleta) => set({ paleta }),
  /** Chamada tocando: a faixa de atender fica na tela e a página nativa abre espaço para ela. */
  chamada: false,
  setChamada: (chamada) => set({ chamada }),
}));

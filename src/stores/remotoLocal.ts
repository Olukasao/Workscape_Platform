import { create } from "zustand";

/** ID e senha de acesso deste computador (gerados pelo próprio Workspace). Vivem só na memória desta janela. */
export const useRemotoLocal = create<{
  id: string;
  senha: string;
  /** O servidor de suporte já conhece este computador? null = ainda não sei. */
  registrado: boolean | null;
  /** O app está tentando consertar sozinho. */
  consertando: boolean;
  /** Por que o suporte remoto não iniciou neste computador (vazio se está tudo certo). */
  erro: string;
}>(() => ({ id: "", senha: "", registrado: null, consertando: false, erro: "" }));

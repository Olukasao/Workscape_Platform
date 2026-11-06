import { create } from "zustand";

/** ID e senha de acesso deste computador (gerados pelo próprio Workspace). Vivem só na memória desta janela. */
export const useRemotoLocal = create<{ id: string; senha: string }>(() => ({ id: "", senha: "" }));

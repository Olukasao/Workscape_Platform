import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Respostas prontas do Chat Interno: digitar "/nome" e apertar Espaço, Tab ou Enter troca pelo texto. */
export interface RespostaRapida { nome: string; texto: string }

export const NOME_VALIDO = /^[a-z0-9à-ÿ_-]{1,24}$/;
export const normalizarNome = (n: string) => n.trim().replace(/^\//, "").toLowerCase();

interface Store {
  respostas: RespostaRapida[];
  salvar: (r: RespostaRapida) => void;
  remover: (nome: string) => void;
}
export const useRespostasRapidas = create(
  persist<Store>(
    (set) => ({
      respostas: [],
      salvar: (r) => set((s) => {
        const nome = normalizarNome(r.nome);
        return { respostas: [...s.respostas.filter((x) => x.nome !== nome), { nome, texto: r.texto }].slice(0, 100) };
      }),
      remover: (nome) => set((s) => ({ respostas: s.respostas.filter((x) => x.nome !== nome) })),
    }),
    { name: "workspace-respostas-rapidas-v1" },
  ),
);

/** Se o texto antes do cursor termina em "/nome" de uma resposta salva, devolve onde começa e o texto a colocar. */
export function expansaoPara(antesDoCursor: string, respostas: RespostaRapida[]): { inicio: number; texto: string } | null {
  const m = /(^|\s)\/([a-z0-9à-ÿ_-]{1,24})$/i.exec(antesDoCursor);
  if (!m) return null;
  const achada = respostas.find((r) => r.nome === m[2].toLowerCase());
  if (!achada) return null;
  return { inicio: antesDoCursor.length - m[2].length - 1, texto: achada.texto };
}

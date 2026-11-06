import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Ações que a pessoa pode ligar a uma combinação de teclas. */
export interface AcaoAtalho { id: string; rotulo: string; grupo: "Telefone" | "Ir para" | "Chat Interno"; rota?: string }

export const ACOES_ATALHO: AcaoAtalho[] = [
  { id: "telefone", rotulo: "Abrir / fechar o telefone", grupo: "Telefone" },
  { id: "ir-inicio", rotulo: "Início", grupo: "Ir para", rota: "/" },
  { id: "ir-resumo", rotulo: "Resumo", grupo: "Ir para", rota: "/resumo" },
  { id: "ir-dashboard", rotulo: "Dashboard", grupo: "Ir para", rota: "/dashboard" },
  { id: "ir-ia", rotulo: "Inteligência Artificial", grupo: "Ir para", rota: "/assistente" },
  { id: "ir-lembretes", rotulo: "Lembretes", grupo: "Ir para", rota: "/lembretes" },
  { id: "ir-agenda", rotulo: "Agenda de Técnicos", grupo: "Ir para", rota: "/agenda" },
  { id: "ir-chamados", rotulo: "Chamados", grupo: "Ir para", rota: "/chamados" },
  { id: "ir-contratacoes", rotulo: "Contratações", grupo: "Ir para", rota: "/contratacoes" },
  { id: "ir-ferramentas", rotulo: "Ferramentas", grupo: "Ir para", rota: "/tools" },
  { id: "ir-terminal", rotulo: "Terminal", grupo: "Ir para", rota: "/terminal" },
  { id: "ir-navegador", rotulo: "Navegador", grupo: "Ir para", rota: "/navegador" },
  { id: "ir-configuracoes", rotulo: "Configurações", grupo: "Ir para", rota: "/settings" },
  { id: "chat", rotulo: "Abrir o Chat Interno", grupo: "Chat Interno", rota: "/chat" },
  { id: "chat-disparo", rotulo: "Chat Interno: Disparo", grupo: "Chat Interno", rota: "/chat?aba=disparo" },
];

/** Combinações que o app ou o sistema já usam: não podem ser redefinidas. */
const RESERVADAS = new Set([
  "Ctrl+K", "Ctrl+\\", "Ctrl+C", "Ctrl+V", "Ctrl+X", "Ctrl+A", "Ctrl+Z", "Ctrl+Y", "Ctrl+W", "Ctrl+R", "Ctrl+F",
  "Ctrl+0", "Ctrl+=", "Ctrl++", "Ctrl+-", "Ctrl+Shift+Z", "Ctrl+Shift+I", "Alt+F4", "Alt+Tab",
]);

const NOMES: Record<string, string> = { " ": "Espaço", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };

/** Transforma o evento numa combinação padronizada, ou null se ainda não é uma combinação válida (só modificador, sem Ctrl/Alt…). */
export function combinacaoDoEvento(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string | null {
  if (["Control", "Shift", "Alt", "Meta", "AltGraph", "Dead", "Unidentified"].includes(e.key)) return null;
  const funcao = /^F([1-9]|1[0-2])$/.test(e.key);
  const ctrl = e.ctrlKey || e.metaKey;
  if (!ctrl && !e.altKey && !funcao) return null;
  const tecla = NOMES[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return [ctrl && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", tecla].filter(Boolean).join("+");
}

export const combinacaoReservada = (c: string) => RESERVADAS.has(c);

interface AtalhosStore {
  /** id da ação -> combinação (ex.: "Ctrl+,"). */
  mapa: Record<string, string>;
  definir: (acao: string, combinacao: string) => void;
  remover: (acao: string) => void;
  limpar: () => void;
}
export const useAtalhos = create(
  persist<AtalhosStore>(
    (set) => ({
      mapa: {},
      definir: (acao, combinacao) => set((s) => {
        const mapa = Object.fromEntries(Object.entries(s.mapa).filter(([, c]) => c !== combinacao));
        return { mapa: { ...mapa, [acao]: combinacao } };
      }),
      remover: (acao) => set((s) => { const { [acao]: _, ...resto } = s.mapa; return { mapa: resto }; }),
      limpar: () => set({ mapa: {} }),
    }),
    { name: "workspace-atalhos-v1" },
  ),
);

/** A ação já ligada a essa combinação, se houver. */
export const acaoDaCombinacao = (mapa: Record<string, string>, combinacao: string) =>
  Object.entries(mapa).find(([, c]) => c === combinacao)?.[0];

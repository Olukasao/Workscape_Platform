// Regras puras da Agenda Financeira no cliente (formatação e filtros), sem rede nem Electron: testáveis à parte.
import type { Ocorrencia, Prioridade } from "./agendaFinanceira";

export function formatarEspera(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos)) return "—";
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  if (h < 24) return `${h}h${minutos % 60 ? ` ${minutos % 60}min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "dia" : "dias"}${h % 24 ? ` ${h % 24}h` : ""}`;
}

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = { normal: "Normal", atencao: "Atenção", urgente: "Urgente" };

export interface Filtros {
  colaboradora: string;
  status: string;
  prioridade: string;
  tipo: string;
  semResponsavel: boolean;
  busca: string;
  /** ids que a pesquisa do servidor achou (CPF/CNPJ); null = sem pesquisa de documento */
  idsDocumento: string[] | null;
}
export const FILTROS_VAZIOS: Filtros = { colaboradora: "", status: "", prioridade: "", tipo: "", semResponsavel: false, busca: "", idsDocumento: null };

const semAcento = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Aplica os filtros e a pesquisa (cliente, contrato, número, id; CPF/CNPJ vem pronto do servidor). */
export function passaNosFiltros(o: Ocorrencia, f: Filtros, coluna: string | null): boolean {
  if (f.colaboradora && (coluna ?? "fila") !== f.colaboradora) return false;
  if (f.status && o.statusRotulo !== f.status) return false;
  if (f.prioridade && o.prioridade !== f.prioridade) return false;
  if (f.tipo && o.tipo !== f.tipo) return false;
  if (f.semResponsavel && (o.responsavelUsuario || coluna)) return false;
  const q = semAcento(f.busca.trim());
  if (q) {
    const achouTexto = semAcento(o.cliente).includes(q) || String(o.contrato ?? "").includes(q) || o.numero.includes(q) || o.id.includes(q);
    const achouDoc = f.idsDocumento?.includes(o.id) ?? false;
    if (!achouTexto && !achouDoc) return false;
  }
  return true;
}

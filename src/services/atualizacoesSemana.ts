import { changelog, type ChangelogEntry } from "../changelog";

/** Segunda-feira (AAAA-MM-DD) da semana da data informada. */
export function inicioDaSemana(dia: string): string {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

/** Quantas versões do Workspace saíram na semana (segunda a domingo) da data informada, e quais. */
export function atualizacoesDaSemana(hoje: string, lista: ChangelogEntry[] = changelog) {
  const inicio = inicioDaSemana(hoje);
  const versoes = lista.filter((e) => e.data >= inicio && e.data <= hoje);
  return { total: versoes.length, versoes: versoes.map((e) => e.versao), inicio };
}

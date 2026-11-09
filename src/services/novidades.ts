import { changelog, type ChangelogEntry } from "../changelog";

const MAX_VERSOES = 3;

/** Versões mais novas que a última vista, da mais nova para a mais antiga; sem registro anterior, só a instalada. */
export function novidadesDesde(atual: string, vista: string | null, lista: ChangelogEntry[] = changelog): ChangelogEntry[] {
  const i = lista.findIndex((e) => e.versao === atual);
  if (i < 0) return [];
  const j = vista ? lista.findIndex((e) => e.versao === vista) : -1;
  if (j >= 0 && j <= i) return []; // já viu esta versão (ou uma mais nova)
  const fim = j > i ? j : i + 1;
  return lista.slice(i, Math.min(fim, i + MAX_VERSOES));
}


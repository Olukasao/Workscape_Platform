/**
 * O Workspace se atualiza e reinicia sozinho quando a pessoa fica parada (e quando abre depois de fechar): voltava sempre ao Início.
 * Guarda a última tela e, ao abrir no Início, devolve a pessoa para ela (dentro de 12 horas).
 */
export const CHAVE_ULTIMA_ROTA = "workspace:ultima-rota";
const VALIDADE_MS = 12 * 3600_000;

export type RotaGuardada = { caminho: string; em: number };

/** Só caminhos internos do app (começam com uma barra, sem "//" nem endereço externo). */
export const caminhoSeguro = (c: unknown): c is string => typeof c === "string" && /^\/(?!\/)[\w\-./?=&%]*$/.test(c) && c.length <= 300;

export function serializarRota(caminho: string, agora = Date.now()): string | null {
  return caminhoSeguro(caminho) ? JSON.stringify({ caminho, em: agora } satisfies RotaGuardada) : null;
}

/** Onde a pessoa estava, se ela abriu o app no Início e a última tela guardada é recente e válida; senão null. */
export function rotaParaRestaurar(bruto: string | null, rotaAtual: string, agora = Date.now()): string | null {
  if (rotaAtual !== "/" || !bruto) return null;
  try {
    const v = JSON.parse(bruto) as Partial<RotaGuardada>;
    if (!caminhoSeguro(v.caminho) || v.caminho === "/" || typeof v.em !== "number" || agora - v.em > VALIDADE_MS || v.em > agora + 60_000) return null;
    return v.caminho;
  } catch {
    return null;
  }
}

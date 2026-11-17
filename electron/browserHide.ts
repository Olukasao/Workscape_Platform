/**
 * Quem pediu para esconder a página nativa (Navegador ou versão web da agenda) só pode esconder a SUA.
 * Sem isso, a agenda que sai de cena (e se esconde um instante depois) apagava a página do Navegador que acabou de aparecer,
 * e o contrário também. Sem `somente`, esconde qualquer uma (uso do processo principal).
 */
export type EscopoEsconder = "agendaweb" | "escritorio" | "navegador";
export const deveEsconder = (atual: string | null, somente?: EscopoEsconder): boolean => {
  if (!atual) return false;
  if (somente === "agendaweb") return atual === "agendaweb";
  if (somente === "escritorio") return atual === "escritorio";
  if (somente === "navegador") return atual !== "agendaweb" && atual !== "escritorio";
  return true;
};

/**
 * Vigia da página nativa do Navegador: enquanto a tela quer a página visível ela avisa a cada segundo (browser:show).
 * Se o aviso para por mais que `LEASE_MS`, a página é escondida sozinha, mesmo que o pedido de esconder tenha se perdido.
 * A agenda web e o Escritório não enviam o sinal (não entram no vigia).
 */
export const LEASE_MS = 4000;
export const precisaDeSinal = (site: string | null) => site !== null && site !== "agendaweb" && site !== "escritorio";
export const sinalVencido = (site: string | null, agora: number, ultimoSinal: number, ttl = LEASE_MS) => precisaDeSinal(site) && agora - ultimoSinal > ttl;

/** A página nativa nunca passa da área de conteúdo da janela (medida errada não pode cobrir o app inteiro nem sair da tela). */
export const limitarAoConteudo = (b: { x: number; y: number; width: number; height: number }, larguraJanela: number, alturaJanela: number) => {
  const x = Math.min(Math.max(0, b.x), Math.max(0, larguraJanela));
  const y = Math.min(Math.max(0, b.y), Math.max(0, alturaJanela));
  return { x, y, width: Math.max(0, Math.min(b.width, larguraJanela - x)), height: Math.max(0, Math.min(b.height, alturaJanela - y)) };
};

/**
 * Rotas do Workspace (#/rota) em que existe uma página nativa por cima do app: Navegador, versão web da agenda (dentro de /agenda)
 * e Escritório. Em qualquer outra rota nenhuma página nativa pode ficar visível: o processo principal esconde sozinho ao ver a
 * rota mudar (não depende do pedido da tela, que pode se perder ou chegar fora de ordem).
 */
const ROTAS_COM_PAGINA_NATIVA = new Set(["/navegador", "/agenda", "/escritorio"]);
export const rotaComPaginaNativa = (url: string): boolean => {
  const hash = String(url ?? "").split("#")[1] ?? "";
  const caminho = hash.split("?")[0].replace(/\/+$/, "") || "/";
  return ROTAS_COM_PAGINA_NATIVA.has(caminho);
};

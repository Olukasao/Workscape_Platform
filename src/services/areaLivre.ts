/** Retângulo em pixels CSS da janela do app. */
export type Ret = { x: number; y: number; width: number; height: number };

/**
 * Elementos que flutuam sobre o app e precisam ficar VISÍVEIS por cima das páginas nativas (Navegador, agenda web): o painel do
 * telefone, o aviso de chamada recebida, o painel e a bolha do assistente. A página nativa nunca fica "por baixo" de nada, então
 * em vez de cobri-los ela é encolhida para a maior área que sobra, e acompanha quando a pessoa arrasta o painel.
 */
export const SELETOR_FLUTUANTES = ".telefone-card:not(.embutido), .chamada-recebida, .assistente-painel-flutuante, .assistente-bolha";

const cruza = (a: Ret, b: Ret) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const area = (r: Ret) => r.width * r.height;

/**
 * Maior retângulo da `area` que não encosta em nenhum dos `obstaculos` (com uma folga). Cada obstáculo corta a área pelo lado que
 * deixa mais espaço (esquerda, direita, acima ou abaixo). Se sobrar pouco (menos que o mínimo), devolve uma área vazia: a página
 * fica sem espaço útil e não deve cobrir o obstáculo.
 */
export function maiorAreaLivre(base: Ret, obstaculos: Ret[], folga = 8, minimo = { width: 280, height: 180 }): Ret {
  let livre = base;
  for (const o of obstaculos) {
    if (!cruza(livre, o)) continue;
    const direita = livre.x + livre.width;
    const embaixo = livre.y + livre.height;
    const candidatas: Ret[] = [
      { x: livre.x, y: livre.y, width: o.x - folga - livre.x, height: livre.height },
      { x: o.x + o.width + folga, y: livre.y, width: direita - (o.x + o.width + folga), height: livre.height },
      { x: livre.x, y: livre.y, width: livre.width, height: o.y - folga - livre.y },
      { x: livre.x, y: o.y + o.height + folga, width: livre.width, height: embaixo - (o.y + o.height + folga) },
    ].map((c) => ({ ...c, width: Math.max(0, c.width), height: Math.max(0, c.height) }));
    livre = candidatas.reduce((melhor, c) => (area(c) > area(melhor) ? c : melhor));
  }
  return livre.width < minimo.width || livre.height < minimo.height ? { x: base.x, y: base.y, width: 0, height: 0 } : livre;
}

const visivel = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
};

/** Área da página nativa dentro de `el`, já desviando dos painéis flutuantes que estiverem na tela. null = elemento ainda não existe. */
export function medirAreaLivre(el: HTMLElement | null): Ret | null {
  const r = el?.getBoundingClientRect();
  if (!r) return null;
  const base = { x: r.x, y: r.y, width: r.width, height: r.height };
  const obstaculos = Array.from(document.querySelectorAll(SELETOR_FLUTUANTES))
    .filter(visivel)
    .map((e) => {
      const b = e.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    });
  return obstaculos.length ? maiorAreaLivre(base, obstaculos) : base;
}

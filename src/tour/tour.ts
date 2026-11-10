import { create } from "zustand";

// Tour guiado: destaca partes da tela e explica cada uma, passo a passo. Esta parte não desenha nada:
// tem o formato dos passos, a conta de onde colocar o balão e a memória de "já viu".

export type Lado = "auto" | "cima" | "baixo" | "esquerda" | "direita";
export interface PassoTour {
  id: string;
  /** Valor do atributo data-tour do elemento a destacar. Sem ele, o balão aparece no centro. */
  alvo?: string;
  /** Tela onde o passo acontece; o tour navega até ela antes de mostrar. */
  rota?: string;
  titulo: string;
  texto: string;
  /** Se o elemento não existir (recurso desligado ou sem permissão), o passo é pulado em vez de aparecer vazio. */
  opcional?: boolean;
  lado?: Lado;
}

export interface Retangulo { x: number; y: number; w: number; h: number }
export interface PosicaoBalao { top: number; left: number; lado: Exclude<Lado, "auto"> | "centro"; seta: number }

const MARGEM = 12;

/** Fator de zoom aplicado por CSS na página (a pré-visualização web usa isso; o app Windows usa zoom nativo e dá 1). */
export function fatorZoomCss(): number {
  try {
    const z = parseFloat(getComputedStyle(document.documentElement).zoom);
    return Number.isFinite(z) && z > 0 ? z : 1;
  } catch {
    return 1;
  }
}

/** Retângulo medido na tela (pixels visuais) em pixels do CSS, que é onde o recorte e o balão são desenhados. */
export const paraPixelsCss = (r: Retangulo, zoom: number): Retangulo =>
  zoom === 1 ? r : { x: r.x / zoom, y: r.y / zoom, w: r.w / zoom, h: r.h / zoom };

/** Onde colocar o balão em volta do elemento destacado, sem sair da tela. `seta` é o deslocamento da ponta do balão. */
export function posicionarBalao(
  alvo: Retangulo | null,
  balao: { w: number; h: number },
  tela: { w: number; h: number },
  lado: Lado = "auto",
  folga = 14,
): PosicaoBalao {
  const centro = (): PosicaoBalao => ({ top: Math.max(MARGEM, (tela.h - balao.h) / 2), left: Math.max(MARGEM, (tela.w - balao.w) / 2), lado: "centro", seta: 0 });
  if (!alvo) return centro();
  const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(v, Math.max(min, max)));
  const cx = alvo.x + alvo.w / 2, cy = alvo.y + alvo.h / 2;
  const candidatos: Record<Exclude<Lado, "auto">, { top: number; left: number; cabe: boolean; espaco: number }> = {
    baixo: { top: alvo.y + alvo.h + folga, left: cx - balao.w / 2, cabe: alvo.y + alvo.h + folga + balao.h <= tela.h - MARGEM, espaco: tela.h - (alvo.y + alvo.h) },
    cima: { top: alvo.y - folga - balao.h, left: cx - balao.w / 2, cabe: alvo.y - folga - balao.h >= MARGEM, espaco: alvo.y },
    direita: { top: cy - balao.h / 2, left: alvo.x + alvo.w + folga, cabe: alvo.x + alvo.w + folga + balao.w <= tela.w - MARGEM, espaco: tela.w - (alvo.x + alvo.w) },
    esquerda: { top: cy - balao.h / 2, left: alvo.x - folga - balao.w, cabe: alvo.x - folga - balao.w >= MARGEM, espaco: alvo.x },
  };
  const ordem: Exclude<Lado, "auto">[] = lado === "auto" ? ["baixo", "cima", "direita", "esquerda"] : [lado, "baixo", "cima", "direita", "esquerda"];
  const escolhido = ordem.find((l) => candidatos[l].cabe)
    // Nenhum lado cabe inteiro (elemento muito grande): usa o lado com mais espaço, sobre o próprio elemento.
    ?? ordem.reduce((a, b) => (candidatos[b].espaco > candidatos[a].espaco ? b : a));
  const c = candidatos[escolhido];
  const horizontal = escolhido === "cima" || escolhido === "baixo";
  const left = limitar(c.left, MARGEM, tela.w - balao.w - MARGEM);
  const top = limitar(c.top, MARGEM, tela.h - balao.h - MARGEM);
  const seta = horizontal ? limitar(cx - left, 18, balao.w - 18) : limitar(cy - top, 18, balao.h - 18);
  return { top, left, lado: escolhido, seta };
}

/** Próximo passo que existe, andando para frente (1) ou para trás (-1), ignorando os que não têm elemento. */
export function vizinho(passos: PassoTour[], atual: number, direcao: 1 | -1, existe: (p: PassoTour) => boolean): number {
  for (let i = atual + direcao; i >= 0 && i < passos.length; i += direcao) {
    const p = passos[i];
    if (!p.opcional || existe(p)) return i;
  }
  return -1;
}

/** Tours que nunca são obrigatórios: quem quiser pode pular desde a primeira vez. */
export const TOURS_PULAVEIS = new Set(["bgp-v1"]);

const chave = (tour: string, usuario: string | number, tipo: "visto" | "convite") => `workspace-tour:${tour}:${tipo}:${usuario}`;
export const jaViu = (tour: string, usuario: string | number, tipo: "visto" | "convite" = "visto") => {
  try { return localStorage.getItem(chave(tour, usuario, tipo)) === "1"; } catch { return false; }
};
export const marcarVisto = (tour: string, usuario: string | number, tipo: "visto" | "convite" = "visto") => {
  try { localStorage.setItem(chave(tour, usuario, tipo), "1"); } catch { /* vale só nesta sessão */ }
};

interface EstadoTour {
  ativo: { id: string; passos: PassoTour[] } | null;
  passo: number;
  iniciar: (id: string, passos: PassoTour[]) => void;
  ir: (n: number) => void;
  encerrar: () => void;
}
export const useTour = create<EstadoTour>((set) => ({
  ativo: null,
  passo: 0,
  iniciar: (id, passos) => set({ ativo: passos.length ? { id, passos } : null, passo: 0 }),
  ir: (passo) => set({ passo }),
  encerrar: () => set({ ativo: null, passo: 0 }),
}));

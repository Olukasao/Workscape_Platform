// Comemoração de venda: fogos de artifício em um canvas 2D transparente por cima do app.
// Cada fogo sobe da base da tela deixando um rastro de faíscas, explode em um desenho (peônia, anel, salgueiro
// ou estrela) e as brasas caem com a gravidade. Se desmonta sozinho ao terminar.

const CORES = ["#3ad6ff", "#2f6bff", "#22c55e", "#facc15", "#ff7a1a", "#ec4899", "#a78bfa", "#ffffff"];
const DOURADO = "#ffd36a";
const DURACAO_LANCAMENTOS = 3.6; // segundos em que ainda saem fogos novos
const DURACAO_MAX = 8.5; // limite de segurança
const MAX_PARTICULAS = 2200;

export type TipoFogo = "peonia" | "anel" | "salgueiro" | "estrela";
export interface Lancamento {
  /** Instante do disparo, em segundos. */
  em: number;
  /** Posição horizontal e altura do estouro, em fração da tela (0 a 1). */
  x: number;
  alvoY: number;
  tipo: TipoFogo;
  cor: string;
  /** Segundos de subida até o estouro. */
  subida: number;
}

/** Quantos fogos para um certo número de vendas: poucos para 1 venda, mais para várias, com limite. */
export const quantidadeDeFogos = (vendas: number) => Math.min(16, Math.max(6, 5 + Math.round(vendas) * 2));

/**
 * Sorteia o roteiro dos fogos. `rng` é injetável para os testes.
 * `opcoes.quantidade` substitui o cálculo pelas vendas (comemorações maiores, como a de uma atualização);
 * `opcoes.duracaoLancamentos` estica a janela em que eles saem, para uma quantidade grande não virar um amontoado.
 */
export function planejarFogos(
  vendas: number,
  rng: () => number = Math.random,
  opcoes: { quantidade?: number; duracaoLancamentos?: number } = {},
): Lancamento[] {
  const n = opcoes.quantidade ?? quantidadeDeFogos(vendas);
  const duracaoLancamentos = opcoes.duracaoLancamentos ?? DURACAO_LANCAMENTOS;
  const tipos: TipoFogo[] = ["peonia", "anel", "salgueiro", "estrela"];
  const lista: Lancamento[] = [];
  for (let i = 0; i < n; i++) {
    const tipo = tipos[Math.floor(rng() * tipos.length)];
    lista.push({
      em: (i / n) * duracaoLancamentos + rng() * 0.25,
      // Espalha pela largura, evitando as bordas.
      x: 0.1 + rng() * 0.8,
      alvoY: 0.16 + rng() * 0.3,
      tipo,
      cor: tipo === "salgueiro" ? DOURADO : CORES[Math.floor(rng() * CORES.length)],
      subida: 0.85 + rng() * 0.45,
    });
  }
  return lista.sort((a, b) => a.em - b.em);
}

interface Particula {
  x: number; y: number; vx: number; vy: number;
  vida: number; max: number; cor: string; raio: number;
  arrasto: number; gravidade: number; brilha: boolean;
}

/** Cria as brasas de uma explosão. Velocidades em pixels por segundo. */
export function criarExplosao(l: Pick<Lancamento, "tipo" | "cor">, x: number, y: number, escala: number, rng: () => number = Math.random): Particula[] {
  const out: Particula[] = [];
  const base = (v: number) => v * escala;
  const add = (angulo: number, vel: number, extra: Partial<Particula> = {}) => out.push({
    x, y, vx: Math.cos(angulo) * vel, vy: Math.sin(angulo) * vel,
    vida: 0, max: 1.1 + rng() * 0.7, cor: l.cor, raio: 1.4 + rng() * 1.2,
    arrasto: 1.6, gravidade: base(75), brilha: true, ...extra,
  });
  switch (l.tipo) {
    case "anel": {
      const n = 64;
      for (let i = 0; i < n; i++) add((i / n) * Math.PI * 2, base(250), { max: 1.3 + rng() * 0.3 });
      // Miolo menor, de outra cor, para o anel parecer um desenho e não um círculo vazio.
      for (let i = 0; i < 24; i++) add((i / 24) * Math.PI * 2 + 0.13, base(120), { cor: "#ffffff", max: 1 });
      break;
    }
    case "salgueiro": {
      const n = 90;
      for (let i = 0; i < n; i++) add(rng() * Math.PI * 2, base(70 + rng() * 190), { max: 2 + rng() * 0.9, arrasto: 1.1, gravidade: base(95), raio: 1.2 + rng() });
      break;
    }
    case "estrela": {
      // Cinco pontas: a velocidade varia com o ângulo, fazendo o desenho de estrela.
      const n = 110;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const pico = 0.55 + 0.45 * Math.abs(Math.cos((a + Math.PI / 2) * 2.5));
        add(a, base(270 * pico), { max: 1.2 + rng() * 0.3 });
      }
      break;
    }
    default: {
      const n = 110;
      for (let i = 0; i < n; i++) add(rng() * Math.PI * 2, base(60 + rng() * 240), { max: 1.1 + rng() * 0.8 });
    }
  }
  // Algumas faíscas brancas que estalam por último.
  for (let i = 0; i < 10; i++) add(rng() * Math.PI * 2, base(40 + rng() * 120), { cor: "#ffffff", max: 1.6 + rng() * 0.6, raio: 1 });
  return out;
}

export function iniciarFogos(
  alvo: HTMLElement,
  vendas: number,
  aoTerminar: () => void = () => undefined,
  opcoes: { quantidade?: number; duracaoLancamentos?: number; duracaoMax?: number } = {},
): () => void {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  alvo.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    aoTerminar();
    return () => undefined;
  }
  let largura = 0, altura = 0, dpr = 1;
  const medir = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    largura = alvo.clientWidth || window.innerWidth;
    altura = alvo.clientHeight || window.innerHeight;
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  medir();
  const observador = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
  observador?.observe(alvo);

  const roteiro = planejarFogos(vendas, Math.random, opcoes);
  const duracaoMax = opcoes.duracaoMax ?? DURACAO_MAX;
  let proximo = 0;
  const subindo: { l: Lancamento; x0: number; t: number; x: number; y: number }[] = [];
  let particulas: Particula[] = [];
  let ultimo = performance.now();
  let t = 0;
  let quadro = 0;
  let encerrado = false;

  const faisca = (x: number, y: number, vx: number, vy: number, cor: string) => {
    if (particulas.length >= MAX_PARTICULAS) return;
    particulas.push({ x, y, vx, vy, vida: 0, max: 0.35 + Math.random() * 0.25, cor, raio: 1, arrasto: 2.5, gravidade: 40, brilha: false });
  };

  const encerrar = () => {
    if (encerrado) return;
    encerrado = true;
    cancelAnimationFrame(quadro);
    observador?.disconnect();
    canvas.remove();
    aoTerminar();
  };

  const passo = (agora: number) => {
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    t += dt;
    const escala = Math.max(0.6, Math.min(1.4, Math.min(largura, altura * 1.4) / 900));

    // Lançamentos agendados.
    while (proximo < roteiro.length && roteiro[proximo].em <= t) {
      const l = roteiro[proximo++];
      subindo.push({ l, x0: l.x * largura + (Math.random() - 0.5) * 80, t: 0, x: 0, y: altura });
    }
    // Subida: curva suave até o ponto do estouro.
    for (let i = subindo.length - 1; i >= 0; i--) {
      const f = subindo[i];
      f.t += dt;
      const p = Math.min(1, f.t / f.l.subida);
      const ease = 1 - Math.pow(1 - p, 2.2);
      f.x = f.x0 + (f.l.x * largura - f.x0) * ease;
      f.y = altura + (f.l.alvoY * altura - altura) * ease;
      faisca(f.x + (Math.random() - 0.5) * 3, f.y, (Math.random() - 0.5) * 30, 40 + Math.random() * 50, "#ffd9a0");
      if (p >= 1) {
        const novas = criarExplosao(f.l, f.x, f.y, escala);
        for (const n of novas) if (particulas.length < MAX_PARTICULAS) particulas.push(n);
        subindo.splice(i, 1);
      }
    }

    // Rastro: apaga um pouco do quadro anterior em vez de limpar tudo.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, largura, altura);
    ctx.globalCompositeOperation = "lighter";

    for (const f of subindo) {
      ctx.fillStyle = "#fff6dd";
      ctx.beginPath();
      ctx.arc(f.x, f.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    particulas = particulas.filter((p) => {
      p.vida += dt;
      if (p.vida >= p.max) return false;
      const k = Math.exp(-p.arrasto * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravidade * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const restante = 1 - p.vida / p.max;
      // No fim da vida as brasas piscam, como faíscas de verdade.
      const piscar = p.brilha && restante < 0.3 ? 0.55 + 0.45 * Math.sin(p.vida * 60) : 1;
      ctx.globalAlpha = Math.max(0, restante) * piscar;
      ctx.fillStyle = p.cor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.raio * (0.6 + 0.4 * restante), 0, Math.PI * 2);
      ctx.fill();
      return p.y < altura + 20;
    });
    ctx.globalAlpha = 1;

    const terminou = proximo >= roteiro.length && subindo.length === 0 && particulas.length === 0;
    if (terminou || t > duracaoMax) {
      encerrar();
      return;
    }
    quadro = requestAnimationFrame(passo);
  };
  quadro = requestAnimationFrame(passo);
  return encerrar;
}

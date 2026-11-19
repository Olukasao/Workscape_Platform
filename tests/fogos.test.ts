import { describe, expect, it } from "vitest";
import { criarExplosao, planejarFogos, quantidadeDeFogos } from "../src/components/celebracao/fogosScene";

// Gerador previsível para os testes.
const semente = (n = 1) => () => { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646; };

describe("fogos de artifício da comemoração de venda", () => {
  it("a quantidade de fogos cresce com as vendas, com mínimo e máximo", () => {
    expect(quantidadeDeFogos(1)).toBe(7);
    expect(quantidadeDeFogos(3)).toBe(11);
    expect(quantidadeDeFogos(0)).toBe(6);
    expect(quantidadeDeFogos(100)).toBe(16);
  });

  it("o roteiro fica em ordem, dentro da tela e dentro do tempo de lançamento", () => {
    const roteiro = planejarFogos(5, semente(7));
    expect(roteiro).toHaveLength(quantidadeDeFogos(5));
    for (let i = 1; i < roteiro.length; i++) expect(roteiro[i].em).toBeGreaterThanOrEqual(roteiro[i - 1].em);
    for (const l of roteiro) {
      expect(l.x).toBeGreaterThanOrEqual(0.1);
      expect(l.x).toBeLessThanOrEqual(0.9);
      expect(l.alvoY).toBeGreaterThanOrEqual(0.16);
      expect(l.alvoY).toBeLessThanOrEqual(0.46);
      expect(l.em).toBeLessThan(4);
      expect(l.subida).toBeGreaterThan(0.8);
      expect(["peonia", "anel", "salgueiro", "estrela"]).toContain(l.tipo);
    }
  });

  it("cada tipo de explosão gera brasas partindo do ponto do estouro, com vida finita", () => {
    for (const tipo of ["peonia", "anel", "salgueiro", "estrela"] as const) {
      const brasas = criarExplosao({ tipo, cor: "#3ad6ff" }, 400, 200, 1, semente(3));
      expect(brasas.length).toBeGreaterThan(60);
      for (const b of brasas) {
        expect(b.x).toBe(400);
        expect(b.y).toBe(200);
        expect(b.max).toBeGreaterThan(0);
        expect(Number.isFinite(b.vx) && Number.isFinite(b.vy)).toBe(true);
      }
    }
  });

  it("o anel solta as brasas em todas as direções (desenho simétrico)", () => {
    const brasas = criarExplosao({ tipo: "anel", cor: "#fff" }, 0, 0, 1, semente(5)).slice(0, 64);
    const soma = brasas.reduce((a, b) => ({ x: a.x + b.vx, y: a.y + b.vy }), { x: 0, y: 0 });
    expect(Math.abs(soma.x)).toBeLessThan(1);
    expect(Math.abs(soma.y)).toBeLessThan(1);
  });

  it("a escala da tela muda a velocidade das brasas", () => {
    const pequena = criarExplosao({ tipo: "anel", cor: "#fff" }, 0, 0, 0.6, semente(2))[0];
    const grande = criarExplosao({ tipo: "anel", cor: "#fff" }, 0, 0, 1.4, semente(2))[0];
    expect(Math.hypot(grande.vx, grande.vy)).toBeGreaterThan(Math.hypot(pequena.vx, pequena.vy));
  });

  it("uma comemoração maior (quantidade/duração fixas) ignora o cálculo pelas vendas", () => {
    const roteiro = planejarFogos(0, semente(4), { quantidade: 46, duracaoLancamentos: 7.5 });
    expect(roteiro).toHaveLength(46);
    expect(roteiro.at(-1)!.em).toBeLessThan(7.75); // dentro da janela de lançamento + a folga de cada disparo
    for (const l of roteiro) {
      expect(l.x).toBeGreaterThanOrEqual(0.1);
      expect(l.x).toBeLessThanOrEqual(0.9);
    }
  });
});

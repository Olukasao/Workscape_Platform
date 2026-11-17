import { describe, expect, it } from "vitest";
import { maiorAreaLivre } from "../src/services/areaLivre";

const area = { x: 200, y: 80, width: 1000, height: 700 };

describe("página nativa desvia dos painéis flutuantes", () => {
  it("sem obstáculo, a área é a inteira", () => {
    expect(maiorAreaLivre(area, [])).toEqual(area);
  });
  it("obstáculo fora da área não mexe em nada", () => {
    expect(maiorAreaLivre(area, [{ x: 0, y: 0, width: 150, height: 600 }])).toEqual(area);
  });
  it("painel do telefone no canto direito: a página encolhe pela esquerda dele", () => {
    const telefone = { x: 900, y: 120, width: 280, height: 420 };
    const livre = maiorAreaLivre(area, [telefone]);
    expect(livre.x).toBe(200);
    expect(livre.x + livre.width).toBeLessThanOrEqual(telefone.x - 8);
    expect(livre.height).toBe(700);
  });
  it("painel no canto esquerdo: a página começa depois dele", () => {
    const telefone = { x: 210, y: 120, width: 280, height: 420 };
    const livre = maiorAreaLivre(area, [telefone]);
    expect(livre.x).toBeGreaterThanOrEqual(telefone.x + telefone.width + 8);
    expect(livre.x + livre.width).toBe(1200);
  });
  it("faixa de chamada no topo: a página começa abaixo dela", () => {
    const faixa = { x: 300, y: 85, width: 700, height: 60 };
    const livre = maiorAreaLivre(area, [faixa]);
    expect(livre.y).toBeGreaterThanOrEqual(faixa.y + faixa.height + 8);
    expect(livre.width).toBe(1000);
  });
  it("nunca cruza nenhum obstáculo (telefone + aviso de chamada + bolha)", () => {
    const obst = [{ x: 900, y: 120, width: 280, height: 420 }, { x: 250, y: 85, width: 500, height: 60 }, { x: 1150, y: 700, width: 48, height: 48 }];
    const livre = maiorAreaLivre(area, obst);
    for (const o of obst) {
      const cruza = livre.width > 0 && livre.x < o.x + o.width && o.x < livre.x + livre.width && livre.y < o.y + o.height && o.y < livre.y + livre.height;
      expect(cruza).toBe(false);
    }
    expect(livre.width).toBeGreaterThan(0);
  });
  it("se sobrar pouco espaço, não cobre o painel: área vazia", () => {
    const enorme = { x: 200, y: 80, width: 950, height: 690 };
    expect(maiorAreaLivre(area, [enorme])).toEqual({ x: 200, y: 80, width: 0, height: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { LEASE_MS, limitarAoConteudo, precisaDeSinal, sinalVencido } from "../electron/browserHide";

describe("vigia da página nativa do Navegador", () => {
  it("só os sites do Navegador precisam do sinal; agenda web e Escritório não", () => {
    expect(precisaDeSinal("sgp")).toBe(true);
    expect(precisaDeSinal("zabbix")).toBe(true);
    expect(precisaDeSinal("agendaweb")).toBe(false);
    expect(precisaDeSinal("escritorio")).toBe(false);
    expect(precisaDeSinal(null)).toBe(false);
  });
  it("esconde quando o sinal para por mais que o prazo, e não antes", () => {
    const t0 = 1_000_000;
    expect(sinalVencido("sgp", t0 + 1000, t0)).toBe(false); // sinal a cada 1 s
    expect(sinalVencido("sgp", t0 + LEASE_MS, t0)).toBe(false);
    expect(sinalVencido("sgp", t0 + LEASE_MS + 1, t0)).toBe(true);
    expect(sinalVencido("agendaweb", t0 + 60_000, t0)).toBe(false);
    expect(sinalVencido(null, t0 + 60_000, t0)).toBe(false);
  });
});

describe("limites da página nativa", () => {
  it("medida correta passa como está", () => {
    expect(limitarAoConteudo({ x: 200, y: 80, width: 1000, height: 700 }, 1280, 800)).toEqual({ x: 200, y: 80, width: 1000, height: 700 });
  });
  it("medida maior que a janela é cortada (não cobre nem sai da tela)", () => {
    expect(limitarAoConteudo({ x: 200, y: 80, width: 5000, height: 5000 }, 1280, 800)).toEqual({ x: 200, y: 80, width: 1080, height: 720 });
    expect(limitarAoConteudo({ x: -50, y: -10, width: 300, height: 300 }, 1280, 800)).toEqual({ x: 0, y: 0, width: 300, height: 300 });
    expect(limitarAoConteudo({ x: 2000, y: 900, width: 300, height: 300 }, 1280, 800)).toEqual({ x: 1280, y: 800, width: 0, height: 0 });
  });
});

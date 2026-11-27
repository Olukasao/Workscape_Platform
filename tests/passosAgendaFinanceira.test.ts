import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ehDoFinanceiro, IDS_FINANCEIRO, passosTourAgendaFinanceira } from "../src/tour/passosAgendaFinanceira";
import { TOURS_PULAVEIS } from "../src/tour/tour";

const fonte = (arquivo: string) => readFileSync(new URL(`../src/${arquivo}`, import.meta.url), "utf8");
const codigo = [fonte("modules/agenda/AgendaFinanceira.tsx"), fonte("modules/Agenda.tsx")].join("\n");

describe("tour da Agenda Financeira", () => {
  it("passos com ids únicos, texto e todos os alvos existem na tela", () => {
    const ids = passosTourAgendaFinanceira.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of passosTourAgendaFinanceira) {
      expect(p.titulo.length).toBeGreaterThan(5);
      expect(p.texto.length).toBeGreaterThan(30);
      expect(p.rota).toBe("/agenda");
      if (p.alvo) expect(codigo, `${p.id}: data-tour="${p.alvo}" não existe`).toMatch(new RegExp(`data-tour=(\\{[^}]*)?["']${p.alvo}["']`));
    }
  });
  it("os passos do modo Agenda começam com af-ag- (a tela troca de modo por eles)", () => {
    const ag = passosTourAgendaFinanceira.filter((p) => p.id.startsWith("af-ag-")).map((p) => p.alvo);
    expect(ag).toEqual(["af-modo", "af-grade", "af-periodo"]);
    // o seletor de modo é mostrado nos dois modos; a grade e o período só no modo Agenda
    expect(passosTourAgendaFinanceira.find((p) => p.id === "af-historico")).toBeTruthy();
  });
  it("não é obrigatório e quem recebe o convite automático é do financeiro, admin ou coordenador", () => {
    expect(TOURS_PULAVEIS.has("agenda-financeira-v1")).toBe(true);
    expect(IDS_FINANCEIRO).toEqual([13, 18, 21, 22]);
    expect(ehDoFinanceiro({ id: 22, perfil: "usuario" })).toBe(true);
    expect(ehDoFinanceiro({ id: 3, perfil: "admin" })).toBe(true);
    expect(ehDoFinanceiro({ id: 50, perfil: "Coordenador de campo" })).toBe(true);
    expect(ehDoFinanceiro({ id: 50, perfil: "usuario" })).toBe(false);
    expect(ehDoFinanceiro(null)).toBe(false);
  });
});

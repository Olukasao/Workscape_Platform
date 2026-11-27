import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { passosTourRede, TOUR_REDE } from "../src/tour/passosRede";
import { TOURS_PULAVEIS } from "../src/tour/tour";

const fonte = (arquivo: string) => readFileSync(new URL(`../src/${arquivo}`, import.meta.url), "utf8");
const codigo = [fonte("modules/RedeOlt.tsx"), fonte("modules/rede/Analises.tsx"), fonte("app/App.tsx"), fonte("app/shell/Sidebar.tsx")].join("\n");

describe("tour da Rede (OLT)", () => {
  it("passos com ids únicos, texto, na rota /rede e com alvos que existem na tela", () => {
    const ids = passosTourRede.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of passosTourRede) {
      expect(p.titulo.length).toBeGreaterThan(5);
      expect(p.texto.length).toBeGreaterThan(30);
      expect(p.rota).toBe("/rede");
      if (p.alvo === "nav-rede") continue; // o menu monta o data-tour a partir do caminho (nav-rede)
      if (p.alvo) expect(codigo, `${p.id}: data-tour="${p.alvo}" não existe`).toMatch(new RegExp(`(data-tour=(\\{[^}]*)?["']${p.alvo}["'])|t\\("${p.alvo}"\\)`));
    }
  });
  it("os passos rede-ab-* correspondem a abas que existem (a tela troca de aba por eles)", () => {
    const abas = fonte("modules/rede/Analises.tsx").match(/\["(\w+)", "[^"]+"\]/g)?.map((x) => x.slice(2, x.indexOf('"', 2))) ?? [];
    for (const p of passosTourRede.filter((x) => x.id.startsWith("rede-ab-"))) expect(abas).toContain(p.id.slice(8));
    expect(passosTourRede.filter((p) => p.id.startsWith("rede-ab-")).length).toBe(4);
  });
  it("só os passos que dependem de um alerta aberto são opcionais; o tour não é obrigatório", () => {
    expect(TOURS_PULAVEIS.has(TOUR_REDE)).toBe(true);
    const obrigatorios = passosTourRede.filter((p) => !p.opcional).map((p) => p.id);
    expect(obrigatorios).toContain("rede-menu");
    expect(obrigatorios).toContain("rede-abas");
  });
});

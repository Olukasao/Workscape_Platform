import { describe, expect, it } from "vitest";
import { textoDoAvisoMarketing } from "../src/services/marketingWifiTexto";

const lead = (id: string, nome = "Maria S.", rede = "Acessanet EcoParque") => ({ id, nome, rede, quando: "2026-11-18T18:05:42.278Z" });

describe("aviso de marketing do Wi-Fi público", () => {
  it("um dado novo usa o texto pedido, com nome abreviado e a rede", () => {
    expect(textoDoAvisoMarketing([lead("a")])).toEqual({ title: "Novo Dados de marketing obtidos por wifi-publico!", body: "Maria S. — Acessanet EcoParque" });
  });
  it("vários dados viram um aviso só, listando os primeiros", () => {
    const itens = [lead("a", "Ana P."), lead("b", "Bia C."), lead("c", "Caio D."), lead("d", "Davi E.")];
    const r = textoDoAvisoMarketing(itens, 6);
    expect(r.title).toBe("6 novos dados de marketing obtidos por wifi-publico!");
    expect(r.body).toBe("Ana P. · Bia C. · Caio D. e mais 3 — Acessanet EcoParque");
  });
  it("sem nome nem rede o corpo fica vazio, sem quebrar", () => {
    expect(textoDoAvisoMarketing([{ id: "x", nome: "", rede: "", quando: "" }]).body).toBe("");
  });
});

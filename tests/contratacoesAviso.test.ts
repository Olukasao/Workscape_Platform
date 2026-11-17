// @vitest-environment node
import { describe, expect, it } from "vitest";
import { textoDoAviso } from "../src/services/contratacaoAviso";

describe("aviso de contratação pelo site", () => {
  it("uma contratação: título em maiúsculas e o nome da pessoa", () => {
    expect(textoDoAviso([{ cliente: "Maria da Silva" }])).toEqual({ title: "NOVA CONTRATAÇÃO PELO SITE", body: "Maria da Silva" });
  });
  it("sem nome não deixa o aviso vazio", () => {
    expect(textoDoAviso([{ cliente: "  " }]).body).toBe("Cliente sem nome");
  });
  it("várias: conta no título e lista até 3 nomes", () => {
    const itens = ["Ana", "Bia", "Caio", "Davi", "Eva"].map((cliente, k) => ({ cliente }));
    expect(textoDoAviso(itens)).toEqual({ title: "5 NOVAS CONTRATAÇÕES PELO SITE", body: "Ana · Bia · Caio e mais 2" });
    expect(textoDoAviso(itens.slice(0, 2))).toEqual({ title: "2 NOVAS CONTRATAÇÕES PELO SITE", body: "Ana · Bia" });
  });
});

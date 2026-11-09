import { describe, expect, it } from "vitest";
import { chamadaReal, VALIDADE_MS } from "../src/services/transferenciaChamada";
import type { PhoneCall } from "../electron/phone";

const base = { id: 1, direcao: "in", estado: "tocando", numero: "", nome: "asterisk" } as unknown as PhoneCall;
const t = (em: number) => [{ numero: "11990211587", de: "Ana", em }];

describe("chamada transferida", () => {
  it("chamada com identidade genérica da central assume o cliente transferido", () => {
    const r = chamadaReal(base, t(1000), 5000);
    expect(r.numero).toBe("11990211587");
    expect(r.nome).toBe("");
  });
  it("número vazio também conta, e 'asterisk' com número também", () => {
    expect(chamadaReal({ ...base, nome: "" }, t(1000), 5000).numero).toBe("11990211587");
    expect(chamadaReal({ ...base, numero: "7781010" }, t(1000), 5000).numero).toBe("11990211587");
  });
  it("ligação normal (com número e nome de verdade) nunca é trocada", () => {
    const normal = { ...base, numero: "7781010", nome: "Ana" } as PhoneCall;
    expect(chamadaReal(normal, t(1000), 5000)).toBe(normal);
    const cliente = { ...base, numero: "11911112222", nome: "" } as PhoneCall;
    expect(chamadaReal(cliente, t(1000), 5000)).toBe(cliente);
  });
  it("aviso velho não vale, e chamada feita por mim não é trocada", () => {
    expect(chamadaReal(base, t(1000), 1000 + VALIDADE_MS + 1)).toBe(base);
    const saida = { ...base, direcao: "out" } as PhoneCall;
    expect(chamadaReal(saida, t(1000), 5000)).toBe(saida);
  });
});

describe("transferência com 'asterisk' como número", () => {
  it("chamada com número 'asterisk' assume a transferida, inclusive um ramal de colega", () => {
    const c = { id: 1, direcao: "in", estado: "tocando", numero: "asterisk", nome: "asterisk" } as unknown as PhoneCall;
    expect(chamadaReal(c, [{ numero: "7781010", de: "Ana", em: 1000 }], 5000).numero).toBe("7781010");
  });
});

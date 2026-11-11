import { describe, expect, it } from "vitest";
import { eventoNoTerminal } from "../src/services/terminalFoco";

// Sem DOM real: um "Element" mínimo com closest() basta para provar a regra.
class FalsoElemento { constructor(private classes: string[]) {} closest(seletor: string) { return seletor.split(",").map((x) => x.trim().replace(".", "")).some((c) => this.classes.includes(c)) ? this : null; } }
(globalThis as unknown as { Element: unknown }).Element = FalsoElemento;

describe("foco no terminal", () => {
  it("reconhece teclas vindas do terminal e deixa o resto do Workspace com seus atalhos", () => {
    expect(eventoNoTerminal({ target: new FalsoElemento(["xterm"]) as never })).toBe(true);
    expect(eventoNoTerminal({ target: new FalsoElemento(["term-tela"]) as never })).toBe(true);
    expect(eventoNoTerminal({ target: new FalsoElemento(["outra-coisa"]) as never })).toBe(false);
    expect(eventoNoTerminal({ target: null })).toBe(false);
  });
});

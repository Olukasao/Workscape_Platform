import { describe, expect, it } from "vitest";
import { TECLAS_PADRAO, dadosDoAtalho, tratarTecla, traduzirEntrada, type TeclasTerminal } from "../src/services/terminalTeclas";

const cfg = (c: Partial<TeclasTerminal> = {}): TeclasTerminal => ({ ...TECLAS_PADRAO, ...c });
const tecla = (key: string, extra: Partial<Parameters<typeof tratarTecla>[0]> = {}) => ({ key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...extra });

describe("teclas do terminal", () => {
  it("padrão: nada muda no que o terminal já envia", () => {
    expect(traduzirEntrada("\x7f", cfg())).toBe("\x7f");
    expect(traduzirEntrada("\r", cfg())).toBe("\r");
    expect(traduzirEntrada("ls", cfg())).toBe("ls");
    expect(tratarTecla(tecla("Backspace", { ctrlKey: true }), cfg())).toBeNull();
    expect(tratarTecla(tecla("Delete"), cfg())).toBeNull();
  });

  it("Backspace pode enviar ^H (o que muitos equipamentos esperam), sem a pessoa precisar de Ctrl+Backspace", () => {
    expect(traduzirEntrada("\x7f", cfg({ backspace: "ctrl-h" }))).toBe("\x08");
  });

  it("Ctrl+Backspace pode apagar a palavra, a linha ou virar DEL/^H", () => {
    expect(tratarTecla(tecla("Backspace", { ctrlKey: true }), cfg({ ctrlBackspace: "palavra" }))).toBe("\x17");
    expect(tratarTecla(tecla("Backspace", { ctrlKey: true }), cfg({ ctrlBackspace: "linha" }))).toBe("\x15");
    expect(tratarTecla(tecla("Backspace", { ctrlKey: true }), cfg({ ctrlBackspace: "del" }))).toBe("\x7f");
    expect(tratarTecla(tecla("Backspace", { ctrlKey: true }), cfg({ ctrlBackspace: "ctrl-h" }))).toBe("\x08");
    // Backspace puro e combinações com Alt/Meta/Shift não são mexidos por esta regra.
    expect(tratarTecla(tecla("Backspace"), cfg({ ctrlBackspace: "palavra" }))).toBeNull();
    expect(tratarTecla(tecla("Backspace", { ctrlKey: true, altKey: true }), cfg({ ctrlBackspace: "palavra" }))).toBeNull();
    expect(tratarTecla(tecla("Backspace", { ctrlKey: true, shiftKey: true }), cfg({ ctrlBackspace: "palavra" }))).toBeNull();
  });

  it("Delete pode apagar à esquerda, usando o mesmo código escolhido para o Backspace", () => {
    expect(tratarTecla(tecla("Delete"), cfg({ delete: "apagar" }))).toBe("\x7f");
    expect(tratarTecla(tecla("Delete"), cfg({ delete: "apagar", backspace: "ctrl-h" }))).toBe("\x08");
    expect(tratarTecla(tecla("Delete", { ctrlKey: true }), cfg({ delete: "apagar" }))).toBeNull();
  });

  it("Enter pode enviar CR+LF ou só LF", () => {
    expect(traduzirEntrada("\r", cfg({ enter: "crlf" }))).toBe("\r\n");
    expect(traduzirEntrada("\r", cfg({ enter: "lf" }))).toBe("\n");
  });

  it("os botões da tela respeitam o que foi escolhido (apagar e Enter)", () => {
    expect(dadosDoAtalho("apagar", cfg({ backspace: "ctrl-h" }))).toBe("\x08");
    expect(dadosDoAtalho("enter", cfg({ enter: "crlf" }))).toBe("\r\n");
    expect(dadosDoAtalho("ctrlc", cfg())).toBe("\x03");
    expect(dadosDoAtalho("palavra", cfg())).toBe("\x17");
    expect(dadosDoAtalho("inexistente", cfg())).toBe("");
  });
});

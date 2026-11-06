import { describe, expect, it } from "vitest";
import { acaoDaCombinacao, combinacaoDoEvento, combinacaoReservada, useAtalhos } from "../src/services/atalhos";

const ev = (o: Partial<KeyboardEvent>) => ({ key: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });

describe("atalhos de teclado", () => {
  it("monta a combinação padronizada", () => {
    expect(combinacaoDoEvento(ev({ key: ",", ctrlKey: true }))).toBe("Ctrl+,");
    expect(combinacaoDoEvento(ev({ key: "t", ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+T");
    expect(combinacaoDoEvento(ev({ key: "F2" }))).toBe("F2");
  });
  it("ignora tecla solta e só modificador", () => {
    expect(combinacaoDoEvento(ev({ key: "a" }))).toBeNull();
    expect(combinacaoDoEvento(ev({ key: "Control", ctrlKey: true }))).toBeNull();
  });
  it("protege combinações do app", () => {
    expect(combinacaoReservada("Ctrl+K")).toBe(true);
    expect(combinacaoReservada("Ctrl+,")).toBe(false);
  });
  it("uma combinação pertence a uma ação só", () => {
    useAtalhos.getState().limpar();
    useAtalhos.getState().definir("telefone", "Ctrl+,");
    useAtalhos.getState().definir("chat", "Ctrl+,");
    const { mapa } = useAtalhos.getState();
    expect(mapa.telefone).toBeUndefined();
    expect(acaoDaCombinacao(mapa, "Ctrl+,")).toBe("chat");
  });
});

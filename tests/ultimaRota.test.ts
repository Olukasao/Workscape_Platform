import { describe, expect, it } from "vitest";
import { caminhoSeguro, rotaParaRestaurar, serializarRota } from "../src/services/ultimaRota";

const agora = 1_800_000_000_000;

describe("voltar para a última tela depois de reiniciar", () => {
  it("abriu no Início e a última tela é recente: volta para ela", () => {
    expect(rotaParaRestaurar(serializarRota("/chamados", agora - 60_000), "/", agora)).toBe("/chamados");
    expect(rotaParaRestaurar(serializarRota("/agenda?data=2026-11-17", agora - 3_600_000), "/", agora)).toBe("/agenda?data=2026-11-17");
  });
  it("só restaura quando abriu no Início (não atrapalha quem abriu uma tela de propósito)", () => {
    expect(rotaParaRestaurar(serializarRota("/chamados", agora), "/rede", agora)).toBeNull();
  });
  it("tela guardada muito antiga, no futuro, ou o próprio Início: não restaura", () => {
    expect(rotaParaRestaurar(serializarRota("/chamados", agora - 13 * 3_600_000), "/", agora)).toBeNull();
    expect(rotaParaRestaurar(serializarRota("/chamados", agora + 3_600_000), "/", agora)).toBeNull();
    expect(rotaParaRestaurar(serializarRota("/", agora), "/", agora)).toBeNull();
  });
  it("dado inválido ou endereço de fora nunca é seguido", () => {
    expect(rotaParaRestaurar(null, "/", agora)).toBeNull();
    expect(rotaParaRestaurar("lixo", "/", agora)).toBeNull();
    expect(rotaParaRestaurar(JSON.stringify({ caminho: "//exemplo.com", em: agora }), "/", agora)).toBeNull();
    expect(rotaParaRestaurar(JSON.stringify({ caminho: "https://exemplo.com", em: agora }), "/", agora)).toBeNull();
    expect(serializarRota("//exemplo.com", agora)).toBeNull();
    expect(caminhoSeguro("/ok")).toBe(true);
    expect(caminhoSeguro("javascript:alert(1)")).toBe(false);
  });
});

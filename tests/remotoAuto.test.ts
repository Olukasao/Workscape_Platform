import { describe, expect, it } from "vitest";
import { deveReiniciar, INTERVALO_ENTRE_TENTATIVAS_MS, MAX_TENTATIVAS } from "../src/services/remotoAuto";

const base = { naoRegistradoSeguidos: 0, tentativas: 0, ultimaTentativaMs: 0, agoraMs: 10 * 60_000 };

describe("conserto automático do suporte remoto", () => {
  it("só reinicia depois de duas verificações seguidas sem registro", () => {
    expect(deveReiniciar({ ...base, naoRegistradoSeguidos: 0 })).toBe(false);
    expect(deveReiniciar({ ...base, naoRegistradoSeguidos: 1 })).toBe(false);
    expect(deveReiniciar({ ...base, naoRegistradoSeguidos: 2 })).toBe(true);
  });
  it("espera um intervalo entre as tentativas e para depois de poucas, sem entrar em laço", () => {
    const agora = 10 * 60_000;
    expect(deveReiniciar({ ...base, naoRegistradoSeguidos: 5, tentativas: 1, ultimaTentativaMs: agora - 60_000, agoraMs: agora })).toBe(false);
    expect(deveReiniciar({ ...base, naoRegistradoSeguidos: 5, tentativas: 1, ultimaTentativaMs: agora - INTERVALO_ENTRE_TENTATIVAS_MS, agoraMs: agora })).toBe(true);
    expect(deveReiniciar({ ...base, naoRegistradoSeguidos: 9, tentativas: MAX_TENTATIVAS, ultimaTentativaMs: 0, agoraMs: agora })).toBe(false);
  });
});

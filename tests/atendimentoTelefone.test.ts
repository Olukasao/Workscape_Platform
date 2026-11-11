import { describe, expect, it } from "vitest";
import { mesmoNumero } from "../src/modules/atendimento/numeros";
import { duracao } from "../src/modules/atendimento/chamar";

describe("Atendimento: telefone", () => {
  it("reconhece o mesmo número com DDD, país e nono dígito diferentes", () => {
    expect(mesmoNumero("(24) 99999-1234", "+55 24 99999-1234")).toBe(true);
    expect(mesmoNumero("24999991234", "2499991234")).toBe(true);
    expect(mesmoNumero("24999991234", "24999995678")).toBe(false);
    expect(mesmoNumero("123", "123")).toBe(false); // ramal não casa com cliente
  });
  it("formata a duração de espera", () => {
    expect(duracao(45)).toBe("45s");
    expect(duracao(185)).toBe("3 min 05s");
    expect(duracao(3725)).toBe("1 h 02 min");
    expect(duracao(null)).toBe("—");
  });
});

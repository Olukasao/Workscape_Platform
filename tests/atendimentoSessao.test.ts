import { beforeEach, describe, expect, it, vi } from "vitest";
import { garantirSessao, totalNaoLidas, useAtendimento } from "../src/stores/atendimentoSessao";

const agente = { id: 7, name: "Ana", email: "ana@x.com", role: "agent" };
const chamadas: Array<{ method: string; path: string; body?: unknown }> = [];
let statusServidor = "AVAILABLE";
let fila = true;

beforeEach(() => {
  chamadas.length = 0; statusServidor = "AVAILABLE"; fila = true;
  useAtendimento.setState({ agente: null, status: null, inicioEm: null, naFila: true, naoLidas: {}, conversaAberta: null });
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
  vi.stubGlobal("window", {
    desktop: {
      atendimentoEstado: async () => ({ agente: null, conectado: false }),
      atendimentoEntrar: async () => ({ agente }),
      atendimentoChamar: async (v: { method: string; path: string; body?: { attendanceStatus?: string } }) => {
        chamadas.push(v);
        if (v.path === "/api/agent/auth/me") return { agent: { attendanceStatus: statusServidor } };
        if (v.path === "/api/agent/ops/config") return { inQueue: fila };
        if (v.method === "PATCH") statusServidor = v.body?.attendanceStatus ?? statusServidor;
        return {};
      },
    },
  });
});

describe("sessão do atendimento", () => {
  it("quem atende na fila começa em pausa, mesmo se ficou disponível da última vez", async () => {
    await garantirSessao(true);
    expect(useAtendimento.getState().status).toBe("INVISIBLE");
    expect(useAtendimento.getState().inicioEm).toBeNull();
    expect(chamadas.some((c) => c.method === "PATCH" && (c.body as { attendanceStatus: string }).attendanceStatus === "INVISIBLE")).toBe(true);
  });

  it("quem está fora da fila não é pausado nem vê a tela inicial", async () => {
    fila = false;
    await garantirSessao(true);
    expect(useAtendimento.getState().naFila).toBe(false);
    expect(chamadas.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("entra uma vez só mesmo com chamadas repetidas", async () => {
    const entrar = vi.fn(async () => ({ agente }));
    (window as unknown as { desktop: { atendimentoEntrar: typeof entrar } }).desktop.atendimentoEntrar = entrar;
    await Promise.all([garantirSessao(true), garantirSessao(), garantirSessao()]);
    expect(entrar).toHaveBeenCalledTimes(1);
  });

  it("o cronômetro começa ao iniciar e zera ao pausar", () => {
    useAtendimento.getState().setStatus("AVAILABLE");
    const inicio = useAtendimento.getState().inicioEm;
    expect(inicio).toBeGreaterThan(0);
    useAtendimento.getState().setStatus("AVAILABLE");
    expect(useAtendimento.getState().inicioEm).toBe(inicio);
    useAtendimento.getState().setStatus("INVISIBLE");
    expect(useAtendimento.getState().inicioEm).toBeNull();
  });

  it("soma as mensagens não lidas", () => {
    expect(totalNaoLidas({ a: 2, b: 0, c: 3 })).toBe(5);
  });
});

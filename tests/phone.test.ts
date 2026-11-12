import { mkdtempSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPhone, identificarRemoto, type PhoneEvent } from "../electron/phone";

const fake = path.join(__dirname, "fixtures", "fake-phone-engine.mjs");
const credenciais = {
  conta: { ramal: "1001", sipUser: "1001", sipDomain: "sip.exemplo.com", sipServer: "sip.exemplo.com", sipPort: 5060, transport: "udp", displayName: "Teste" },
  senha: "SENHA-SECRETA-123",
};
const fetchOk = (async () => new Response(JSON.stringify(credenciais), { status: 200 })) as unknown as typeof fetch;

const vivos: ReturnType<typeof createPhone>[] = [];
function novo(env: Record<string, string> = {}, extra: Partial<Parameters<typeof createPhone>[0]> = {}) {
  Object.assign(process.env, { FAKE_MODE: "ok", FAKE_TRACE: "", FAKE_CRASH_ONCE: "", FAKE_LEGACY: "", ...env });
  const eventos: PhoneEvent[] = [];
  const phone = createPhone({ enginePath: process.execPath, engineArgs: [fake], chatOrigin: () => "http://chat.local:8600", send: (e) => eventos.push(e), fetchImpl: fetchOk, restartDelayMs: 20, ...extra });
  vivos.push(phone);
  return { phone, eventos };
}
const espera = async (cond: () => boolean, ms = 4000) => { const fim = Date.now() + ms; while (!cond()) { if (Date.now() > fim) throw new Error("tempo esgotado"); await new Promise((r) => setTimeout(r, 15)); } };
afterEach(async () => { await Promise.all(vivos.splice(0).map((p) => p.parar())); });

describe("phone (processo principal)", () => {
  it("conecta, registra e a senha nunca chega à interface", async () => {
    const trace = path.join(mkdtempSync(path.join(tmpdir(), "phone-")), "trace.jsonl");
    const { phone, eventos } = novo({ FAKE_TRACE: trace });
    await phone.conectar("token");
    await espera(() => phone.snapshot().registro === "registrado");
    expect(phone.snapshot().ramal).toBe("1001");
    expect(JSON.stringify(eventos)).not.toContain("SENHA-SECRETA");
    expect(JSON.stringify(phone.snapshot())).not.toContain("SENHA-SECRETA");
    const registro = readFileSync(trace, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((c) => c.cmd === "register");
    expect(registro).toMatchObject({ user: "1001", domain: "sip.exemplo.com", port: 5060, password: "<presente>" });
    await espera(() => phone.snapshot().dispositivos.capture.length === 1);
  });

  it("faz uma chamada, a atende e registra o histórico", async () => {
    const { phone, eventos } = novo();
    await phone.conectar("t");
    await espera(() => phone.snapshot().registro === "registrado");
    phone.ligar("1003");
    await espera(() => phone.snapshot().chamadas[0]?.estado === "conversando");
    const id = phone.snapshot().chamadas[0].id;
    phone.mudo({ id, on: true });
    expect(phone.snapshot().chamadas[0].mudo).toBe(true);
    phone.desligar({ id });
    await espera(() => phone.snapshot().chamadas.length === 0);
    const h = eventos.find((e) => e.type === "history");
    expect(h).toMatchObject({ type: "history", direcao: "out", numero: "1003", resultado: "atendida" });
    expect((h as { duracaoSeg: number }).duracaoSeg).toBeGreaterThanOrEqual(3);
  });

  it("chamada recebida: identifica quem liga; rejeitar vira 'rejeitada'", async () => {
    const { phone, eventos } = novo({ FAKE_MODE: "incoming" });
    await phone.conectar("t");
    await espera(() => eventos.some((e) => e.type === "incoming"));
    const entrada = eventos.find((e) => e.type === "incoming") as Extract<PhoneEvent, { type: "incoming" }>;
    expect(entrada.call).toMatchObject({ numero: "1003", nome: "Ana Souza", estado: "tocando", direcao: "in" });
    phone.rejeitar({ id: entrada.call.id });
    await espera(() => eventos.some((e) => e.type === "history"));
    expect(eventos.find((e) => e.type === "history")).toMatchObject({ direcao: "in", numero: "1003", resultado: "rejeitada" });
  });

  it("Não perturbe: o motor responde Ocupado sem tocar; entra no histórico como perdida, sem aviso", async () => {
    const trace = path.join(mkdtempSync(path.join(tmpdir(), "phone-")), "trace.jsonl");
    const { phone, eventos } = novo({ FAKE_MODE: "incoming", FAKE_TRACE: trace });
    phone.definirNaoPerturbe(true);
    expect(phone.snapshot().naoPerturbe).toBe(true);
    await phone.conectar("t");
    await espera(() => eventos.some((e) => e.type === "history"));
    expect(eventos.some((e) => e.type === "incoming")).toBe(false);
    expect(phone.snapshot().chamadas).toHaveLength(0);
    expect(eventos.find((e) => e.type === "history")).toMatchObject({ direcao: "in", numero: "1003", resultado: "nao_atendida", silenciosa: true });
    const comandos = readFileSync(trace, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    expect(comandos.some((c) => c.cmd === "dnd" && c.on === true)).toBe(true); // o motor foi avisado antes de registrar
    expect(comandos.findIndex((c) => c.cmd === "dnd")).toBeLessThan(comandos.findIndex((c) => c.cmd === "register"));
    expect(comandos.some((c) => c.cmd === "reject")).toBe(false); // não precisou recusar depois de tocar
  });

  it("com um motor antigo (que não conhece 'dnd'), ainda recusa a chamada recebida", async () => {
    const trace = path.join(mkdtempSync(path.join(tmpdir(), "phone-")), "trace.jsonl");
    const { phone, eventos } = novo({ FAKE_MODE: "incoming", FAKE_TRACE: trace, FAKE_LEGACY: "1" });
    phone.definirNaoPerturbe(true);
    await phone.conectar("t");
    await espera(() => eventos.some((e) => e.type === "history"));
    expect(eventos.some((e) => e.type === "incoming")).toBe(false);
    expect(eventos.find((e) => e.type === "history")).toMatchObject({ resultado: "nao_atendida", silenciosa: true });
    expect(readFileSync(trace, "utf8")).toContain('"reject"');
  });

  it("Não perturbe desligado volta a tocar, e ligar o Não perturbe não derruba chamada em andamento", async () => {
    const { phone, eventos } = novo({ FAKE_MODE: "incoming" });
    await phone.conectar("t");
    await espera(() => eventos.some((e) => e.type === "incoming"));
    expect(phone.snapshot().chamadas[0]).toMatchObject({ estado: "tocando" });
    phone.definirNaoPerturbe(true);
    expect(phone.snapshot().chamadas).toHaveLength(1); // a que já tocava continua
    expect(() => phone.definirNaoPerturbe("sim")).toThrow();
  });

  it("repassa os níveis de áudio só durante a conversa, limitados a 0..255 e fora do estado", async () => {
    const { phone, eventos } = novo({ FAKE_MODE: "incoming" });
    await phone.conectar("t");
    await espera(() => eventos.some((e) => e.type === "incoming"));
    const id = phone.snapshot().chamadas[0].id;
    expect(eventos.some((e) => e.type === "levels")).toBe(false); // tocando: nada de níveis
    phone.atender({ id });
    await espera(() => eventos.some((e) => e.type === "levels"));
    expect(eventos.find((e) => e.type === "levels")).toEqual({ type: "levels", mic: 255, remoto: 90 }); // 300 vira 255
    expect(JSON.stringify(phone.snapshot())).not.toContain("levels");
  });

  it("senha recusada pela central vira 'recusado' na hora (e não fica em Conectando para sempre)", async () => {
    const trace = path.join(mkdtempSync(path.join(tmpdir(), "phone-")), "trace.jsonl");
    const { phone } = novo({ FAKE_MODE: "auth401", FAKE_TRACE: trace });
    await phone.conectar("t");
    await espera(() => phone.snapshot().registro === "recusado");
    expect(phone.snapshot().mensagem).toMatch(/recusou/i);
    expect(() => phone.ligar("1003")).toThrow(/conectado/);
    // pediu para cancelar o registro: não fica tentando de novo na central
    await espera(() => readFileSync(trace, "utf8").includes('"unregister"'));
  });

  it("se a central nunca responde, sai de 'Conectando' com uma mensagem clara", async () => {
    const { phone } = novo({ FAKE_MODE: "mudo" }, { registerTimeoutMs: 200 });
    await phone.conectar("t");
    expect(phone.snapshot().registro).toBe("registrando");
    await espera(() => phone.snapshot().registro === "falhou", 3000);
    expect(phone.snapshot().mensagem).toMatch(/não respondeu/i);
  });

  it("recusa números e dígitos perigosos antes de falar com o motor", async () => {
    const { phone } = novo();
    await phone.conectar("t");
    await espera(() => phone.snapshot().registro === "registrado");
    for (const ruim of ["", "10 03", "1003;rm", "sip:1003@x", "a".repeat(40), 1003, null, { toString: () => "1" }]) expect(() => phone.ligar(ruim)).toThrow();
    expect(() => phone.dtmf({ id: 1, digits: "12;3" })).toThrow();
    expect(() => phone.transferir({ id: 1, to: "1003@evil.com" })).toThrow();
    expect(() => phone.mudo({ id: -1, on: true })).toThrow();
    expect(() => phone.definirDispositivos({ capture: 1, extra: 2 })).toThrow();
  });

  it("religa o motor sozinho se ele cair e volta a registrar", async () => {
    const marca = path.join(mkdtempSync(path.join(tmpdir(), "phone-")), "caiu");
    const { phone } = novo({ FAKE_CRASH_ONCE: marca });
    await phone.conectar("t").catch(() => {});
    await espera(() => existsSync(marca));
    await espera(() => phone.snapshot().registro === "registrado", 6000);
    expect(phone.snapshot().motor).toBe("pronto");
  });

  it("sem motor instalado, avisa em português e não quebra", async () => {
    const { phone } = novo({}, { enginePath: null });
    expect(phone.snapshot().motor).toBe("indisponivel");
    await expect(phone.conectar("t")).rejects.toThrow(/não está instalado/);
  });

  it("erro do servidor ao buscar o ramal vira mensagem clara", async () => {
    const { phone } = novo({}, { fetchImpl: (async () => new Response(JSON.stringify({ error: "Você não tem ramal cadastrado." }), { status: 404 })) as unknown as typeof fetch });
    await expect(phone.conectar("t")).rejects.toThrow(/não tem ramal/);
    expect(phone.snapshot().registro).toBe("falhou");
  });

  it("identificarRemoto extrai só número e nome", () => {
    expect(identificarRemoto('"Ana" <sip:1003@x.com>')).toEqual({ numero: "1003", nome: "Ana" });
    expect(identificarRemoto("sip:+5524999@x.com;user=phone")).toEqual({ numero: "+5524999", nome: "" });
    expect(identificarRemoto("lixo")).toEqual({ numero: "", nome: "" });
  });
});

describe("prefixo de saída (0)", () => {
  it("coloca 0 só em número externo", async () => {
    const { numeroDeSaida } = await import("../electron/phone");
    expect(numeroDeSaida("11999998888")).toBe("011999998888");
    expect(numeroDeSaida("1133334444")).toBe("01133334444");
    expect(numeroDeSaida("999998888")).toBe("0999998888");
    // já com 0, ramais, filas, códigos e internacional ficam iguais
    for (const igual of ["011999998888", "1003", "100001", "10002", "7781025", "*97", "#1", "+5511999998888"]) expect(numeroDeSaida(igual)).toBe(igual);
  });

  it("disca com 0 mas mostra o número como foi digitado", async () => {
    const trace = path.join(mkdtempSync(path.join(tmpdir(), "phone-")), "trace.jsonl");
    const { phone, eventos } = novo({ FAKE_TRACE: trace });
    await phone.conectar("t");
    await espera(() => phone.snapshot().registro === "registrado");
    phone.ligar("11999998888");
    await espera(() => phone.snapshot().chamadas.length === 1);
    const chamada = readFileSync(trace, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((c) => c.cmd === "call");
    expect(chamada.number).toBe("011999998888");
    expect(phone.snapshot().chamadas[0].numero).toBe("11999998888");
    phone.desligar({ id: phone.snapshot().chamadas[0].id });
    await espera(() => eventos.some((e) => e.type === "history"));
    expect(eventos.find((e) => e.type === "history")).toMatchObject({ numero: "11999998888" });
  });
});

describe("atualização não pode interromper ligação", () => {
  it("temChamadaAtiva é verdadeiro durante a ligação e falso depois", async () => {
    const { phone } = novo();
    await phone.conectar("t");
    await espera(() => phone.snapshot().registro === "registrado");
    expect(phone.temChamadaAtiva()).toBe(false);
    phone.ligar("1003");
    await espera(() => phone.snapshot().chamadas[0]?.estado === "conversando");
    expect(phone.temChamadaAtiva()).toBe(true);
    phone.desligar({ id: phone.snapshot().chamadas[0].id });
    await espera(() => phone.snapshot().chamadas.length === 0);
    expect(phone.temChamadaAtiva()).toBe(false);
  });
});

describe("gravação e envio da conversa", () => {
  type Chamada = { url: string; method: string; form?: FormData };
  function fetchGravacao(opcoes: { ativa: boolean; envio: number }) {
    const chamadas: Chamada[] = [];
    const impl = (async (url: URL, init?: RequestInit) => {
      const u = String(url);
      chamadas.push({ url: u, method: init?.method ?? "GET", form: init?.body instanceof FormData ? init.body : undefined });
      if (u.includes("/api/phone/gravacao-config")) return new Response(JSON.stringify({ ativa: opcoes.ativa }), { status: 200 });
      if (u.includes("/api/phone/gravacoes")) return new Response(JSON.stringify({ ok: true }), { status: opcoes.envio });
      return new Response(JSON.stringify(credenciais), { status: 200 });
    }) as unknown as typeof fetch;
    return { impl, chamadas };
  }
  const pasta = () => mkdtempSync(path.join(tmpdir(), "grav-"));
  async function ligarEDesligar(phone: ReturnType<typeof createPhone>) {
    await phone.conectar("token");
    await espera(() => phone.snapshot().registro === "registrado");
    await new Promise((r) => setTimeout(r, 80)); // deixa a resposta da configuração chegar ao motor
    phone.ligar("1003");
    await espera(() => phone.snapshot().chamadas[0]?.estado === "conversando");
    phone.desligar({ id: phone.snapshot().chamadas[0].id });
    await espera(() => phone.snapshot().chamadas.length === 0);
  }

  it("com a gravação liberada, envia os dois lados ao servidor e apaga os arquivos", async () => {
    const dir = pasta();
    const { impl, chamadas } = fetchGravacao({ ativa: true, envio: 201 });
    const { phone } = novo({}, { gravacaoDir: dir, fetchImpl: impl });
    await ligarEDesligar(phone);
    await espera(() => chamadas.some((c) => c.url.includes("/api/phone/gravacoes")));
    const envio = chamadas.find((c) => c.url.includes("/api/phone/gravacoes"))!;
    expect(envio.method).toBe("POST");
    expect(envio.form?.get("numero")).toBe("1003");
    expect(envio.form?.get("direcao")).toBe("out");
    expect(envio.form?.get("local")).toBeInstanceOf(Blob);
    expect(envio.form?.get("remoto")).toBeInstanceOf(Blob);
    await espera(() => readdirSync(dir).length === 0);
  });

  it("com a gravação desligada, o motor não grava e nada é enviado", async () => {
    const dir = pasta();
    const { impl, chamadas } = fetchGravacao({ ativa: false, envio: 201 });
    const { phone } = novo({}, { gravacaoDir: dir, fetchImpl: impl });
    await ligarEDesligar(phone);
    await new Promise((r) => setTimeout(r, 150));
    expect(chamadas.some((c) => c.url.includes("/api/phone/gravacoes"))).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("se o envio falha, guarda os arquivos e reenvia ao reconectar", async () => {
    const dir = pasta();
    const falha = fetchGravacao({ ativa: true, envio: 503 });
    const a = novo({}, { gravacaoDir: dir, fetchImpl: falha.impl });
    await ligarEDesligar(a.phone);
    await espera(() => falha.chamadas.some((c) => c.url.includes("/api/phone/gravacoes")));
    await new Promise((r) => setTimeout(r, 100));
    expect(readdirSync(dir).filter((n) => n.endsWith(".wav"))).toHaveLength(2);
    expect(readdirSync(dir).filter((n) => n.endsWith(".json"))).toHaveLength(1);
    await a.phone.parar();

    const ok = fetchGravacao({ ativa: true, envio: 201 });
    const b = novo({}, { gravacaoDir: dir, fetchImpl: ok.impl });
    await b.phone.conectar("token");
    await espera(() => ok.chamadas.some((c) => c.url.includes("/api/phone/gravacoes")));
    await espera(() => readdirSync(dir).length === 0);
  });

  it("chamada que não foi atendida não deixa gravação", async () => {
    const dir = pasta();
    const { impl } = fetchGravacao({ ativa: true, envio: 201 });
    const { phone, eventos } = novo({ FAKE_MODE: "incoming" }, { gravacaoDir: dir, fetchImpl: impl });
    await phone.conectar("t");
    await espera(() => eventos.some((e) => e.type === "incoming"));
    const entrada = eventos.find((e) => e.type === "incoming") as Extract<PhoneEvent, { type: "incoming" }>;
    phone.rejeitar({ id: entrada.call.id });
    await espera(() => phone.snapshot().chamadas.length === 0);
    expect(readdirSync(dir)).toEqual([]);
  });
});

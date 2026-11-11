import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { Server } from "ssh2";
import { FiltroTelnet, ServicoTerminal, tamanhoTelnet } from "../electron/terminal";

const cifra = { disponivel: () => true, cifrar: (t: string) => Buffer.from("x" + t).toString("base64"), decifrar: (b: string) => Buffer.from(b, "base64").toString().slice(1) };
const espera = async (cond: () => boolean, ms = 5000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) throw new Error("tempo esgotado"); await new Promise((r) => setTimeout(r, 20)); } };

describe("telnet", () => {
  it("recusa opções, aceita eco e remove comandos do texto", () => {
    const resp: number[][] = []; const dados: string[] = [];
    const f = new FiltroTelnet((b) => resp.push(b), (d) => dados.push(d.toString("latin1")));
    f.entrada(Buffer.from([255, 251, 1, 255, 251, 24, 255, 253, 31, 72, 105, 255, 255]));
    expect(resp).toEqual([[255, 253, 1], [255, 254, 24], [255, 251, 31]]);
    expect(dados.join("")).toBe("Hi\u00ff");
  });
  it("monta o tamanho da janela", () => expect(tamanhoTelnet(100, 30)).toEqual([255, 250, 31, 0, 100, 0, 30, 255, 240]));
});

describe("serviço do terminal (SSH real contra servidor local)", () => {
  let dir: string, servidor: Server, porta: number, svc: ServicoTerminal;
  const eventos: { canal: string; p: any }[] = [];
  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "term-"));
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "pkcs1", format: "pem" } });
    servidor = new Server({ hostKeys: [privateKey] }, (cliente) => {
      cliente.on("error", () => {});
      cliente.on("authentication", (ctx) => (ctx.method === "password" && ctx.username === "admin" && ctx.password === "segredo" ? ctx.accept() : ctx.reject(["password"])));
      cliente.on("ready", () => cliente.on("session", (aceitar) => {
        const s = aceitar();
        s.on("pty", (a) => a?.());
        s.on("shell", (a) => { const c = a(); c.write("bem-vindo\r\n"); c.on("data", (d: Buffer) => c.write("eco:" + d.toString())); });
      }));
    });
    await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
    porta = (servidor.address() as net.AddressInfo).port;
    svc = new ServicoTerminal((d) => path.join(dir, `eq-${d}.json`), path.join(dir, "chaves.json"), cifra, (canal, p) => eventos.push({ canal, p }));
  });
  afterAll(() => { svc.fecharTodas(); servidor.close(); rmSync(dir, { recursive: true, force: true }); });
  const texto = (s: string) => eventos.filter((e) => e.canal === "terminal:dados" && e.p.sessao === s).map((e) => Buffer.from(e.p.dados).toString()).join("");
  const estado = (s: string) => eventos.filter((e) => e.canal === "terminal:estado" && e.p.sessao === s).map((e) => e.p.estado);

  it("guarda equipamento com senha cifrada e nunca a devolve", async () => {
    const salvo = await svc.salvar("1", { nome: "Teste", grupo: "G", protocolo: "ssh", host: "127.0.0.1", porta, usuario: "admin", senha: "segredo", guardarSenha: true });
    expect(salvo).toMatchObject({ nome: "Teste", temSenha: true });
    expect(JSON.stringify(await svc.listar("1"))).not.toContain("segredo");
    expect(await svc.listar("2")).toEqual([]);
  });
  it("conecta usando a senha salva, troca dados e confia na primeira chave", async () => {
    const [eq] = await svc.listar("1");
    await svc.conectar("1", { sessao: "a", equipamentoId: eq.id, cols: 80, rows: 24 });
    await espera(() => estado("a").includes("conectado"));
    await espera(() => texto("a").includes("bem-vindo"));
    expect(texto("a")).toContain("Primeira conexão");
    svc.entrada("a", "oi");
    await espera(() => texto("a").includes("eco:oi"));
    svc.fechar("a");
    await espera(() => estado("a").includes("fechado"));
  });
  it("recusa senha errada com mensagem clara", async () => {
    await svc.conectar("1", { sessao: "b", rapido: { protocolo: "ssh", host: "127.0.0.1", porta, usuario: "admin" }, senha: "errada", cols: 80, rows: 24 });
    await espera(() => estado("b").includes("erro"));
    expect(eventos.find((e) => e.canal === "terminal:estado" && e.p.sessao === "b" && e.p.estado === "erro")?.p.mensagem).toMatch(/recusados/);
  });
  it("bloqueia quando a chave do equipamento muda", async () => {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path.join(dir, "chaves.json"), JSON.stringify({ [`127.0.0.1:${porta}`]: "SHA256:outra" }));
    await svc.conectar("1", { sessao: "c", rapido: { protocolo: "ssh", host: "127.0.0.1", porta, usuario: "admin" }, senha: "segredo", cols: 80, rows: 24 });
    await espera(() => estado("c").includes("erro"));
    expect(texto("c")).toContain("mudou");
    expect(estado("c")).not.toContain("conectado");
  });
  it("conecta em Telnet e repassa o texto", async () => {
    const tel = net.createServer((s) => { s.write(Buffer.from([255, 251, 1])); s.write("login: "); });
    await new Promise<void>((r) => tel.listen(0, "127.0.0.1", r));
    const p = (tel.address() as net.AddressInfo).port;
    await svc.conectar("1", { sessao: "t", rapido: { protocolo: "telnet", host: "127.0.0.1", porta: p }, cols: 80, rows: 24 });
    await espera(() => texto("t").includes("login: "));
    svc.fechar("t"); tel.close();
  });
  it("rejeita endereço inválido", async () => {
    await expect(svc.salvar("1", { nome: "x", protocolo: "ssh", host: "a b;rm", porta: 22 })).rejects.toThrow();
  });
});

describe("anti-idle", () => {
  it("envia o sinal só depois do tempo sem digitar, respeita o desligar e a digitação adia", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    const dir = mkdtempSync(path.join(tmpdir(), "term-ai-"));
    const eventos: { canal: string; p: any }[] = [];
    const svc = new ServicoTerminal((d) => path.join(dir, `e-${d}.json`), path.join(dir, "c.json"), cifra, (canal, p) => eventos.push({ canal, p }));
    const recebido: Buffer[] = [];
    const tel = net.createServer((s) => { s.on("data", (d) => recebido.push(Buffer.from(d))); });
    await new Promise<void>((r) => tel.listen(0, "127.0.0.1", r));
    const porta = (tel.address() as net.AddressInfo).port;
    await svc.conectar("1", { sessao: "x", rapido: { protocolo: "telnet", host: "127.0.0.1", porta }, antiIdle: { ativo: true, segundos: 10, modo: "enter" }, cols: 80, rows: 24 });
    await vi.waitFor(() => expect(eventos.some((e) => e.p.estado === "conectado")).toBe(true), { timeout: 3000, interval: 20 });
    const total = () => Buffer.concat(recebido).toString("latin1");
    const base = total().length;
    vi.advanceTimersByTime(5000);                       // 5 s sem digitar: nada ainda
    await new Promise((r) => setImmediate(r));
    expect(total().length).toBe(base);
    vi.advanceTimersByTime(6000);                       // passou de 10 s: envia Enter
    await vi.waitFor(() => expect(total().slice(base)).toContain("\r"), { timeout: 3000, interval: 20 });
    const depoisDoPrimeiro = total().length;
    svc.configurarAntiIdle("x", { ativo: false, segundos: 10, modo: "enter" });
    vi.advanceTimersByTime(30000);                      // desligado: não envia mais
    await new Promise((r) => setTimeout(r, 50));
    expect(total().length).toBe(depoisDoPrimeiro);
    svc.fecharTodas(); tel.close(); vi.useRealTimers(); rmSync(dir, { recursive: true, force: true });
  });
  it("guarda a configuração de anti-idle no equipamento e usa o padrão nos antigos", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "term-ai2-"));
    const svc = new ServicoTerminal((d) => path.join(dir, `e-${d}.json`), path.join(dir, "c.json"), cifra, () => {});
    const novo = await svc.salvar("1", { nome: "A", protocolo: "telnet", host: "10.0.0.1", porta: 23, antiIdle: false, antiIdleSegundos: 120, antiIdleModo: "espaco" });
    expect(novo).toMatchObject({ antiIdle: false, antiIdleSegundos: 120, antiIdleModo: "espaco" });
    const padrao = await svc.salvar("1", { nome: "B", protocolo: "telnet", host: "10.0.0.2", porta: 23 });
    expect(padrao).toMatchObject({ antiIdle: true, antiIdleSegundos: 60, antiIdleModo: "nulo" });
    await expect(svc.salvar("1", { nome: "C", protocolo: "telnet", host: "10.0.0.3", porta: 23, antiIdleSegundos: 2 })).rejects.toThrow();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("lista local do terminal (importação para a lista de todos)", () => {
  it("exporta os equipamentos locais com a senha já decifrada, só para o processo principal, e não apaga nada", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "term-local-"));
    try {
      const svc = new ServicoTerminal((d) => path.join(dir, `eq-${d}.json`), path.join(dir, "chaves.json"), cifra, () => undefined);
      await svc.salvar("7", { nome: "OLT Centro", grupo: "OLTs", protocolo: "ssh", host: "10.0.0.1", porta: 22, usuario: "admin", senha: "segredo", guardarSenha: true });
      await svc.salvar("7", { nome: "Switch", grupo: "", protocolo: "telnet", host: "10.0.0.2", porta: 23, usuario: "", guardarSenha: false });
      const lista = await svc.exportarLocais("7");
      expect(lista.map((e) => e.nome).sort()).toEqual(["OLT Centro", "Switch"]);
      expect(lista.find((e) => e.nome === "OLT Centro")).toMatchObject({ host: "10.0.0.1", usuario: "admin", senha: "segredo", guardarSenha: true });
      expect(lista.find((e) => e.nome === "Switch")).toMatchObject({ senha: undefined, guardarSenha: false });
      // Exportar não mexe na lista local: continua inteira depois.
      expect((await svc.listar("7")).length).toBe(2);
      // Outra pessoa neste computador não vê a lista.
      expect(await svc.exportarLocais("8")).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

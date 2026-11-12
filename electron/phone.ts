import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

// Workscape Phone, lado do processo principal. O motor SIP roda como processo filho separado da interface:
// a sessão SIP continua viva ao trocar de tela, e a senha SIP só passa por aqui (backend -> motor), nunca pelo renderer.
// Protocolo com o motor: uma mensagem JSON por linha (stdin = comandos, stdout = eventos, stderr = log).

export type PhoneEngineState = "indisponivel" | "parado" | "iniciando" | "pronto" | "erro";
export type PhoneRegState = "desconectado" | "registrando" | "registrado" | "recusado" | "falhou";
export type PhoneCallState = "chamando" | "tocando" | "conversando" | "encerrada";
export type PhoneResult = "atendida" | "nao_atendida" | "rejeitada" | "falhou";

export interface PhoneCall {
  id: number;
  direcao: "in" | "out";
  numero: string;
  nome: string;
  estado: PhoneCallState;
  inicioMs: number;
  atendidaMs: number | null;
  mudo: boolean;
  espera: boolean;
  /** Resultado da última transferência pedida (mensagem de erro quando a central recusa). */
  avisoTransferencia?: string;
  /** A transferência foi pedida e a central ainda não respondeu: a tela mostra "Transferindo…". */
  transferindo?: boolean;
}
export interface PhoneSnapshot {
  motor: PhoneEngineState;
  registro: PhoneRegState;
  mensagem: string;
  ramal: string;
  chamadas: PhoneCall[];
  /** Não perturbe: chamadas recebidas não tocam nem avisam; a central recebe uma recusa. */
  naoPerturbe: boolean;
  dispositivos: { capture: PhoneDevice[]; playback: PhoneDevice[] };
}
export interface PhoneDevice { id: number; name: string }
export type PhoneEvent =
  | { type: "state"; snapshot: PhoneSnapshot }
  | { type: "incoming"; call: PhoneCall }
  | { type: "history"; direcao: "in" | "out"; numero: string; resultado: PhoneResult; duracaoSeg: number; inicioMs: number; silenciosa?: boolean }
  /** Só o processo principal envia: a pessoa clicou no aviso de chamada e o cartão do telefone deve abrir. */
  | { type: "abrir" }
  /** Níveis de áudio (0 a 255) durante a conversa: o microfone e a voz de quem está do outro lado. Vão à parte do estado, 10 vezes por segundo. */
  | { type: "levels"; mic: number; remoto: number };

export interface PhoneOptions {
  /** Executável do motor (ou `process.execPath` nos testes). */
  enginePath: string | null;
  engineArgs?: string[];
  /** Origem do backend do chat, por exemplo http://192.168.1.133:8600. */
  chatOrigin: () => string;
  send: (event: PhoneEvent) => void;
  log?: (nivel: "info" | "warn" | "error", mensagem: string) => void;
  /** Pausa antes de religar o motor depois de uma queda (ms). */
  restartDelayMs?: number;
  /** Quanto esperar a central responder ao registro antes de avisar que não respondeu (ms). */
  registerTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Pasta onde o motor grava as conversas até o envio ao servidor. Sem pasta, o telefone nunca grava. */
  gravacaoDir?: string;
}

/** Metadados guardados ao lado dos WAVs até o envio dar certo (se o envio falhar, tenta de novo ao reconectar). */
interface GravacaoPendente { direcao: "in" | "out"; numero: string; inicioMs: number; duracaoSeg: number; local: string; remoto: string }
const GRAVACAO_VALIDADE_MS = 7 * 86_400_000;

const NUMERO = /^[0-9+*#]{1,32}$/;

import { numeroDeSaida } from "./prefixoSaida";
export { numeroDeSaida, PREFIXO_SAIDA } from "./prefixoSaida";
const DIGITOS = /^[0-9*#A-D]{1,32}$/;
const TEMPO_MAX_REGISTRO_MS = 35_000;

const credenciaisSchema = z.object({
  conta: z.object({
    ramal: z.string().min(1).max(20),
    sipUser: z.string().min(1).max(64),
    sipDomain: z.string().min(1).max(253),
    sipServer: z.string().min(1).max(253),
    sipPort: z.number().int().min(1).max(65535),
    transport: z.enum(["udp", "tcp"]),
    displayName: z.string().max(100),
  }),
  senha: z.string().min(1).max(128),
});

const text = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback);

/** `"Ana" <sip:1003@dominio>` -> { numero: "1003", nome: "Ana" }. Só a parte de usuário e o nome de exibição saem daqui. */
export function identificarRemoto(uri: unknown): { numero: string; nome: string } {
  const bruto = text(uri, 400);
  const sip = /sips?:([^@;>\s]+)@/i.exec(bruto)?.[1] ?? "";
  const nome = /^\s*"([^"]{0,100})"/.exec(bruto)?.[1] ?? "";
  const numero = /^[0-9+*#A-Za-z._-]{1,64}$/.test(sip) ? sip : "";
  return { numero, nome: nome.replace(/[\r\n]/g, " ").trim() };
}

export function createPhone(options: PhoneOptions) {
  const log = options.log ?? (() => {});
  const doFetch = options.fetchImpl ?? fetch;
  let engine: ChildProcessWithoutNullStreams | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let restarts = 0;
  let encerrando = false;
  let falhasAutenticacao = 0;
  let regTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingInit: { resolve: () => void; reject: (e: Error) => void } | null = null;
  const stderrTail: string[] = [];
  const confirmadas = new Set<number>(); // chamadas que chegaram a ser atendidas
  const gravadas = new Map<number, { local: string; remoto: string }>(); // arquivos que o motor terminou de gravar, por chamada
  let gravacaoAtiva = false;
  const rejeitadas = new Set<number>();
  /** Número com o prefixo de saída → como a pessoa digitou (para mostrar e gravar no histórico). */
  const prefixados = new Map<string, string>();
  // Chamadas recusadas sozinhas pelo Não perturbe: não tocam, mas entram no histórico como perdidas.
  const silenciadas = new Map<number, { numero: string; inicioMs: number }>();
  const snapshot: PhoneSnapshot = {
    motor: options.enginePath ? "parado" : "indisponivel",
    registro: "desconectado",
    mensagem: options.enginePath ? "" : "O motor do telefone não está instalado neste computador.",
    ramal: "",
    chamadas: [],
    naoPerturbe: false,
    dispositivos: { capture: [], playback: [] },
  };

  const copia = (): PhoneSnapshot => JSON.parse(JSON.stringify(snapshot));
  const publicar = () => options.send({ type: "state", snapshot: copia() });
  const ajustar = (parcial: Partial<PhoneSnapshot>) => { Object.assign(snapshot, parcial); publicar(); };
  const chamada = (id: number) => snapshot.chamadas.find((c) => c.id === id);
  // Transferência: depois que a central aceita o pedido, a perna do operador sai logo (com uma folga curta para uma recusa).
  const FOLGA_RECUSA_MS = 700;
  const saidas = new Map<number, ReturnType<typeof setTimeout>>();
  const cancelarSaidaTransferida = (id: number) => { const t = saidas.get(id); if (t) { clearTimeout(t); saidas.delete(id); } };
  const encerrarPernaTransferida = (id: number, apos: number) => {
    if (saidas.has(id) && apos > 0) return; // já agendado
    cancelarSaidaTransferida(id);
    const sair = () => { saidas.delete(id); try { enviar({ cmd: "hangup", id }); } catch { /* motor já caiu */ } };
    if (apos <= 0) sair(); else saidas.set(id, setTimeout(sair, apos));
  };

  function enviar(cmd: Record<string, unknown>) {
    if (!engine || engine.killed || !engine.stdin.writable) throw new Error("O telefone não está ligado.");
    engine.stdin.write(JSON.stringify(cmd) + "\n");
  }

  // ---- gravação e envio -------------------------------------------------------------------------
  const apagar = (...arquivos: string[]) => { for (const a of arquivos) { try { unlinkSync(a); } catch { /* já não existe */ } } };
  /** Dentro da pasta de gravações e com o nome que o motor gera: nada que a interface ou o servidor mande vira caminho. */
  const dentroDaPasta = (arq: string) => {
    if (!options.gravacaoDir) return false;
    const rel = path.relative(options.gravacaoDir, arq);
    return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel) && /^chamada-\d+-\d+-(local|remoto)\.wav$/.test(path.basename(arq));
  };

  /** Pergunta ao servidor se a gravação está liberada (o administrador liga em Admin > Histórico de chamadas) e avisa o motor. */
  async function atualizarGravacao() {
    if (!options.gravacaoDir || !ultimoToken || !engine) return;
    try {
      const r = await doFetch(new URL("/api/phone/gravacao-config", options.chatOrigin()), { headers: { Authorization: `Bearer ${ultimoToken}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(8000) });
      const corpo: unknown = await r.json().catch(() => ({}));
      const ativa = r.ok && (corpo as { ativa?: unknown })?.ativa === true;
      if (ativa) mkdirSync(options.gravacaoDir, { recursive: true });
      gravacaoAtiva = ativa;
      enviar({ cmd: "rec_dir", dir: ativa ? options.gravacaoDir.replace(/\\/g, "/") : "" });
    } catch { /* sem resposta: mantém o que já estava */ }
  }

  async function enviarGravacao(g: GravacaoPendente, metaPath: string): Promise<boolean> {
    if (!ultimoToken) return false;
    try {
      const form = new FormData();
      form.set("direcao", g.direcao);
      form.set("numero", g.numero);
      form.set("inicioMs", String(g.inicioMs));
      form.set("duracaoSeg", String(g.duracaoSeg));
      form.set("local", new Blob([readFileSync(g.local)], { type: "audio/wav" }), "local.wav");
      form.set("remoto", new Blob([readFileSync(g.remoto)], { type: "audio/wav" }), "remoto.wav");
      const r = await doFetch(new URL("/api/phone/gravacoes", options.chatOrigin()), { method: "POST", headers: { Authorization: `Bearer ${ultimoToken}` }, body: form, redirect: "error", signal: AbortSignal.timeout(120_000) });
      if (r.ok || r.status === 409 || r.status === 400 || r.status === 403) { apagar(g.local, g.remoto, metaPath); return r.ok || r.status === 409; } // o servidor decidiu: não adianta reenviar
      return false;
    } catch (e) {
      log("warn", `gravação não enviada: ${e instanceof Error ? e.message : "erro"}`);
      return false;
    }
  }

  /** Reenvia o que ficou para trás (sem rede, servidor fora). Apaga o que passou de 7 dias. */
  async function reenviarPendentes() {
    if (!options.gravacaoDir) return;
    let nomes: string[] = [];
    try { nomes = readdirSync(options.gravacaoDir); } catch { return; }
    for (const nome of nomes) {
      const arq = path.join(options.gravacaoDir, nome);
      try {
        if (Date.now() - statSync(arq).mtimeMs > GRAVACAO_VALIDADE_MS) { apagar(arq); continue; }
        if (!nome.endsWith(".json")) continue;
        const g = JSON.parse(readFileSync(arq, "utf8")) as GravacaoPendente;
        if (!dentroDaPasta(g.local) || !dentroDaPasta(g.remoto)) { apagar(arq); continue; }
        await enviarGravacao(g, arq);
      } catch { /* arquivo incompleto: o prazo de 7 dias limpa */ }
    }
  }

  function guardarGravacao(c: PhoneCall, atendida: boolean, duracaoSeg: number) {
    const arqs = gravadas.get(c.id);
    gravadas.delete(c.id);
    if (!arqs) return;
    // Só guarda conversa de verdade: chamada que não foi atendida ou sem arquivos válidos é descartada na hora.
    if (!atendida || !dentroDaPasta(arqs.local) || !dentroDaPasta(arqs.remoto)) { apagar(arqs.local, arqs.remoto); return; }
    const g: GravacaoPendente = { direcao: c.direcao, numero: c.numero, inicioMs: c.inicioMs, duracaoSeg, local: arqs.local, remoto: arqs.remoto };
    const metaPath = arqs.local.replace(/-local\.wav$/, ".json");
    try { writeFileSync(metaPath, JSON.stringify(g)); } catch { /* sem meta, ainda tenta enviar agora */ }
    void enviarGravacao(g, metaPath);
  }

  function fecharChamada(c: PhoneCall, status: number, duracaoSegMotor: number) {
    const atendida = confirmadas.has(c.id);
    let resultado: PhoneResult;
    if (atendida) resultado = "atendida";
    else if (rejeitadas.has(c.id)) resultado = "rejeitada";
    else if (c.direcao === "in") resultado = "nao_atendida";
    else resultado = status >= 400 && status !== 487 ? "falhou" : "nao_atendida";
    const duracaoSeg = atendida ? Math.max(duracaoSegMotor, c.atendidaMs ? Math.round((Date.now() - c.atendidaMs) / 1000) : 0) : 0;
    options.send({ type: "history", direcao: c.direcao, numero: c.numero, resultado, duracaoSeg, inicioMs: c.inicioMs });
    guardarGravacao(c, atendida, duracaoSeg);
    confirmadas.delete(c.id);
    rejeitadas.delete(c.id);
  }

  function aoEvento(m: Record<string, unknown>) {
    switch (m.event) {
      case "ready":
        // Motor recém-ligado (ou religado depois de uma queda): reaplica o Não perturbe antes de qualquer chamada chegar.
        if (snapshot.naoPerturbe) { try { enviar({ cmd: "dnd", on: true }); } catch { /* motor já caiu */ } }
        pendingInit?.resolve();
        pendingInit = null;
        restarts = 0;
        ajustar({ motor: "pronto", mensagem: "" });
        break;
      case "levels": {
        const nivel = (v: unknown) => Math.max(0, Math.min(255, int(v)));
        if (snapshot.chamadas.some((c) => c.estado === "conversando")) options.send({ type: "levels", mic: nivel(m.mic), remoto: nivel(m.remoto) });
        break;
      }
      case "recording_saved": {
        const local = text(m.local, 600), remoto = text(m.remote, 600);
        if (local && remoto) gravadas.set(int(m.id, -1), { local, remoto });
        break;
      }
      case "devices": {
        const lista = (v: unknown): PhoneDevice[] =>
          Array.isArray(v) ? v.slice(0, 64).map((d: any) => ({ id: int(d?.id), name: text(d?.name, 80) })) : [];
        ajustar({ dispositivos: { capture: lista(m.capture), playback: lista(m.playback) } });
        break;
      }
      case "reg_state": {
        const codigo = int(m.code);
        // Depois de bloqueado por senha recusada, só uma nova conexão pedida pelo usuário muda esse estado.
        if (snapshot.registro === "recusado" && !(codigo >= 200 && codigo < 300 && m.active === true)) break;
        if (codigo >= 200 && codigo < 300 && m.active === true) {
          falhasAutenticacao = 0;
          ajustar({ registro: "registrado", mensagem: "" });
        } else if (codigo >= 200 && codigo < 300) {
          ajustar({ registro: "desconectado", mensagem: "" });
        } else if (codigo === 401 || codigo === 403 || codigo === 404 || codigo === 407) {
          // O PJSIP já respondeu ao desafio de autenticação sozinho: um 401/403 que chega aqui é recusa definitiva
          // (senha ou ramal errados). Insistir só bloquearia o ramal na central, então para na hora.
          falhasAutenticacao++;
          try { enviar({ cmd: "unregister" }); } catch { /* motor já caiu */ }
          ajustar({ registro: "recusado", mensagem: "A central recusou o ramal ou a senha. Peça ao administrador para conferir a conta em Admin > Telefone." });
        } else if (codigo >= 300) {
          ajustar({ registro: "falhou", mensagem: "Sem conexão com a central de telefonia. Tentando de novo…" });
        }
        break;
      }
      case "incoming_blocked": {
        // Motor novo: já respondeu 486 Ocupado sem tocar. Só guarda para o histórico (como perdida, sem aviso).
        silenciadas.set(int(m.id, -1), { numero: identificarRemoto(m.remote).numero, inicioMs: Date.now() });
        break;
      }
      case "incoming": {
        const id = int(m.id, -1);
        const r = identificarRemoto(m.remote);
        if (snapshot.naoPerturbe) {
          silenciadas.set(id, { numero: r.numero, inicioMs: Date.now() });
          try { enviar({ cmd: "reject", id }); } catch { /* motor já caiu */ }
          break; // sem toque, sem faixa, sem aviso na tela
        }
        void atualizarGravacao();
        const c: PhoneCall = { id, direcao: "in", numero: r.numero, nome: r.nome, estado: "tocando", inicioMs: Date.now(), atendidaMs: null, mudo: false, espera: false };
        snapshot.chamadas = [...snapshot.chamadas.filter((x) => x.id !== id), c];
        options.send({ type: "incoming", call: { ...c } });
        publicar();
        break;
      }
      case "call_started": {
        const id = int(m.id, -1);
        if (!chamada(id)) {
          const discado = text(m.number, 64);
          const digitado = prefixados.get(discado);
          prefixados.delete(discado);
          const c: PhoneCall = { id, direcao: "out", numero: digitado ?? discado, nome: "", estado: "chamando", inicioMs: Date.now(), atendidaMs: null, mudo: false, espera: false };
          snapshot.chamadas = [...snapshot.chamadas, c];
          publicar();
        }
        break;
      }
      case "call_state": {
        const id = int(m.id, -1);
        const c = chamada(id);
        if (!c) break;
        const estado = text(m.state, 20);
        if (estado === "confirmed") {
          if (!c.atendidaMs) c.atendidaMs = Date.now();
          c.estado = "conversando";
          confirmadas.add(id);
        } else if (estado === "early") c.estado = c.direcao === "out" ? "chamando" : c.estado;
        if (c.direcao === "out" && !c.numero) c.numero = identificarRemoto(m.remote).numero;
        publicar();
        break;
      }
      case "transfer_status": {
        const c = chamada(int(m.id, -1));
        if (!c) break;
        const codigo = int(m.status);
        if (codigo >= 100 && codigo < 300) {
          c.avisoTransferencia = undefined;
          // A central já aceitou o pedido: não adianta esperar o destino atender (isso levava de 5 a 10 segundos).
          // Se uma recusa chegar nesta folga curta, a ligação continua e o aviso aparece; senão, nossa perna sai.
          if (codigo >= 200 && m.final === true) encerrarPernaTransferida(c.id, 0);
          else encerrarPernaTransferida(c.id, FOLGA_RECUSA_MS);
        } else if (codigo >= 300) {
          cancelarSaidaTransferida(c.id);
          c.transferindo = false;
          c.avisoTransferencia = codigo === 404 ? "A central não achou esse destino. Confira o ramal da fila." : codigo === 403 ? "A central não permitiu transferir para esse destino." : `A central recusou a transferência (${codigo}).`;
          publicar();
        }
        break;
      }
      case "call_ended": {
        const id = int(m.id, -1);
        const silenciada = silenciadas.get(id);
        if (silenciada) {
          silenciadas.delete(id);
          options.send({ type: "history", direcao: "in", numero: silenciada.numero, resultado: "nao_atendida", duracaoSeg: 0, inicioMs: silenciada.inicioMs, silenciosa: true });
          break;
        }
        const c = chamada(id);
        if (!c) break;
        cancelarSaidaTransferida(id);
        snapshot.chamadas = snapshot.chamadas.filter((x) => x.id !== id);
        fecharChamada(c, int(m.status), int(m.durationSec));
        publicar();
        break;
      }
      case "error":
        log("warn", `motor: ${text(m.cmd, 30)}: ${text(m.message, 200)}`);
        if (m.cmd === "init" || m.cmd === "register") {
          pendingInit?.reject(new Error(text(m.message, 200) || "Falha ao iniciar o telefone."));
          pendingInit = null;
          ajustar({ registro: "falhou", mensagem: "Não foi possível iniciar o telefone." });
        }
        break;
      default:
        break; // hello, media, play_done, pong, devices_set...: nada a mostrar
    }
  }

  function ligarMotor(): Promise<void> {
    if (engine) return Promise.resolve();
    if (!options.enginePath) return Promise.reject(new Error("O motor do telefone não está instalado neste computador."));
    ajustar({ motor: "iniciando", mensagem: "" });
    const proc = spawn(options.enginePath, options.engineArgs ?? [], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    engine = proc;
    let buffer = "";
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 1_000_000) buffer = ""; // proteção contra saída sem fim de linha
      let i: number;
      while ((i = buffer.indexOf("\n")) >= 0) {
        const linha = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!linha) continue;
        try {
          const m = JSON.parse(linha);
          if (m && typeof m === "object" && !Array.isArray(m)) aoEvento(m as Record<string, unknown>);
        } catch {
          log("warn", "motor: linha que não é JSON foi ignorada");
        }
      }
    });
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk: string) => {
      for (const l of chunk.split(/\r?\n/)) if (l) { stderrTail.push(l.slice(0, 300)); if (stderrTail.length > 200) stderrTail.shift(); }
    });
    proc.stdin.on("error", () => { /* o motor fechou; o evento "exit" trata */ });
    proc.on("error", (e) => {
      log("error", `motor não iniciou: ${e.message}`);
      engine = null;
      pendingInit?.reject(new Error("Não foi possível iniciar o motor do telefone."));
      pendingInit = null;
      ajustar({ motor: "erro", registro: "falhou", mensagem: "Não foi possível iniciar o motor do telefone." });
    });
    proc.on("exit", (code, signal) => {
      engine = null;
      for (const c of snapshot.chamadas) fecharChamada(c, 0, 0);
      snapshot.chamadas = [];
      silenciadas.clear();
      if (encerrando) { ajustar({ motor: "parado", registro: "desconectado", mensagem: "" }); return; }
      log("warn", `motor encerrou (código ${code}, sinal ${signal})`);
      pendingInit?.reject(new Error("O motor do telefone encerrou ao iniciar."));
      pendingInit = null;
      if (restarts < 3) {
        restarts++;
        ajustar({ motor: "erro", registro: "falhou", mensagem: "O telefone foi reiniciado. Reconectando…" });
        restartTimer = setTimeout(() => { restartTimer = null; void conectarComUltimoToken(); }, (options.restartDelayMs ?? 3000) * restarts);
      } else ajustar({ motor: "erro", registro: "falhou", mensagem: "O telefone parou de funcionar. Reabra o Workscape." });
    });
    return new Promise<void>((resolve, reject) => {
      pendingInit = { resolve, reject };
      const t = setTimeout(() => { if (pendingInit) { pendingInit = null; reject(new Error("O motor do telefone não respondeu.")); } }, 15000);
      t.unref?.();
      try { enviar({ cmd: "init", transport: "udp", logLevel: 3, echoTailMs: 200 }); } catch (e) { reject(e as Error); }
    });
  }

  let ultimoToken = "";
  async function buscarCredenciais(token: string) {
    const url = new URL("/api/phone/credenciais", options.chatOrigin());
    const r = await doFetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(15000) });
    const corpo: unknown = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(text((corpo as { error?: unknown })?.error) || "Não foi possível obter o ramal.");
    return credenciaisSchema.parse(corpo);
  }

  async function conectar(token: string) {
    if (!z.string().min(1).max(16384).safeParse(token).success) throw new Error("Sessão inválida.");
    ultimoToken = token;
    falhasAutenticacao = 0;
    ajustar({ registro: "registrando", mensagem: "" });
    try {
      const { conta, senha } = await buscarCredenciais(token);
      await ligarMotor();
      snapshot.ramal = conta.ramal;
      if (regTimer) clearTimeout(regTimer);
      regTimer = setTimeout(() => {
        regTimer = null;
        if (snapshot.registro === "registrando") ajustar({ registro: "falhou", mensagem: "A central não respondeu. Confira a rede ou a VPN e tente de novo." });
      }, options.registerTimeoutMs ?? TEMPO_MAX_REGISTRO_MS);
      regTimer.unref?.();
      enviar({
        cmd: "register", user: conta.sipUser, password: senha, domain: conta.sipDomain, server: conta.sipServer,
        port: conta.sipPort, transport: conta.transport, displayName: conta.displayName, registerRefresh: 60, keepAlive: 15,
      });
      enviar({ cmd: "devices" });
      void atualizarGravacao().then(reenviarPendentes);
      publicar();
    } catch (e) {
      ajustar({ registro: "falhou", mensagem: e instanceof Error ? e.message : "Falha ao conectar o telefone." });
      throw e;
    }
  }
  const conectarComUltimoToken = () => (ultimoToken ? conectar(ultimoToken).catch(() => {}) : Promise.resolve());

  const idDe = (v: unknown) => z.object({ id: z.number().int().min(0).max(1_000_000) }).passthrough().parse(v).id;

  return {
    snapshot: copia,
    stderrTail: () => stderrTail.slice(-100),
    conectar,
    desconectar() {
      ultimoToken = "";
      try { enviar({ cmd: "unregister" }); } catch { /* já parado */ }
      ajustar({ registro: "desconectado", mensagem: "", ramal: "" });
    },
    ligar(numero: unknown) {
      const n = z.string().regex(NUMERO).parse(typeof numero === "string" ? numero.trim() : numero);
      if (snapshot.registro !== "registrado") throw new Error("O telefone ainda não está conectado à central.");
      if (snapshot.chamadas.filter((c) => c.estado !== "encerrada").length >= 4) throw new Error("Muitas chamadas ao mesmo tempo.");
      const discado = numeroDeSaida(n);
      // A tela e o histórico seguem mostrando o número como a pessoa digitou (sem o 0 que a central exige).
      if (discado !== n) prefixados.set(discado, n);
      void atualizarGravacao();
      enviar({ cmd: "call", number: discado });
    },
    /** Há ligação tocando, sendo feita ou em andamento: o aplicativo não pode reiniciar nem fechar para atualizar. */
    temChamadaAtiva: () => snapshot.chamadas.some((c) => c.estado !== "encerrada"),
    atender: (v: unknown) => enviar({ cmd: "answer", id: idDe(v) }),
    rejeitar(v: unknown) { const id = idDe(v); rejeitadas.add(id); enviar({ cmd: "reject", id }); },
    desligar: (v: unknown) => enviar({ cmd: "hangup", id: idDe(v) }),
    mudo(v: unknown) {
      const { id, on } = z.object({ id: z.number().int().min(0), on: z.boolean() }).parse(v);
      enviar({ cmd: "mute", id, on });
      const c = chamada(id);
      if (c) { c.mudo = on; publicar(); }
    },
    espera(v: unknown) {
      const { id, on } = z.object({ id: z.number().int().min(0), on: z.boolean() }).parse(v);
      enviar({ cmd: on ? "hold" : "unhold", id });
      const c = chamada(id);
      if (c) { c.espera = on; publicar(); }
    },
    dtmf(v: unknown) {
      const { id, digits } = z.object({ id: z.number().int().min(0), digits: z.string().regex(DIGITOS) }).parse(v);
      enviar({ cmd: "dtmf", id, digits });
    },
    transferir(v: unknown) {
      const { id, to } = z.object({ id: z.number().int().min(0), to: z.string().regex(NUMERO) }).parse(v);
      const c = chamada(id);
      enviar({ cmd: "transfer", id, to });
      if (c) { c.transferindo = true; c.avisoTransferencia = undefined; publicar(); }
    },
    /** Liga ou desliga o Não perturbe. Vale já para a próxima chamada e não derruba as que estão em andamento. */
    definirNaoPerturbe(on: unknown) {
      const v = z.boolean().parse(on);
      if (snapshot.naoPerturbe === v) return;
      snapshot.naoPerturbe = v;
      // No motor, a central recebe "486 Ocupado" já na primeira resposta, sem "Ringing". Sem motor ligado, vale ao ligar.
      try { enviar({ cmd: "dnd", on: v }); } catch { /* o ready reaplica */ }
      publicar();
    },
    dispositivos() { enviar({ cmd: "devices" }); },
    definirDispositivos(v: unknown) {
      const { capture, playback } = z.object({ capture: z.number().int().min(0).max(255).optional(), playback: z.number().int().min(0).max(255).optional() }).strict().parse(v);
      enviar({ cmd: "set_devices", ...(capture !== undefined ? { capture } : {}), ...(playback !== undefined ? { playback } : {}) });
    },
    /** Encerra o motor com o app: cancela o registro e espera um instante para a central liberar o ramal. */
    async parar() {
      encerrando = true;
      if (restartTimer) clearTimeout(restartTimer);
      if (regTimer) clearTimeout(regTimer);
      const proc = engine;
      if (!proc) return;
      try { proc.stdin.write(JSON.stringify({ cmd: "quit" }) + "\n"); } catch { /* ignora */ }
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => { proc.kill(); resolve(); }, 2000);
        proc.once("exit", () => { clearTimeout(t); resolve(); });
      });
    },
  };
}
export type Phone = ReturnType<typeof createPhone>;

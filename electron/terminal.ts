import { createHash, randomUUID } from "node:crypto";
import net from "node:net";
import { readFile, writeFile, rename } from "node:fs/promises";
import { Client, type ClientChannel } from "ssh2";
import { z } from "zod";

/**
 * Terminal SSH/Telnet do Workspace (estilo SecureCRT). Toda a conexão acontece aqui, no processo principal:
 * a interface só recebe os bytes da sessão e nunca vê as senhas salvas.
 */

export const protocolos = ["ssh", "telnet"] as const;
const hostRegex = /^[A-Za-z0-9._:-]{1,253}$/;

/** Anti-idle: manda um caractere discreto de tempos em tempos para o equipamento não derrubar a sessão por inatividade. */
export const modosAntiIdle = ["nulo", "enter", "espaco"] as const;
export const textoAntiIdle: Record<(typeof modosAntiIdle)[number], string> = { nulo: "\0", enter: "\r", espaco: " \x08" };
const antiIdleCampos = {
  antiIdle: z.boolean().default(true),
  antiIdleSegundos: z.number().int().min(10).max(3600).default(60),
  antiIdleModo: z.enum(modosAntiIdle).default("nulo"),
};
export const antiIdleSchema = z.object({ ativo: z.boolean(), segundos: z.number().int().min(10).max(3600), modo: z.enum(modosAntiIdle) }).strict();

export const equipamentoSchema = z
  .object({
    id: z.string().max(64).optional(),
    nome: z.string().trim().min(1).max(80),
    grupo: z.string().trim().max(60).default(""),
    protocolo: z.enum(protocolos),
    host: z.string().trim().regex(hostRegex, "Endereço inválido."),
    porta: z.number().int().min(1).max(65535),
    usuario: z.string().max(120).default(""),
    /** Só chega preenchida quando a pessoa digitou uma senha nova; vazia mantém a que já estava salva. */
    senha: z.string().max(512).optional(),
    guardarSenha: z.boolean().default(false),
    ...antiIdleCampos,
  })
  .strict();

export const conectarSchema = z
  .object({
    sessao: z.string().min(1).max(64),
    equipamentoId: z.string().max(64).optional(),
    /** Conexão rápida (sem equipamento salvo) ou senha digitada na hora. */
    rapido: equipamentoSchema.omit({ id: true, nome: true, grupo: true, guardarSenha: true }).partial({ usuario: true, senha: true }).optional(),
    senha: z.string().max(512).optional(),
    antiIdle: antiIdleSchema.optional(),
    cols: z.number().int().min(10).max(500).default(100),
    rows: z.number().int().min(2).max(200).default(30),
  })
  .strict();

export interface EquipamentoSalvo {
  id: string;
  nome: string;
  grupo: string;
  protocolo: (typeof protocolos)[number];
  host: string;
  porta: number;
  usuario: string;
  antiIdle?: boolean;
  antiIdleSegundos?: number;
  antiIdleModo?: (typeof modosAntiIdle)[number];
  /** Senha cifrada pelo Windows (safeStorage), em base64. */
  senhaCifrada?: string;
}
export interface EquipamentoDto extends Omit<EquipamentoSalvo, "senhaCifrada" | "antiIdle" | "antiIdleSegundos" | "antiIdleModo"> {
  antiIdle: boolean;
  antiIdleSegundos: number;
  antiIdleModo: (typeof modosAntiIdle)[number];
  temSenha: boolean;
}

export interface Cifra {
  disponivel(): boolean;
  cifrar(texto: string): string;
  decifrar(base64: string): string;
}

export type EnviarEvento = (canal: "terminal:dados" | "terminal:estado", payload: unknown) => void;

type Conexao = { fechar(): void; escrever(dados: string): void; redimensionar(cols: number, rows: number): void };

const dto = ({ senhaCifrada, ...resto }: EquipamentoSalvo): EquipamentoDto => ({
  ...resto,
  antiIdle: resto.antiIdle ?? true,
  antiIdleSegundos: resto.antiIdleSegundos ?? 60,
  antiIdleModo: resto.antiIdleModo ?? "nulo",
  temSenha: Boolean(senhaCifrada),
});

export function impressaoDigital(chave: Buffer) {
  return "SHA256:" + createHash("sha256").update(chave).digest("base64").replace(/=+$/, "");
}

/** Telnet mínimo: recusa as opções do servidor, exceto eco e "suprimir go-ahead", e informa o tamanho da janela. */
export class FiltroTelnet {
  private estado: "dados" | "iac" | "opcao" | "sub" | "subiac" = "dados";
  private comando = 0;
  constructor(private responder: (bytes: number[]) => void, private aoDados: (dados: Buffer) => void) {}
  entrada(bloco: Buffer) {
    const saida: number[] = [];
    for (const b of bloco) {
      switch (this.estado) {
        case "dados":
          if (b === 255) this.estado = "iac";
          else saida.push(b);
          break;
        case "iac":
          if (b === 255) { saida.push(255); this.estado = "dados"; }
          else if (b >= 251 && b <= 254) { this.comando = b; this.estado = "opcao"; }
          else if (b === 250) this.estado = "sub";
          else this.estado = "dados";
          break;
        case "opcao": {
          // 251 WILL / 252 WONT / 253 DO / 254 DONT
          const aceita = b === 1 || b === 3; // eco e suprimir go-ahead
          if (this.comando === 251) this.responder([255, aceita ? 253 : 254, b]);
          else if (this.comando === 253) this.responder([255, aceita || b === 31 ? 251 : 252, b]);
          this.estado = "dados";
          break;
        }
        case "sub":
          if (b === 255) this.estado = "subiac";
          break;
        case "subiac":
          this.estado = b === 240 ? "dados" : "sub";
          break;
      }
    }
    if (saida.length) this.aoDados(Buffer.from(saida));
  }
}

export function tamanhoTelnet(cols: number, rows: number) {
  const par = (n: number) => (n === 255 ? [255, 255] : [n]);
  return [255, 250, 31, ...par(cols >> 8), ...par(cols & 255), ...par(rows >> 8), ...par(rows & 255), 255, 240];
}

export class ServicoTerminal {
  private sessoes = new Map<string, Conexao>();
  private antiIdles = new Map<string, { ativo: boolean; segundos: number; modo: (typeof modosAntiIdle)[number]; ultimo: number; timer: ReturnType<typeof setInterval> }>();
  constructor(
    private arquivoEquipamentos: (dono: string) => string,
    private arquivoChaves: string,
    private cifra: Cifra,
    private enviar: EnviarEvento,
    /** Equipamentos da lista central ("srv:<id>"): o processo principal busca o acesso (com a senha) no servidor. */
    private buscarCentral?: (id: string) => Promise<{ protocolo: "ssh" | "telnet"; host: string; porta: number; usuario: string; senha?: string }>,
  ) {}

  // ---------- equipamentos salvos (por pessoa) ----------
  private async ler(dono: string): Promise<EquipamentoSalvo[]> {
    try {
      const lista = JSON.parse(await readFile(this.arquivoEquipamentos(dono), "utf8"));
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  }
  private async gravar(dono: string, lista: EquipamentoSalvo[]) {
    const destino = this.arquivoEquipamentos(dono);
    await writeFile(destino + ".tmp", JSON.stringify(lista, null, 2), { mode: 0o600 });
    await rename(destino + ".tmp", destino);
  }
  async listar(dono: string) {
    return (await this.ler(dono)).map(dto);
  }
  async salvar(dono: string, entrada: unknown) {
    const e = equipamentoSchema.parse(entrada);
    const lista = await this.ler(dono);
    const anterior = e.id ? lista.find((i) => i.id === e.id) : undefined;
    let senhaCifrada = anterior?.senhaCifrada;
    if (e.protocolo === "telnet" || !e.guardarSenha) senhaCifrada = undefined;
    else if (e.senha) {
      if (!this.cifra.disponivel()) throw new Error("Armazenamento seguro indisponível: não dá para guardar a senha neste computador.");
      senhaCifrada = this.cifra.cifrar(e.senha);
    }
    const novo: EquipamentoSalvo = {
      id: anterior?.id ?? randomUUID(),
      nome: e.nome, grupo: e.grupo, protocolo: e.protocolo, host: e.host, porta: e.porta, usuario: e.usuario,
      antiIdle: e.antiIdle, antiIdleSegundos: e.antiIdleSegundos, antiIdleModo: e.antiIdleModo,
      ...(senhaCifrada ? { senhaCifrada } : {}),
    };
    await this.gravar(dono, anterior ? lista.map((i) => (i.id === novo.id ? novo : i)) : [...lista, novo]);
    return dto(novo);
  }
  /** Lista local com as senhas já decifradas — só para o processo principal enviar ao servidor (importação de administrador). */
  async exportarLocais(dono: string) {
    return (await this.ler(dono)).map((e) => {
      let senha: string | undefined;
      if (e.senhaCifrada && this.cifra.disponivel()) { try { senha = this.cifra.decifrar(e.senhaCifrada); } catch { /* senha de outro usuário do Windows */ } }
      return { nome: e.nome, grupo: e.grupo, protocolo: e.protocolo, host: e.host, porta: e.porta, usuario: e.usuario, senha, guardarSenha: Boolean(senha), antiIdle: e.antiIdle ?? true, antiIdleSegundos: e.antiIdleSegundos ?? 60, antiIdleModo: e.antiIdleModo ?? "nulo" };
    });
  }
  async excluir(dono: string, id: string) {
    await this.gravar(dono, (await this.ler(dono)).filter((i) => i.id !== id));
  }

  // ---------- chaves de servidor conhecidas (confia na primeira vez e bloqueia se mudar) ----------
  private async chavesConhecidas(): Promise<Record<string, string>> {
    try { return JSON.parse(await readFile(this.arquivoChaves, "utf8")); } catch { return {}; }
  }
  private async conferirChave(host: string, porta: number, chave: Buffer): Promise<{ ok: boolean; nova: boolean; digital: string; esperada?: string }> {
    const digital = impressaoDigital(chave);
    const conhecidas = await this.chavesConhecidas();
    const id = `${host.toLowerCase()}:${porta}`;
    const esperada = conhecidas[id];
    if (esperada) return { ok: esperada === digital, nova: false, digital, esperada };
    conhecidas[id] = digital;
    await writeFile(this.arquivoChaves, JSON.stringify(conhecidas, null, 2), { mode: 0o600 });
    return { ok: true, nova: true, digital };
  }
  /** Esquece a chave de um equipamento (por exemplo, depois de trocar o equipamento). */
  async esquecerChave(host: string, porta: number) {
    const conhecidas = await this.chavesConhecidas();
    delete conhecidas[`${host.toLowerCase()}:${porta}`];
    await writeFile(this.arquivoChaves, JSON.stringify(conhecidas, null, 2), { mode: 0o600 });
  }

  // ---------- sessões ----------
  private dados(sessao: string, bytes: Buffer | string) {
    this.enviar("terminal:dados", { sessao, dados: typeof bytes === "string" ? Buffer.from(bytes) : bytes });
  }
  private estado(sessao: string, estado: "conectando" | "conectado" | "fechado" | "erro", mensagem?: string) {
    this.enviar("terminal:estado", { sessao, estado, mensagem });
  }

  async conectar(dono: string, entrada: unknown) {
    const c = conectarSchema.parse(entrada);
    if (this.sessoes.has(c.sessao)) throw new Error("Essa sessão já está aberta.");
    let alvo: { protocolo: "ssh" | "telnet"; host: string; porta: number; usuario: string; senha?: string };
    if (c.equipamentoId?.startsWith("srv:")) {
      if (!this.buscarCentral) throw new Error("Lista central indisponível.");
      const e = await this.buscarCentral(c.equipamentoId);
      alvo = { ...e, senha: c.senha || e.senha };
    } else if (c.equipamentoId) {
      const e = (await this.ler(dono)).find((i) => i.id === c.equipamentoId);
      if (!e) throw new Error("Equipamento não encontrado.");
      let senha = c.senha;
      if (!senha && e.senhaCifrada && this.cifra.disponivel()) senha = this.cifra.decifrar(e.senhaCifrada);
      alvo = { protocolo: e.protocolo, host: e.host, porta: e.porta, usuario: e.usuario, senha };
    } else if (c.rapido) {
      alvo = { protocolo: c.rapido.protocolo, host: c.rapido.host, porta: c.rapido.porta, usuario: c.rapido.usuario ?? "", senha: c.senha ?? c.rapido.senha };
    } else throw new Error("Informe o equipamento.");

    this.estado(c.sessao, "conectando");
    this.iniciarAntiIdle(c.sessao, c.antiIdle ?? { ativo: true, segundos: 60, modo: "nulo" });
    if (alvo.protocolo === "ssh") this.abrirSsh(c.sessao, alvo, c.cols, c.rows);
    else this.abrirTelnet(c.sessao, alvo, c.cols, c.rows);
  }

  private abrirSsh(sessao: string, alvo: { host: string; porta: number; usuario: string; senha?: string }, cols: number, rows: number) {
    const cliente = new Client();
    let canal: ClientChannel | null = null;
    let encerrada = false;
    const encerrar = (estado: "fechado" | "erro", mensagem?: string) => {
      if (encerrada) return;
      encerrada = true;
      this.sessoes.delete(sessao);
      this.pararAntiIdle(sessao);
      try { cliente.end(); } catch { /* já fechado */ }
      this.estado(sessao, estado, mensagem);
    };
    this.sessoes.set(sessao, {
      fechar: () => encerrar("fechado"),
      escrever: (d) => canal?.write(d),
      redimensionar: (c, r) => canal?.setWindow(r, c, 0, 0),
    });
    cliente.on("ready", () => {
      cliente.shell({ term: "xterm-256color", cols, rows }, (erro, stream) => {
        if (erro) return encerrar("erro", erro.message);
        canal = stream;
        this.estado(sessao, "conectado");
        stream.on("data", (d: Buffer) => this.dados(sessao, d));
        stream.stderr.on("data", (d: Buffer) => this.dados(sessao, d));
        stream.on("close", () => encerrar("fechado"));
      });
    });
    cliente.on("error", (erro) => {
      const m = /All configured authentication methods failed/.test(erro.message) ? "Usuário ou senha recusados pelo equipamento." : erro.message;
      encerrar("erro", m);
    });
    cliente.on("close", () => encerrar("fechado"));
    // Equipamentos de rede antigos (OLTs, switches) costumam só oferecer algoritmos legados; aceita-os além dos atuais.
    cliente.connect({
      host: alvo.host,
      port: alvo.porta,
      username: alvo.usuario || undefined,
      password: alvo.senha,
      tryKeyboard: Boolean(alvo.senha),
      readyTimeout: 20000,
      keepaliveInterval: 30000,
      algorithms: {
        kex: { append: ["diffie-hellman-group14-sha1", "diffie-hellman-group1-sha1", "diffie-hellman-group-exchange-sha1"] },
        serverHostKey: { append: ["ssh-rsa", "ssh-dss"] },
        cipher: { append: ["aes128-cbc", "aes192-cbc", "aes256-cbc", "3des-cbc"] },
      },
      hostVerifier: (chave: Buffer, ok: (valido: boolean) => void) => {
        void this.conferirChave(alvo.host, alvo.porta, chave).then((r) => {
          if (!r.ok) {
            this.dados(sessao, `\r\n\x1b[31mA chave de ${alvo.host} mudou!\x1b[0m\r\nEsperada ${r.esperada}\r\nRecebida ${r.digital}\r\nPode ser outro equipamento no mesmo endereço ou alguém no meio do caminho. Conexão recusada.\r\nSe o equipamento foi trocado, use "Esquecer chave" na lista.\r\n`);
          } else if (r.nova) {
            this.dados(sessao, `\x1b[33mPrimeira conexão com ${alvo.host}. Chave guardada: ${r.digital}\x1b[0m\r\n`);
          }
          ok(r.ok);
        }, () => ok(false));
      },
    } as never);
    cliente.on("keyboard-interactive", (_n, _i, _l, prompts, terminar) => terminar(prompts.map(() => alvo.senha ?? "")));
  }

  private abrirTelnet(sessao: string, alvo: { host: string; porta: number }, cols: number, rows: number) {
    const soquete = net.connect({ host: alvo.host, port: alvo.porta });
    soquete.setKeepAlive(true, 30000);
    soquete.setTimeout(20000, () => { if (!conectado) { soquete.destroy(); encerrar("erro", "Tempo esgotado ao conectar."); } });
    let conectado = false;
    let encerrada = false;
    let tamanho = { cols, rows };
    const encerrar = (estado: "fechado" | "erro", mensagem?: string) => {
      if (encerrada) return;
      encerrada = true;
      this.sessoes.delete(sessao);
      this.pararAntiIdle(sessao);
      soquete.destroy();
      this.estado(sessao, estado, mensagem);
    };
    const filtro = new FiltroTelnet(
      (bytes) => {
        soquete.write(Buffer.from(bytes));
        // Aceitou informar o tamanho da janela (opção 31): envia o tamanho atual.
        if (bytes[1] === 251 && bytes[2] === 31) soquete.write(Buffer.from(tamanhoTelnet(tamanho.cols, tamanho.rows)));
      },
      (d) => this.dados(sessao, d),
    );
    this.sessoes.set(sessao, {
      fechar: () => encerrar("fechado"),
      escrever: (d) => soquete.write(Buffer.from([...Buffer.from(d, "utf8")].flatMap((b) => (b === 255 ? [255, 255] : [b])))),
      redimensionar: (c, r) => { tamanho = { cols: c, rows: r }; if (conectado) soquete.write(Buffer.from(tamanhoTelnet(c, r))); },
    });
    soquete.on("connect", () => {
      conectado = true;
      soquete.setTimeout(0);
      this.estado(sessao, "conectado");
    });
    soquete.on("data", (d: Buffer) => filtro.entrada(d));
    soquete.on("error", (erro) => encerrar("erro", erro.message));
    soquete.on("close", () => encerrar("fechado"));
  }

  /** A cada 5 s confere se a pessoa ficou sem digitar pelo tempo escolhido e, se sim, manda o caractere de manutenção. */
  private iniciarAntiIdle(sessao: string, cfg: { ativo: boolean; segundos: number; modo: (typeof modosAntiIdle)[number] }) {
    this.pararAntiIdle(sessao);
    const timer = setInterval(() => {
      const a = this.antiIdles.get(sessao);
      const conexao = this.sessoes.get(sessao);
      if (!a || !conexao) return;
      if (a.ativo && Date.now() - a.ultimo >= a.segundos * 1000) {
        a.ultimo = Date.now();
        conexao.escrever(textoAntiIdle[a.modo]);
      }
    }, 5000);
    timer.unref?.();
    this.antiIdles.set(sessao, { ...cfg, ultimo: Date.now(), timer });
  }
  private pararAntiIdle(sessao: string) {
    const a = this.antiIdles.get(sessao);
    if (a) clearInterval(a.timer);
    this.antiIdles.delete(sessao);
  }
  configurarAntiIdle(sessao: string, entrada: unknown) {
    const cfg = antiIdleSchema.parse(entrada);
    const a = this.antiIdles.get(sessao);
    if (!a) return;
    Object.assign(a, cfg, { ultimo: Date.now() });
  }

  entrada(sessao: string, dados: string) {
    const a = this.antiIdles.get(sessao);
    if (a) a.ultimo = Date.now();
    this.sessoes.get(sessao)?.escrever(dados);
  }
  tamanho(sessao: string, cols: number, rows: number) {
    this.sessoes.get(sessao)?.redimensionar(cols, rows);
  }
  fechar(sessao: string) {
    this.sessoes.get(sessao)?.fechar();
  }
  fecharTodas() {
    for (const s of [...this.sessoes.values()]) s.fechar();
  }
}

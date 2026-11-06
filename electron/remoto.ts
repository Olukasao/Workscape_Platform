import { randomBytes } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { safeStorage } from "electron";

// Suporte remoto: o programa de acesso remoto vai empacotado com o Workspace e fala só com o nosso servidor (nada de serviço de terceiros).
// Conexão direta (sem a pessoa precisar aceitar): só para o acesso master, com uma senha permanente gerada aqui,
// guardada cifrada neste computador e entregue ao servidor; mais ninguém além do master a recebe de volta.
export const SERVIDOR_REMOTO = process.env.WORKSPACE_REMOTO_SERVIDOR || "192.168.1.133";
export const CHAVE_REMOTO = process.env.WORKSPACE_REMOTO_CHAVE || "QoJR9ShPG5BLOf38bvR4OwjY6QG5mzLOQTw1yiXivYc=";
const ID = /^[0-9]{6,12}$/;
const gerarSenha = () => randomBytes(18).toString("base64").replace(/[+/=]/g, "").slice(0, 20);

export function configuracaoRemoto(servidor = SERVIDOR_REMOTO, chave = CHAVE_REMOTO) {
  return [
    `rendezvous_server = '${servidor}:21116'`,
    "nat_type = 1",
    "serial = 0",
    "",
    "[options]",
    `custom-rendezvous-server = '${servidor}'`,
    `relay-server = '${servidor}'`,
    `key = '${chave}'`,
    "",
  ].join("\n");
}

export const idValido = (v: unknown): v is string => typeof v === "string" && ID.test(v);

export function createRemoto(options: { exePath: string | null; configDir: string | null }) {
  let iniciado = false;
  const disponivel = () => !!options.exePath && existsSync(options.exePath);
  // Uma cópia do programa já aberta antes desta configuração usa os servidores de fábrica e nunca aparece no nosso. Reinicia uma única vez.
  function precisaReiniciar(): boolean {
    if (!options.configDir) return false;
    const marca = path.join(options.configDir, "workspace-servidor.v2");
    if (existsSync(marca)) return false;
    try { mkdirSync(options.configDir, { recursive: true }); writeFileSync(marca, "ok", "utf8"); } catch { /* tenta de novo na próxima vez */ }
    return true;
  }
  const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
  function gravarConfiguracao() {
    if (!options.configDir) return;
    const arquivo = path.join(options.configDir, "RustDesk2.toml");
    const novo = configuracaoRemoto();
    let atual = "";
    try { atual = readFileSync(arquivo, "utf8"); } catch { /* ainda não existe */ }
    if (atual === novo) return;
    mkdirSync(options.configDir, { recursive: true });
    writeFileSync(arquivo, novo, "utf8");
  }
  function lerId(): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(options.exePath!, ["--get-id"], { timeout: 20_000, windowsHide: true }, (erro, saida) => {
        const id = String(saida ?? "").trim().split(/\s+/).pop() ?? "";
        if (idValido(id)) resolve(id); else reject(erro ?? new Error("Não foi possível obter o ID deste computador."));
      });
    });
  }
  // A senha permanente deste computador: gerada uma vez, cifrada com a chave do Windows deste usuário (safeStorage) e
  // guardada só aqui. Nunca aparece na tela; só é mandada (cifrada pelo HTTPS) ao servidor, que só a devolve ao master.
  function senhaPermanente(): string | null {
    if (!options.configDir) return null;
    const arquivo = path.join(options.configDir, "workspace-senha.enc");
    try {
      if (existsSync(arquivo) && safeStorage.isEncryptionAvailable()) {
        const decifrada = safeStorage.decryptString(Buffer.from(readFileSync(arquivo, "utf8"), "base64"));
        if (decifrada) return decifrada;
      }
    } catch { /* arquivo corrompido ou de outra máquina: gera uma nova senha abaixo */ }
    if (!safeStorage.isEncryptionAvailable()) return null; // sem o cofre do Windows disponível, não guarda senha permanente
    const nova = gerarSenha();
    try {
      mkdirSync(options.configDir, { recursive: true });
      writeFileSync(arquivo, safeStorage.encryptString(nova).toString("base64"), "utf8");
    } catch { /* segue sem salvar: pede uma nova na próxima vez */ }
    return nova;
  }
  function definirSenhaPermanente(senha: string): Promise<void> {
    return new Promise((resolve) => {
      // Flag documentada do RustDesk para configurar acesso sem supervisão por script (modo "--server" já em segundo plano).
      execFile(options.exePath!, ["--password", senha], { timeout: 15_000, windowsHide: true }, () => resolve());
    });
  }
  return {
    disponivel,
    /** Grava a configuração do servidor, deixa o programa rodando em segundo plano (para receber pedidos) e devolve o ID e a senha permanente deste computador. */
    async iniciar(): Promise<{ id: string; senha: string | null }> {
      if (!disponivel()) throw new Error("O módulo de suporte remoto não está instalado neste computador.");
      gravarConfiguracao();
      const senha = senhaPermanente();
      if (!iniciado) {
        iniciado = true;
        if (precisaReiniciar()) {
          await new Promise<void>((r) => execFile("taskkill", ["/F", "/IM", path.basename(options.exePath!)], { windowsHide: true }, () => r()));
          await pausa(1500);
        }
        // "--server" é o modo de segundo plano: registra este computador no nosso servidor e atende os pedidos de conexão, sem abrir janela.
        spawn(options.exePath!, ["--server"], { detached: true, stdio: "ignore", windowsHide: true }).unref();
        await pausa(3000);
        if (senha) await definirSenhaPermanente(senha);
      }
      const id = await lerId();
      return { id, senha };
    },
    /** Abre a conexão com outro computador pelo ID. Com a senha permanente dele, entra direto, sem a pessoa precisar aceitar. */
    conectar(id: unknown, senha?: unknown) {
      if (!disponivel()) throw new Error("O módulo de suporte remoto não está instalado neste computador.");
      if (!idValido(id)) throw new Error("ID inválido.");
      gravarConfiguracao();
      const args = typeof senha === "string" && senha ? ["--connect", id, "--password", senha] : ["--connect", id];
      spawn(options.exePath!, args, { detached: true, stdio: "ignore" }).unref();
    },
  };
}

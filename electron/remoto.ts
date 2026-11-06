import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Suporte remoto: o programa de acesso remoto vai empacotado com o Workspace e fala só com o nosso servidor (nada de serviço de terceiros).
// A interface nunca recebe senhas; só o ID do computador, que não dá acesso sozinho (quem recebe ainda precisa aceitar).
export const SERVIDOR_REMOTO = process.env.WORKSPACE_REMOTO_SERVIDOR || "192.168.1.133";
export const CHAVE_REMOTO = process.env.WORKSPACE_REMOTO_CHAVE || "QoJR9ShPG5BLOf38bvR4OwjY6QG5mzLOQTw1yiXivYc=";
const ID = /^[0-9]{6,12}$/;

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
  return {
    disponivel,
    /** Grava a configuração do servidor, deixa o programa rodando em segundo plano (para receber pedidos) e devolve o ID deste computador. */
    async iniciar(): Promise<string> {
      if (!disponivel()) throw new Error("O módulo de suporte remoto não está instalado neste computador.");
      gravarConfiguracao();
      if (!iniciado) {
        iniciado = true;
        spawn(options.exePath!, ["--tray"], { detached: true, stdio: "ignore", windowsHide: true }).unref();
      }
      return lerId();
    },
    /** Abre a conexão com outro computador pelo ID. */
    conectar(id: unknown) {
      if (!disponivel()) throw new Error("O módulo de suporte remoto não está instalado neste computador.");
      if (!idValido(id)) throw new Error("ID inválido.");
      gravarConfiguracao();
      spawn(options.exePath!, ["--connect", id], { detached: true, stdio: "ignore" }).unref();
    },
  };
}

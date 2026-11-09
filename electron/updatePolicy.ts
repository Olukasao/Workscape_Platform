import { z } from "zod";
import { gt, valid, prerelease } from "semver";
import { updateOrigin } from "./updateDeployment";

export type UpdatePhase = "unavailable" | "idle" | "checking" | "downloading" | "ready" | "installing" | "error";
export interface UpdateStatus {
  phase: UpdatePhase;
  currentVersion: string;
  nextVersion?: string;
  percent?: number;
  message: string;
  /** Presente quando a TI forçou a atualização para todos os computadores. */
  forced?: { obrigatoria: boolean; mensagem?: string; ignorarRegra?: boolean };
}

/** Sinal publicado pela TI no canal (signal.json) para forçar a verificação imediata nos computadores. */
export function parseUpdateSignal(input: unknown) {
  const result = z.object({
    id: z.string().trim().min(1).max(64),
    obrigatoria: z.boolean().optional(),
    mensagem: z.string().trim().max(200).optional(),
    ignorarRegra: z.boolean().optional(),
  }).passthrough().safeParse(input);
  return result.success
    ? { id: result.data.id, obrigatoria: result.data.obrigatoria === true, mensagem: result.data.mensagem || undefined, ignorarRegra: result.data.ignorarRegra === true }
    : null;
}

export function validateUpdateConfig(input: unknown) {
  const config = z.object({
    provider: z.literal("generic"),
    url: z.string().url(),
    publisherName: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]).optional(),
  }).passthrough().parse(input);
  const url = new URL(config.url);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
    throw new Error("O canal de atualização exige HTTPS sem credenciais na URL.");
  // Sem publicador (build sem assinatura), só o servidor com certificado fixado é aceito.
  if (!config.publisherName && url.origin !== updateOrigin)
    throw new Error("Sem assinatura digital, o canal de atualização deve ser o servidor interno fixado.");
  return config;
}

export function validateUpdateInfo(input: unknown, feed: string, currentVersion: string) {
  const info = z.object({
    version: z.string(),
    files: z.array(z.object({ url: z.string(), sha512: z.string() }).passthrough()).min(1),
    packages: z.unknown().optional(),
  }).passthrough().parse(input);
  if (!valid(info.version) || prerelease(info.version) || !gt(info.version, currentVersion))
    throw new Error("Versão de atualização inválida ou anterior à instalada.");
  if (info.packages) throw new Error("Instaladores web não são aceitos neste canal.");
  const base = new URL(feed.endsWith("/") ? feed : `${feed}/`);
  for (const file of info.files) {
    const url = new URL(file.url, base);
    if (url.protocol !== "https:" || url.origin !== base.origin || url.username || url.password || url.hash ||
      !url.pathname.startsWith(base.pathname) || !url.pathname.toLowerCase().endsWith(".exe") ||
      !/^[A-Za-z0-9+/]{86}==$/.test(file.sha512))
      throw new Error("Arquivo de atualização fora do canal autorizado ou sem checksum válido.");
  }
  return info;
}

/** Impede ciclo de reinstalação se um instalador não conseguir concluir. */
export function canAttemptStartupUpdate(input: unknown, currentVersion: string, now = Date.now()) {
  const result = z.object({ version: z.string(), attemptedAt: z.number().finite().optional() }).safeParse(input);
  return result.success && !!valid(result.data.version) && gt(result.data.version, currentVersion) &&
    (result.data.attemptedAt === undefined || now - result.data.attemptedAt >= 24 * 60 * 60 * 1000);
}

/**
 * Atualização silenciosa: depois de baixada, só reinicia sozinha quando ninguém está usando o aplicativo —
 * nenhuma janela visível (minimizado ou na bandeja) ou computador parado há alguns minutos. Nunca durante
 * envio/download em andamento, e atualização obrigatória (com aviso na tela) segue o fluxo próprio.
 */
export const SILENT_IDLE_SECONDS = 180;
export function shouldApplySilently(input: {
  phase: UpdatePhase;
  obrigatoria: boolean;
  canInstall: boolean;
  idleSeconds: number;
  windowVisible: boolean;
  /** A TI mandou atualizar ignorando ligação, telefone aberto e envios: reinicia assim que estiver pronta. */
  ignorarRegra?: boolean;
}) {
  if (input.phase === "ready" && !input.obrigatoria && input.ignorarRegra) return true;
  if (input.phase !== "ready" || input.obrigatoria || !input.canInstall) return false;
  return !input.windowVisible || input.idleSeconds >= SILENT_IDLE_SECONDS;
}

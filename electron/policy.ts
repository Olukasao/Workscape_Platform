import { z } from "zod";
import { agendaOrigin, chatOrigin, dashboardOrigin } from "./agendaDeployment";
import { ambienteTeste, chatTesteOrigin } from "./ambiente";
export const serviceNames = ["chat", "agenda", "dashboard"] as const;
export const configSchema = z
  .object({
    chat: z.string().max(2048),
    agenda: z.string().max(2048),
    dashboard: z.string().max(2048),
    allowInsecureLan: z.boolean(),
    launchAtLogin: z.boolean(),
    closeToTray: z.boolean(),
    // Enable only behind a gateway that verifies JWT and authorizes writes.
    authorizedAgendaGateway: z.boolean(),
  })
  .strict();
export type ServerConfig = z.infer<typeof configSchema>;
export const defaultConfig: ServerConfig = {
  chat: ambienteTeste ? chatTesteOrigin : chatOrigin,
  agenda: agendaOrigin,
  dashboard: dashboardOrigin,
  allowInsecureLan: false,
  launchAtLogin: false,
  closeToTray: true,
  authorizedAgendaGateway: false,
};
export function validateConfig(input: unknown): ServerConfig {
  const migrated =
    input && typeof input === "object" && !Array.isArray(input)
      ? ({ ...input } as Record<string, unknown>)
      : input;
  if (migrated && typeof migrated === "object") {
    const legacy = migrated as Record<string, unknown>;
    delete legacy.instalacao;
    if (
      !legacy.chat ||
      String(legacy.chat).replace(/\/+$/, "") === "https://chat.suaempresa.com.br"
    )
      legacy.chat = ambienteTeste ? chatTesteOrigin : chatOrigin;
    // O app de testes nunca fala com o chat oficial, mesmo que a configuração salva aponte para ele.
    else if (ambienteTeste && String(legacy.chat).replace(/\/+$/, "") === chatOrigin) legacy.chat = chatTesteOrigin;
    if (
      !legacy.agenda ||
      [
        "http://192.168.1.133:8500",
        "https://agenda.suaempresa.com.br",
      ].includes(String(legacy.agenda).replace(/\/+$/, ""))
    )
      legacy.agenda = agendaOrigin;
    if (
      !legacy.dashboard ||
      [
        "https://dashboard.suaempresa.com.br",
        "http://192.168.1.133",
        "http://192.168.1.133:80",
        "http://192.168.1.133:8500",
        "https://192.168.1.133:8500",
      ].includes(
        String(legacy.dashboard).trim().replace(/\/+$/, ""),
      )
    )
      legacy.dashboard = dashboardOrigin;
  }
  const c = configSchema.parse(migrated);
  for (const key of serviceNames) {
    if (!c[key]) continue;
    const u = new URL(c[key]);
    if (u.username || u.password || u.search || u.hash || u.pathname !== "/")
      throw new Error(
        "Use somente a origem do servidor, sem caminho ou credenciais.",
      );
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    const pinnedDashboard = key === "dashboard" && u.origin === dashboardOrigin;
    const corporateChat = key === "chat" && (u.origin === chatOrigin || (ambienteTeste && u.origin === chatTesteOrigin));
    if (
      u.protocol !== "https:" &&
      !(u.protocol === "http:" && (local || corporateChat || pinnedDashboard || c.allowInsecureLan))
    )
      throw new Error("Use HTTPS ou habilite HTTP legado conscientemente.");
    c[key] = u.origin;
  }
  return c;
}
export const requestSchema = z
  .object({
    service: z.enum(serviceNames),
    path: z.string().max(4096),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    token: z.string().max(16384).optional(),
    agendaSession: z.string().max(4096).optional(),
    body: z.unknown().optional(),
    files: z
      .array(
        z.object({
          name: z.string().max(200),
          filename: z.string().max(300).optional(),
          type: z.string().max(200).optional(),
          bytes: z.instanceof(Uint8Array).optional(),
          value: z.string().optional(),
        }),
      )
      .optional(),
  })
  .strict();
// Escritas da agenda feitas com a sessão do Chat Interno (cabeçalho x-agenda-session), como no app antigo.
// Somente estas rotas e métodos são aceitos; o restante exige o gateway autenticado.
const id = "[^/]+";
const AGENDA_WRITES: [RegExp, RegExp][] = [
  [/^(POST)$/, /^\/api\/technician-absences$/],
  [/^(PUT|DELETE)$/, new RegExp(`^/api/technician-absences/${id}$`)],
  [/^(POST)$/, new RegExp(`^/api/technician-absences/${id}/complete$`)],
  [/^(POST)$/, /^\/api\/technician-team-colors$/],
  [/^(PUT|DELETE)$/, new RegExp(`^/api/technician-team-colors/${id}$`)],
  [/^(POST)$/, /^\/api\/agenda-(tecnicos|instalacao)\/almocos$/],
  [/^(PUT|DELETE)$/, new RegExp(`^/api/agenda-(tecnicos|instalacao)/almocos/${id}$`)],
  [/^(POST)$/, new RegExp(`^/api/agenda-tecnicos/almocos/${id}/(terminar|reabrir)$`)],
  [/^(POST)$/, /^\/api\/agenda-instalacao\/ausencias$/],
  [/^(PUT|DELETE)$/, new RegExp(`^/api/agenda-instalacao/ausencias/${id}$`)],
  [/^(POST)$/, new RegExp(`^/api/agenda-tecnicos/ordens-servico/${id}/tecnico-responsavel$`)],
];
export function isAgendaWrite(service: string, method: string, pathname: string, session?: string) {
  return service === "agenda" && !!session && AGENDA_WRITES.some(([m, p]) => m.test(method) && p.test(pathname));
}
export function resolveRequest(config: ServerConfig, input: unknown) {
  const r = requestSchema.parse(input);
  if (!config[r.service]) throw new Error("Servidor não configurado.");
  if (
    !r.path.startsWith("/api/") ||
    r.path.includes("\\") ||
    /[\r\n]/.test(r.path)
  )
    throw new Error("Caminho de API inválido.");
  const base = new URL(config[r.service]);
  const url = new URL(r.path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith("/api/"))
    throw new Error("Destino não autorizado.");
  if (
    r.service !== "chat" &&
    r.method !== "GET" &&
    !config.authorizedAgendaGateway &&
    !isAgendaWrite(r.service, r.method, url.pathname, r.agendaSession)
  )
    throw new Error("Escritas exigem gateway autenticado.");
  return { r, url };
}
export function isAppSender(url: string, dev = false) {
  try {
    const u = new URL(url);
    return (
      (u.protocol === "app:" && u.host === "workspace") ||
      (dev && u.origin === "http://127.0.0.1:5178")
    );
  } catch {
    return false;
  }
}
export function conversationTarget(target: string) {
  return (
    /^\/chat(?:\?(?:conversa|grupo)=\d+)?$/.test(target) ||
    target === "/contratacoes" ||
    target === "/chamados?aba=avaliacoes" ||
    target === "/" ||
    target === "/lembretes" ||
    target === "/atendimento" ||
    target === "/rede" ||
    target === "/settings" ||
    /^\/agenda\?os=\d+&data=\d{4}-\d{2}-\d{2}$/.test(target)
  );
}

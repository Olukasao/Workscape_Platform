import { app, BrowserWindow, powerMonitor, session } from "electron";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { gt, valid } from "semver";
import { load } from "js-yaml";
import { NsisUpdater } from "electron-updater";
import log from "electron-log/main";
import { canAttemptStartupUpdate, parseUpdateSignal, shouldApplySilently, validateUpdateConfig, type UpdateStatus } from "./updatePolicy";
import { verifyUpdateSignature } from "./updateSignature";
import { UpdateController } from "./updateController";
import { isPinnedUpdateCertificate } from "./updateTrust";

const relaunchFile = () => path.join(app.getPath("userData"), "silent-relaunch.json");
/** Depois de uma atualização silenciosa o app volta do mesmo jeito que estava: visível, minimizado ou na bandeja. */
export async function consumeSilentRelaunch(): Promise<"visible" | "minimized" | "hidden" | null> {
  try {
    const raw = JSON.parse(await readFile(relaunchFile(), "utf8"));
    await rm(relaunchFile(), { force: true });
    if (typeof raw.at !== "number" || Date.now() - raw.at > 5 * 60 * 1000) return null;
    return ["visible", "minimized", "hidden"].includes(raw.mode) ? raw.mode : null;
  } catch {
    return null;
  }
}

export async function startUpdates(window: BrowserWindow, prepareQuit: () => void, canInstall: () => boolean) {
  let status: UpdateStatus = { phase: "unavailable", currentVersion: app.getVersion(), message: "O canal de atualizações ainda não foi configurado pela TI." };
  let controller: UpdateController | undefined;
  const publish = (value: UpdateStatus) => {
    status = value;
    if (window.isDestroyed()) return;
    window.webContents.send("updates:status", value);
    // Só a atualização obrigatória chama a atenção; as demais são baixadas e aplicadas em silêncio.
    if (value.forced?.obrigatoria && value.phase === "ready" && !window.isVisible()) {
      window.show();
      window.focus();
    }
  };
  const readStatus = () => controller?.getStatus() || { ...status };
  const unavailable = (message: string) => { status.message = message; };
  let startup = async () => false;
  const api = {
    startup: () => startup(),
    status: readStatus,
    check: async () => controller ? controller.check() : readStatus(),
    install: async () => { if (!controller) throw new Error(status.message); await controller.installLatest(); },
  };
  if (!app.isPackaged || process.platform !== "win32") {
    unavailable("Atualizações automáticas estão disponíveis no aplicativo Windows instalado.");
    return api;
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    unavailable("A versão portátil não recebe atualizações automáticas. Use o instalador do aplicativo.");
    return api;
  }
  try {
    const configPath = path.join(process.resourcesPath, "app-update.yml");
    const config = validateUpdateConfig(load(await readFile(configPath, "utf8")));
    log.transports.file.maxSize = 2 * 1024 * 1024;
    // O electron-updater usa uma sessão própria ("electron-updater"), não a padrão: o certificado fixado
    // do canal interno precisa ser aceito também nela. Qualquer outro certificado segue a validação do Chromium.
    session.fromPartition("electron-updater", { cache: false }).setCertificateVerifyProc((request, callback) => {
      callback(isPinnedUpdateCertificate(request.hostname, request.certificate.data) ? 0 : -3);
    });
    const updater = new NsisUpdater();
    updater.logger = log;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;
    updater.allowDowngrade = false;
    updater.allowPrerelease = false;
    updater.disableWebInstaller = true;
    // Mantém Authenticode e recusa também erros na ferramenta de verificação.
    updater.verifyUpdateCodeSignature = verifyUpdateSignature;
    const marker = path.join(app.getPath("userData"), "update-pending.json");
    const savePending = async (value: { version: string; attemptedAt?: number }) => {
      await writeFile(marker + ".tmp", JSON.stringify(value), { mode: 0o600 });
      await rename(marker + ".tmp", marker);
    };
    controller = new UpdateController(updater, config.url, app.getVersion(), publish, prepareQuit, canInstall, (error) => log.warn("Updater:", error), async (version) => {
      let previous: { version?: string; attemptedAt?: number } = {};
      try { previous = JSON.parse(await readFile(marker, "utf8")); } catch { /* Sem marcador anterior. */ }
      await savePending({ version, attemptedAt: previous.version === version ? previous.attemptedAt : undefined });
    });
    try {
      const pending = JSON.parse(await readFile(marker, "utf8"));
      if (canAttemptStartupUpdate(pending, app.getVersion())) {
        startup = async () => {
          // Só usar o cache após nova consulta do canal e validação pela biblioteca.
          let timeout: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([controller!.check(), new Promise<void>((resolve) => { timeout = setTimeout(resolve, 5000); })]);
            const status = controller!.getStatus();
            if (status.phase !== "ready" || !status.nextVersion) return false;
            await savePending({ version: status.nextVersion, attemptedAt: Date.now() });
            controller!.install();
            return controller!.getStatus().phase === "installing";
          } catch { return false; }
          finally { if (timeout) clearTimeout(timeout); }
        };
      } else if (typeof pending.version !== "string" || !valid(pending.version) || !gt(pending.version, app.getVersion())) {
        await rm(marker, { force: true });
      }
    } catch { /* Primeira instalação ou cache ainda inexistente. */ }
    status = controller.getStatus();
    const check = () => { void controller?.check(); };
    // Aplica sozinho, sem avisos, quando ninguém está usando o aplicativo.
    const silent = setInterval(() => {
      const current = controller!.getStatus();
      const windows = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
      const visible = windows.some((w) => w.isVisible() && !w.isMinimized());
      if (!shouldApplySilently({
        phase: current.phase,
        obrigatoria: !!current.forced?.obrigatoria,
        canInstall: canInstall(),
        ignorarRegra: !!current.forced?.ignorarRegra,
        idleSeconds: powerMonitor.getSystemIdleTime(),
        windowVisible: visible,
      })) return;
      const mode = visible ? "visible" : window.isVisible() ? "minimized" : "hidden";
      void writeFile(relaunchFile(), JSON.stringify({ at: Date.now(), mode }), { mode: 0o600 })
        .then(() => controller!.installLatest())
        .catch((error) => log.warn("Atualização silenciosa:", error instanceof Error ? error.message : "falha"));
    }, 60 * 1000);
    silent.unref();
    // Sinal da TI (signal.json no canal): um identificador novo força a verificação imediata neste computador.
    const feedBase = config.url.endsWith("/") ? config.url : `${config.url}/`;
    const signalUrl = new URL("signal.json", feedBase).href;
    const signalFile = path.join(app.getPath("userData"), "update-signal.json");
    let lastSignal: string | undefined;
    try { lastSignal = JSON.parse(await readFile(signalFile, "utf8")).id; } catch { /* Ainda sem sinal visto. */ }
    const rememberSignal = async (id: string) => {
      lastSignal = id;
      await writeFile(signalFile, JSON.stringify({ id }), { mode: 0o600 }).catch(() => undefined);
    };
    let polling = false;
    const pollSignal = async () => {
      if (polling) return;
      polling = true;
      try {
        const response = await session.fromPartition("electron-updater", { cache: false })
          .fetch(signalUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (response.status === 404) { if (lastSignal === undefined) await rememberSignal(""); return; }
        if (!response.ok) return;
        const signal = parseUpdateSignal(await response.json());
        if (!signal || signal.id === lastSignal) return;
        const first = lastSignal === undefined;
        await rememberSignal(signal.id);
        // Na primeira leitura o sinal é só a linha de base: o que já existia não é reexecutado.
        if (first) return;
        controller?.setForced({ obrigatoria: signal.obrigatoria, mensagem: signal.mensagem, ignorarRegra: signal.ignorarRegra });
        void controller?.check();
      } catch { /* Sem rede ou sinal inválido: tenta de novo no próximo ciclo. */ }
      finally { polling = false; }
    };
    const signalTimer = setInterval(() => { void pollSignal(); }, 30000 + Math.random() * 5000);
    signalTimer.unref();
    setTimeout(() => { void pollSignal(); }, 5000 + Math.random() * 5000).unref();
    const initial = setTimeout(check, 15000 + Math.random() * 45000);
    // Procura a cada ~5 min (o arquivo consultado é minúsculo), inclusive com uma atualização já baixada.
    // O sorteio de até 1 min evita que todos os computadores consultem o servidor no mesmo instante.
    const periodic = setInterval(check, 5 * 60 * 1000 + Math.random() * 60 * 1000);
    initial.unref(); periodic.unref();
    powerMonitor.on("resume", check);
    powerMonitor.on("resume", () => { void pollSignal(); });
    // Não iniciar a instalação quando o Windows está encerrando a sessão.
    const sessionEnd = () => { updater.autoInstallOnAppQuit = false; };
    window.on("query-session-end", sessionEnd);
    window.on("session-end", sessionEnd);
    powerMonitor.on("shutdown", sessionEnd);
    app.on("before-quit", () => {
      if (!canInstall()) updater.autoInstallOnAppQuit = false;
      clearTimeout(initial); clearInterval(periodic); clearInterval(signalTimer); clearInterval(silent);
      powerMonitor.removeListener("resume", check);
    });
  } catch (error) {
    // Não expor URLs, caminhos locais ou detalhes de certificados na interface.
    log.warn("Atualizações indisponíveis:", error instanceof Error ? error.message : "configuração inválida");
  }
  return api;
}

import { validateUpdateInfo, type UpdateStatus } from "./updatePolicy";

export interface UpdaterPort {
  checkForUpdates(): Promise<{ updateInfo: unknown; isUpdateAvailable: boolean } | null>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(silent: boolean, restart: boolean): void;
  on(event: string, listener: (...args: any[]) => void): unknown;
}

const READY_MESSAGE = "Atualização pronta. Será instalada automaticamente quando o computador estiver parado ou o aplicativo minimizado, ou na próxima abertura. Você também pode reiniciar agora.";

/** Uma operação por vez; somente a biblioteca baixa e verifica o instalador. */
export class UpdateController {
  private busy = false;
  private status: UpdateStatus;
  private forced: UpdateStatus["forced"];
  constructor(private updater: UpdaterPort, private feed: string, private version: string,
    private publish: (state: UpdateStatus) => void, private prepareQuit: () => void,
    private canInstall: () => boolean, private log: (message: string) => void, private markReady: (version: string) => Promise<void> = async () => {}) {
    this.status = { phase: "idle", currentVersion: version, message: "Atualizações automáticas habilitadas." };
    updater.on("download-progress", (progress: { percent: number }) => {
      if (this.status.phase === "downloading") this.set({ ...this.status, percent: Math.max(0, Math.min(100, Math.round(progress.percent))) });
    });
    updater.on("error", (error: Error) => this.fail(error));
  }
  getStatus() { return { ...this.status }; }
  private set(state: UpdateStatus) {
    this.status = this.forced ? { ...state, forced: this.forced } : state;
    this.publish(this.getStatus());
  }
  /** Marca a atualização como forçada pela TI; o aviso na tela acompanha todas as fases seguintes. */
  setForced(forced: NonNullable<UpdateStatus["forced"]>) {
    this.forced = forced;
    this.set({ ...this.status });
  }
  private fail(error: unknown) {
    this.log(error instanceof Error ? error.message : "Falha no atualizador.");
    this.set({ phase: "error", currentVersion: this.version, message: "Não foi possível atualizar. A versão atual continua disponível; tentaremos novamente mais tarde." });
  }
  /**
   * Procura e baixa a versão mais nova do canal. Mesmo com uma atualização já baixada e ainda não instalada,
   * continua procurando: se saiu uma versão mais nova, baixa ela no lugar, para que ninguém instale uma
   * versão que já ficou velha. Falha de rede nunca derruba o estado "pronta".
   */
  async check() {
    if (this.busy || this.status.phase === "installing") return this.getStatus();
    const previous = this.status.phase === "ready" ? { ...this.status } : null;
    this.busy = true;
    if (!previous) this.set({ phase: "checking", currentVersion: this.version, message: "Verificando novas versões…" });
    try {
      let downloaded = previous?.nextVersion;
      // Até 3 rodadas: se outra versão sair durante o download, a seguinte também é buscada.
      for (let round = 0; round < 3; round++) {
        const result = await this.updater.checkForUpdates();
        if (!result?.isUpdateAvailable) {
          if (!downloaded) this.set({ phase: "idle", currentVersion: this.version, message: "Seu aplicativo está atualizado." });
          break;
        }
        // Nenhum download ocorre antes da validação de versão, origem e checksum.
        const info = validateUpdateInfo(result.updateInfo, this.feed, this.version);
        if (info.version === downloaded) break; // a versão baixada já é a mais nova do canal
        this.set({ phase: "downloading", currentVersion: this.version, nextVersion: info.version, percent: 0, message: previous ? "Há uma versão ainda mais nova; baixando em segundo plano…" : "Baixando atualização em segundo plano…" });
        await this.updater.downloadUpdate();
        await this.markReady(info.version);
        downloaded = info.version;
        this.set({ phase: "ready", currentVersion: this.version, nextVersion: info.version, percent: 100, message: READY_MESSAGE });
      }
      if (downloaded && this.status.phase !== "ready") this.set({ phase: "ready", currentVersion: this.version, nextVersion: downloaded, percent: 100, message: READY_MESSAGE });
    } catch (error) {
      if (previous && this.status.phase !== "ready") {
        // A atualização anterior continua baixada e válida; só a busca pela mais nova falhou.
        this.log(error instanceof Error ? error.message : "Falha ao procurar versão mais nova.");
        this.set(previous);
      } else if (previous) {
        this.log(error instanceof Error ? error.message : "Falha ao procurar versão mais nova.");
      } else this.fail(error);
    }
    finally { this.busy = false; }
    return this.getStatus();
  }
  /** Instala a versão mais nova: antes de reiniciar, confere uma última vez se saiu algo mais novo que o baixado. */
  async installLatest() {
    if (this.status.phase !== "ready") throw new Error("A atualização ainda não está pronta.");
    if (!this.forced?.ignorarRegra && !this.canInstall()) throw new Error("Aguarde o envio, o download ou a ligação em andamento, ou feche o telefone, antes de reiniciar.");
    const deadline = Date.now() + 120_000;
    while (this.busy && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
    await Promise.race([this.check(), new Promise<void>((resolve) => setTimeout(resolve, 120_000))]);
    this.install();
  }
  install() {
    if (this.status.phase !== "ready") throw new Error("A atualização ainda não está pronta.");
    if (!this.forced?.ignorarRegra && !this.canInstall()) throw new Error("Aguarde o envio, o download ou a ligação em andamento, ou feche o telefone, antes de reiniciar.");
    this.set({ ...this.status, phase: "installing", message: "Reiniciando para concluir a atualização…" });
    this.prepareQuit();
    this.updater.quitAndInstall(true, true);
  }
}

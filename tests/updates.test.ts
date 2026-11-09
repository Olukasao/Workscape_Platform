import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { canAttemptStartupUpdate, shouldApplySilently, parseUpdateSignal, validateUpdateConfig, validateUpdateInfo } from "../electron/updatePolicy";
import { matchesUpdateSigner } from "../electron/updateSignature";
import { isPinnedUpdateCertificate } from "../electron/updateTrust";
import { readFileSync } from "node:fs";
import { UpdateController } from "../electron/updateController";
const feed = "https://updates.example.test/windows/stable/";
const info = () => ({ version: "0.5.1", files: [{ url: "AcessaWorkspace-0.5.1-Setup.exe", sha512: Buffer.alloc(64).toString("base64") }] });
class Updater extends EventEmitter {
  checkForUpdates = vi.fn(async () => ({ isUpdateAvailable: true, updateInfo: info() }));
  downloadUpdate = vi.fn(async () => {});
  quitAndInstall = vi.fn();
}
function setup(updater = new Updater(), canInstall = () => true) {
  const prepare = vi.fn(), log = vi.fn(), publish = vi.fn();
  const controller = new UpdateController(updater, feed, "0.5.0", publish, prepare, canInstall, log);
  return { controller, updater, prepare, log, publish };
}
describe("política de distribuição", () => {
  it("não entra em ciclo de instalação após tentativa malsucedida na abertura", () => {
    const now = 1700000000000;
    expect(canAttemptStartupUpdate({ version: "0.5.1" }, "0.5.0", now)).toBe(true);
    expect(canAttemptStartupUpdate({ version: "0.5.1", attemptedAt: now }, "0.5.0", now)).toBe(false);
    expect(canAttemptStartupUpdate({ version: "0.5.1", attemptedAt: now - 86400000 }, "0.5.0", now)).toBe(true);
    expect(canAttemptStartupUpdate({ version: "0.5.0" }, "0.5.0", now)).toBe(false);
    expect(canAttemptStartupUpdate({ version: "bad" }, "0.5.0", now)).toBe(false);
  });
  it("exige canal HTTPS e identidade do publicador antes de habilitar o atualizador", () => {
    expect(validateUpdateConfig({ provider: "generic", url: feed, publisherName: "AcessaNet" }).url).toBe(feed);
    for (const url of ["http://updates.example.test", "https://user:pass@updates.example.test", feed + "?token=x", feed + "#x"]) {
      expect(() => validateUpdateConfig({ provider: "generic", url, publisherName: "AcessaNet" })).toThrow();
    }
    expect(() => validateUpdateConfig({ provider: "generic", url: feed })).toThrow();
  });
  it("recusa downgrade, pré-release, origem externa, saída da pasta e pacote sem integridade", () => {
    expect(validateUpdateInfo(info(), feed, "0.5.0").version).toBe("0.5.1");
    for (const version of ["0.4.1", "0.5.0", "0.5.2-beta.1", "invalid"]) expect(() => validateUpdateInfo({ ...info(), version }, feed, "0.5.0")).toThrow();
    for (const url of ["http://updates.example.test/windows/stable/app.exe", "https://evil.example/app.exe", "../app.exe", "app.exe#fragment", "app.zip"]) {
      const changed = info(); changed.files[0].url = url;
      expect(() => validateUpdateInfo(changed, feed, "0.5.0")).toThrow();
    }
    expect(() => validateUpdateInfo({ ...info(), packages: {} }, feed, "0.5.0")).toThrow();
    expect(() => validateUpdateInfo({ ...info(), files: [{ url: "app.exe", sha512: "bad" }] }, feed, "0.5.0")).toThrow();
  });
  it("recusa assinatura inválida, publicador diferente e verificação de outro arquivo", () => {
    const result = { Status: 0, Path: "C:\\cache\\app.exe", Subject: "CN=AcessaNet, O=AcessaNet, C=BR" };
    expect(() => matchesUpdateSigner(result, result.Path, ["CN=AcessaNet,O=AcessaNet,C=BR"])).not.toThrow();
    expect(() => matchesUpdateSigner({ ...result, Status: 2 }, result.Path, ["AcessaNet"])).toThrow();
    expect(() => matchesUpdateSigner(result, result.Path, ["Outra Empresa"])).toThrow();
    expect(() => matchesUpdateSigner(result, "C:\\cache\\other.exe", ["AcessaNet"])).toThrow();
    expect(() => matchesUpdateSigner({}, result.Path, ["AcessaNet"])).toThrow();
  });
});
describe("ciclo de atualização", () => {
  it("não baixa fora do grupo de distribuição mesmo se o manifesto anuncia versão mais nova", async () => {
    const { controller, updater } = setup();
    updater.checkForUpdates.mockResolvedValue({ isUpdateAvailable: false, updateInfo: info() });
    expect((await controller.check()).phase).toBe("idle");
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
  });
  it("só oferece instalação após download validado e preserva transferências em andamento", async () => {
    let sending = true;
    const { controller, updater, prepare } = setup(new Updater(), () => !sending);
    expect(() => controller.install()).toThrow();
    expect((await controller.check()).phase).toBe("ready");
    expect(() => controller.install()).toThrow(/Aguarde/);
    expect(prepare).not.toHaveBeenCalled();
    sending = false; controller.install();
    expect(prepare).toHaveBeenCalledOnce();
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true);
    expect(() => controller.install()).toThrow();
  });
  it("recusa manifesto malicioso antes do download e não instala quando a assinatura falha", async () => {
    const a = setup();
    a.updater.checkForUpdates.mockResolvedValue({ isUpdateAvailable: true, updateInfo: { ...info(), files: [{ url: "https://evil.example/app.exe", sha512: info().files[0].sha512 }] } });
    expect((await a.controller.check()).phase).toBe("error");
    expect(a.updater.downloadUpdate).not.toHaveBeenCalled();
    const b = setup(); b.updater.downloadUpdate.mockRejectedValue(new Error("invalid Authenticode signature"));
    expect((await b.controller.check()).phase).toBe("error");
    expect(() => b.controller.install()).toThrow();
    expect(b.updater.quitAndInstall).not.toHaveBeenCalled();
  });
  it("não duplica download e recupera a verificação depois de falha na rede", async () => {
    const { controller, updater } = setup();
    updater.checkForUpdates.mockRejectedValueOnce(new Error("offline"));
    expect((await controller.check()).phase).toBe("error");
    let done!: () => void;
    updater.downloadUpdate.mockImplementationOnce(() => new Promise<void>((resolve) => { done = resolve; }));
    const first = controller.check();
    await vi.waitFor(() => expect(updater.downloadUpdate).toHaveBeenCalledOnce());
    expect((await controller.check()).phase).toBe("downloading");
    done(); await first;
    await controller.check();
    expect(updater.downloadUpdate).toHaveBeenCalledOnce();
  });
});

describe("canal interno sem assinatura", () => {
  const pem = readFileSync("tests/fixtures/update-public.crt", "utf8");
  const now = Date.parse("2026-10-21T12:00:00Z");
  it("aceita só o certificado fixado, no host e na validade corretos", () => {
    expect(isPinnedUpdateCertificate("192.168.1.133", pem, now)).toBe(true);
    expect(isPinnedUpdateCertificate("evil.example", pem, now)).toBe(false);
    expect(isPinnedUpdateCertificate("192.168.1.133", pem, Date.parse("2040-01-01"))).toBe(false);
    expect(isPinnedUpdateCertificate("192.168.1.133", readFileSync("tests/fixtures/agenda-public.crt", "utf8"), now)).toBe(false);
    expect(isPinnedUpdateCertificate("192.168.1.133", "lixo", now)).toBe(false);
  });
  it("sem publicador, exige o servidor fixado", () => {
    expect(validateUpdateConfig({ provider: "generic", url: "https://192.168.1.133:8643/windows/stable/" }).url).toContain("8643");
    expect(() => validateUpdateConfig({ provider: "generic", url: "https://outro.example/windows/stable/" })).toThrow();
    expect(() => validateUpdateConfig({ provider: "generic", url: "https://192.168.1.133:9999/x/" })).toThrow();
  });
});

describe("atualização forçada pela TI", () => {
  it("lê o sinal do canal e recusa conteúdo inválido", () => {
    expect(parseUpdateSignal({ id: "abc-1", obrigatoria: true, mensagem: " Atualize " })).toEqual({ id: "abc-1", obrigatoria: true, mensagem: "Atualize", ignorarRegra: false });
    expect(parseUpdateSignal({ id: "abc-2" })).toEqual({ id: "abc-2", obrigatoria: false, mensagem: undefined, ignorarRegra: false });
    expect(parseUpdateSignal({ id: "abc-3", ignorarRegra: true })?.ignorarRegra).toBe(true);
    for (const ruim of [null, {}, { id: "" }, { id: 7 }, { id: "x".repeat(65) }, { id: "a", mensagem: "m".repeat(201) }, "texto"])
      expect(parseUpdateSignal(ruim)).toBeNull();
  });
  it("mantém a marca de forçada em todas as fases seguintes da atualização", async () => {
    const { controller, publish } = setup();
    controller.setForced({ obrigatoria: true, mensagem: "Agora" });
    const status = await controller.check();
    expect(status.phase).toBe("ready");
    expect(status.forced).toEqual({ obrigatoria: true, mensagem: "Agora" });
    expect(publish.mock.calls.map(([s]) => s.phase)).toEqual(expect.arrayContaining(["checking", "downloading", "ready"]));
    expect(publish.mock.calls.every(([s]) => s.forced?.obrigatoria === true)).toBe(true);
  });
});

describe("atualização silenciosa", () => {
  const base = { phase: "ready" as const, obrigatoria: false, canInstall: true, idleSeconds: 0, windowVisible: true };
  it("só reinicia sozinha quando ninguém está usando o aplicativo", () => {
    expect(shouldApplySilently(base)).toBe(false); // app visível e em uso
    expect(shouldApplySilently({ ...base, idleSeconds: 179 })).toBe(false);
    expect(shouldApplySilently({ ...base, idleSeconds: 180 })).toBe(true); // computador parado
    expect(shouldApplySilently({ ...base, windowVisible: false })).toBe(true); // minimizado ou na bandeja
  });
  it("nunca durante envio/download, sem estar pronta ou quando é obrigatória", () => {
    expect(shouldApplySilently({ ...base, windowVisible: false, canInstall: false })).toBe(false);
    expect(shouldApplySilently({ ...base, windowVisible: false, phase: "downloading" })).toBe(false);
    expect(shouldApplySilently({ ...base, windowVisible: false, obrigatoria: true })).toBe(false);
  });
});

describe("forçar ignorando a regra de ligação", () => {
  const base = { phase: "ready" as const, obrigatoria: false, canInstall: false, idleSeconds: 0, windowVisible: true };
  it("em silêncio reinicia assim que estiver pronta, mesmo em uso e com ligação", () => {
    expect(shouldApplySilently({ ...base, ignorarRegra: true })).toBe(true);
    expect(shouldApplySilently({ ...base, ignorarRegra: false })).toBe(false);
  });
  it("continua esperando o download e, com aviso, espera o clique", () => {
    expect(shouldApplySilently({ ...base, ignorarRegra: true, phase: "downloading" })).toBe(false);
    expect(shouldApplySilently({ ...base, ignorarRegra: true, obrigatoria: true })).toBe(false);
  });
  it("o botão Atualizar agora instala mesmo com ligação ativa só quando a TI mandou ignorar", async () => {
    const bloqueada = setup(new Updater(), () => false);
    bloqueada.controller.setForced({ obrigatoria: true });
    await bloqueada.controller.check();
    await expect(bloqueada.controller.installLatest()).rejects.toThrow(/ligação/);
    const liberada = setup(new Updater(), () => false);
    liberada.controller.setForced({ obrigatoria: true, ignorarRegra: true });
    await liberada.controller.check();
    await liberada.controller.installLatest();
    expect(liberada.updater.quitAndInstall).toHaveBeenCalled();
  });
});

describe("sempre busca a versão mais nova", () => {
  const withVersion = (version: string) => ({ isUpdateAvailable: true, updateInfo: { version, files: [{ url: `AcessaWorkspace-${version}-Setup.exe`, sha512: Buffer.alloc(64).toString("base64") }] } });
  it("com uma versão já baixada, baixa a mais nova que sair depois", async () => {
    const { controller, updater } = setup();
    expect((await controller.check()).nextVersion).toBe("0.5.1");
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
    updater.checkForUpdates.mockResolvedValue(withVersion("0.5.2"));
    const status = await controller.check();
    expect(status.phase).toBe("ready");
    expect(status.nextVersion).toBe("0.5.2");
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(2);
  });
  it("não baixa de novo a mesma versão já pronta", async () => {
    const { controller, updater } = setup();
    await controller.check();
    await controller.check();
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(controller.getStatus().phase).toBe("ready");
  });
  it("falha de rede ao procurar não derruba a atualização já baixada", async () => {
    const { controller, updater } = setup();
    await controller.check();
    updater.checkForUpdates.mockRejectedValue(new Error("sem rede"));
    const status = await controller.check();
    expect(status.phase).toBe("ready");
    expect(status.nextVersion).toBe("0.5.1");
  });
  it("antes de reiniciar confere se saiu algo mais novo e instala a última", async () => {
    const { controller, updater } = setup();
    await controller.check();
    updater.checkForUpdates.mockResolvedValue(withVersion("0.5.3"));
    await controller.installLatest();
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(2);
    expect(controller.getStatus().nextVersion).toBe("0.5.3");
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Electron simulado: só o necessário para mostrar/esconder/mover as páginas nativas e conferir quem está visível.
const views: any[] = [];
vi.mock("electron", () => {
  class FakeWebContents {
    on() { return this; }
    setWindowOpenHandler() {}
    loadURL() { return Promise.resolve(); }
    isDestroyed() { return false; }
    getURL() { return "https://exemplo.test/"; }
    getTitle() { return ""; }
    isLoading() { return false; }
    navigationHistory = { canGoBack: () => false, canGoForward: () => false };
    setZoomFactor() {}
    close() {}
  }
  class WebContentsView {
    visible = true;
    bounds: any = null;
    webContents = new FakeWebContents();
    constructor() { views.push(this); }
    setVisible(v: boolean) { this.visible = v; }
    getVisible() { return this.visible; }
    setBounds(b: any) { this.bounds = b; }
  }
  class BrowserWindow {
    children: any[] = [];
    contentView = { addChildView: (v: any) => { this.children.push(v); }, removeChildView: (v: any) => { this.children = this.children.filter((x) => x !== v); } };
    url = "app://workspace/index.html#/navegador";
    ouvintes: Record<string, ((e: unknown, u: string) => void)[]> = {};
    webContents = {
      getZoomFactor: () => 1,
      send: () => {},
      getURL: () => this.url,
      on: (ev: string, cb: (e: unknown, u: string) => void) => { (this.ouvintes[ev] ??= []).push(cb); },
    };
    /** Simula a troca de aba do Workspace (rota por hash). */
    irPara(rota: string) { this.url = `app://workspace/index.html#${rota}`; for (const cb of this.ouvintes["did-navigate-in-page"] ?? []) cb({}, this.url); }
    isDestroyed() { return false; }
    getContentSize() { return [1280, 800]; }
  }
  const fakeSession = { setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setCertificateVerifyProc() {}, clearStorageData: async () => {}, clearCache: async () => {} };
  return { BrowserWindow, WebContentsView, session: { fromPartition: () => fakeSession }, shell: { openExternal: vi.fn() } };
});

const limites = { x: 200, y: 80, width: 1000, height: 700 };
const visiveis = () => views.filter((v) => v.visible);

describe("página nativa do Navegador (processo principal)", () => {
  let mod: typeof import("../electron/browserTabs");
  let janela: any;
  beforeEach(async () => {
    vi.useFakeTimers();
    views.length = 0;
    vi.resetModules();
    mod = await import("../electron/browserTabs");
    const { BrowserWindow } = await import("electron");
    janela = new (BrowserWindow as any)();
    mod.initBrowserTabs(janela, () => "");
  });
  afterEach(() => { mod.closeBrowserTabs(); vi.useRealTimers(); });

  it("mostrar e esconder: sai da frente ao sair da aba", () => {
    mod.showBrowser("sgp", limites, janela);
    expect(visiveis()).toHaveLength(1);
    mod.hideBrowser(janela, "navegador");
    expect(visiveis()).toHaveLength(0);
  });

  it("trocar de site esconde o anterior (só uma página visível)", () => {
    mod.showBrowser("sgp", limites, janela);
    mod.showBrowser("zabbix", limites, janela);
    expect(visiveis()).toHaveLength(1);
    mod.showBrowser("grafana", limites, janela);
    expect(visiveis()).toHaveLength(1);
  });

  it("sem sinal da tela por mais de 4 s o vigia esconde a página; com sinal a cada segundo ela fica", () => {
    mod.showBrowser("sgp", limites, janela);
    for (let s = 0; s < 10; s++) { vi.advanceTimersByTime(1000); mod.showBrowser("sgp", limites, janela); }
    expect(visiveis()).toHaveLength(1);
    vi.advanceTimersByTime(6000); // o sinal parou
    expect(visiveis()).toHaveLength(0);
  });

  it("depois de escondida pelo vigia, um novo sinal volta a mostrar (a tela ainda quer a página)", () => {
    mod.showBrowser("sgp", limites, janela);
    vi.advanceTimersByTime(6000);
    expect(visiveis()).toHaveLength(0);
    mod.showBrowser("sgp", limites, janela);
    expect(visiveis()).toHaveLength(1);
  });

  it("pedido de esconder que chega DEPOIS de um 'mostrar' atrasado: o vigia limpa em segundos", () => {
    mod.showBrowser("sgp", limites, janela);
    mod.hideBrowser(janela, "navegador");
    mod.showBrowser("sgp", limites, janela); // 'mostrar' que estava no ar e chegou depois do esconder
    expect(visiveis()).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(visiveis()).toHaveLength(0);
  });

  it("esconder do Navegador não derruba a agenda web nem o Escritório, e o contrário também", () => {
    mod.showBrowser("agendaweb", limites, janela);
    mod.hideBrowser(janela, "navegador");
    expect(visiveis()).toHaveLength(1);
    mod.showBrowser("sgp", limites, janela);
    mod.hideBrowser(janela, "agendaweb"); // agenda saindo de cena depois do Navegador aparecer
    expect(visiveis()).toHaveLength(1);
    mod.hideBrowser(janela, "navegador");
    expect(visiveis()).toHaveLength(0);
  });

  it("agenda web e Escritório não entram no vigia (não mandam sinal)", () => {
    mod.showBrowser("agendaweb", limites, janela);
    vi.advanceTimersByTime(60_000);
    expect(visiveis()).toHaveLength(1);
  });

  it("medida errada nunca passa da janela", () => {
    mod.showBrowser("sgp", { x: 0, y: 0, width: 9000, height: 9000 }, janela);
    const v = views[0];
    expect(v.bounds.width).toBeLessThanOrEqual(1280);
    expect(v.bounds.height).toBeLessThanOrEqual(800);
  });

  it("a página fica ligada à janela; mover para outra janela esconde e não deixa duas visíveis", async () => {
    const { BrowserWindow } = await import("electron");
    const outra: any = new (BrowserWindow as any)();
    mod.showBrowser("sgp", limites, janela);
    mod.moveBrowserTabs(outra, janela);
    expect(visiveis()).toHaveLength(0);
    mod.showBrowser("sgp", limites, outra);
    expect(visiveis()).toHaveLength(1);
    // esconder pedido pela janela ERRADA (a antiga) não pode mexer na página que agora é da outra
    mod.hideBrowser(janela, "navegador");
    expect(visiveis()).toHaveLength(1);
  });

  it("trocar de aba (rota) esconde a página nativa SEM depender do pedido da tela", () => {
    mod.showBrowser("sgp", limites, janela);
    expect(visiveis()).toHaveLength(1);
    janela.irPara("/chamados");
    expect(visiveis()).toHaveLength(0);
  });

  it("'mostrar' atrasado numa rota sem página nativa é recusado; voltando ao Navegador funciona", () => {
    mod.showBrowser("sgp", limites, janela);
    janela.irPara("/chamados");
    mod.showBrowser("sgp", limites, janela); // pedido que estava no ar
    expect(visiveis()).toHaveLength(0);
    janela.irPara("/navegador");
    mod.showBrowser("sgp", limites, janela);
    expect(visiveis()).toHaveLength(1);
  });

  it("Navegador → outras categorias do Workspace: nunca fica nada visível", () => {
    for (const rota of ["/chamados", "/rede", "/dashboard", "/chat", "/contratacoes", "/resumo", "/tools", "/"]) {
      janela.irPara("/navegador");
      mod.showBrowser("sgp", limites, janela);
      expect(visiveis()).toHaveLength(1);
      janela.irPara(rota);
      expect(visiveis(), rota).toHaveLength(0);
    }
  });

  it("rotas com página nativa próprias (agenda web e Escritório) continuam podendo mostrar", () => {
    janela.irPara("/agenda");
    mod.showBrowser("agendaweb", limites, janela);
    expect(visiveis()).toHaveLength(1);
    janela.irPara("/escritorio");
    expect(visiveis()).toHaveLength(1);
    janela.irPara("/chamados");
    expect(visiveis()).toHaveLength(0);
  });

  it("parado por muito tempo: os sites do Navegador são descarregados, mas o Escritório fica vivo (não zera o mapa)", () => {
    janela.irPara("/escritorio");
    mod.showBrowser("escritorio", limites, janela);
    const escritorio = views[0];
    mod.showBrowser("sgp", limites, janela); // troca: o Escritório fica escondido
    const sgp = views[1];
    mod.hideBrowser(janela, "navegador");
    expect(janela.children).toContain(escritorio);
    expect(janela.children).toContain(sgp);
    vi.advanceTimersByTime(40 * 60_000); // passa dos 30 min de inatividade
    expect(janela.children).toContain(escritorio);
    expect(janela.children).not.toContain(sgp);
  });
});

import { test, expect } from "@playwright/test";

const servers = { chat: "http://127.0.0.1:14179", agenda: "http://127.0.0.1:14180", dashboard: "http://127.0.0.1:14182", allowInsecureLan: false, launchAtLogin: false, closeToTray: true, authorizedAgendaGateway: false };

test("Terminal: menu Teclas muda o que Backspace, Ctrl+Backspace, Delete e Enter enviam, e a barra de atalhos funciona", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript((cfg) => {
    localStorage.setItem("workspace-servers-v1", JSON.stringify(cfg));
    const w = window as any;
    w.__enviado = [] as string[];
    let aoEstado: ((v: unknown) => void) | null = null;
    w.desktop = {
      getConfig: async () => cfg, getSession: async () => null, saveSession: async () => {}, clearSession: async () => {},
      notify: async () => {}, unread: async () => {}, setZoom: async () => {}, onZoomStep: () => () => {}, onNavigate: () => () => {},
      updateStatus: async () => ({ phase: "idle", currentVersion: "0.6.45", message: "ok" }), onUpdateStatus: () => () => {},
      request: async (r: any) => {
        if (r.path === "/api/terminal/equipamentos") return { status: 200, data: { equipamentos: [] } };
        if (r.service !== "chat") return { status: 200, data: { totais: { naoAtendidos: 0 }, items: [] } };
        const response = await fetch((cfg as any)[r.service] + r.path, { method: r.method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + r.token }, body: r.body ? JSON.stringify(r.body) : undefined });
        return { status: response.status, data: await response.json() };
      },
      onPhoneEvent: () => () => {},
      // Terminal simulado: equipamento só neste PC, conexão que "abre" na hora, e captura do que seria enviado ao equipamento.
      terminalListar: async () => [{ id: "l1", nome: "OLT Teste", grupo: "", protocolo: "telnet", host: "10.0.0.1", porta: 23, usuario: "", temSenha: false, antiIdle: false, antiIdleSegundos: 60, antiIdleModo: "nulo" }],
      terminalConectar: async (v: any) => { setTimeout(() => aoEstado?.({ sessao: v.conexao.sessao, estado: "conectado" }), 50); },
      terminalEntrada: async (v: { dados: string }) => { w.__enviado.push(v.dados); },
      terminalTamanho: async () => {}, terminalFechar: async () => {}, terminalAntiIdle: async () => {}, copyText: async () => {},
      onTerminalDados: () => () => {},
      onTerminalEstado: (cb: (v: unknown) => void) => { aoEstado = cb; return () => { aoEstado = null; }; },
    };
  }, servers);
  await page.goto("/");
  await page.getByLabel("E-mail corporativo").fill("teste@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("teste-local");
  await page.getByRole("button", { name: "Entrar no Workspace" }).click();
  for (const nome of ["Entendi", "Agora não"]) await page.getByRole("button", { name: nome, exact: true }).first().click({ timeout: 9000 }).catch(() => undefined);
  await page.getByRole("button", { name: "Terminal", exact: true }).click();
  await page.getByRole("button", { name: /OLT Teste/ }).first().click();
  const tela = page.locator(".xterm-helper-textarea").first();
  await expect(tela).toBeAttached({ timeout: 10_000 });
  const enviado = () => page.evaluate(() => (window as any).__enviado as string[]);
  const ultimo = async () => (await enviado()).at(-1);
  const digitar = async (tecla: string) => { await tela.focus(); await page.keyboard.press(tecla); await page.waitForTimeout(80); };

  // Padrão: Backspace envia DEL (0x7F).
  await digitar("Backspace");
  expect(await ultimo()).toBe("\x7f");

  // O terminal ignora os atalhos do Workspace: Ctrl+K vai para o equipamento (0x0B) e NÃO abre a busca do Workspace.
  await page.getByRole("button", { name: "Entendi", exact: true }).click({ timeout: 20_000 }).catch(() => undefined); // aviso de novidades (aparece com atraso)
  await digitar("Control+k");
  expect(await ultimo()).toBe("\x0b");
  await expect(page.getByRole("combobox", { name: "Buscar no workspace" })).toHaveCount(0); // a paleta de busca do Workspace NÃO abriu

  // Menu Teclas: Backspace passa a enviar ^H (0x08), sem Ctrl.
  await page.getByRole("button", { name: "Teclas", exact: true }).click();
  await page.getByRole("radio", { name: /Equipamento de rede/ }).click();
  await page.screenshot({ path: "test-results/atendimento/teclas-menu.png" });
  await digitar("Backspace");
  expect(await ultimo()).toBe("\x08");

  // Opções avançadas (escondidas até abrir): Ctrl+Backspace apagando a palavra anterior (Ctrl+W).
  await expect(page.getByLabel("Ctrl + Backspace faz")).toBeHidden();
  await page.getByText("Opções avançadas").click();
  await page.getByLabel("Ctrl + Backspace faz").selectOption("palavra");
  await digitar("Control+Backspace");
  expect(await ultimo()).toBe("\x17");

  // Delete apaga à esquerda (com o código escolhido para o Backspace).
  await page.getByLabel("Tecla Delete").selectOption("apagar");
  await digitar("Delete");
  expect(await ultimo()).toBe("\x08");

  // Enter com CR+LF.
  await page.getByLabel("Tecla Enter").selectOption("crlf");
  await digitar("Enter");
  expect(await ultimo()).toBe("\r\n");

  // Barra de atalhos na tela: Apagar usa o código escolhido; Ctrl+Z e Apagar palavra enviam o combo sem a pessoa digitar.
  await page.getByLabel(/Mostrar botões de atalho/).check();
  const barra = page.getByRole("toolbar", { name: "Atalhos de teclado" });
  await expect(barra).toBeVisible();
  await barra.getByRole("button", { name: "⌫ Apagar" }).click();
  expect(await ultimo()).toBe("\x08");
  await barra.getByRole("button", { name: /Sair do modo/ }).click();
  expect(await ultimo()).toBe("\x1a");
  await barra.getByRole("button", { name: "Apagar palavra" }).click();
  expect(await ultimo()).toBe("\x17");
  await page.screenshot({ path: "test-results/atendimento/teclas-barra.png" });

  // A escolha fica guardada e "Restaurar padrão" desfaz tudo.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("workspace:terminal:teclas") ?? "{}").backspace)).toBe("ctrl-h");
  await page.getByRole("button", { name: "Voltar ao normal" }).click();
  await digitar("Backspace");
  expect(await ultimo()).toBe("\x7f");
  await expect(barra).toBeHidden();
});

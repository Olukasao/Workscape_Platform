import { test, expect } from "@playwright/test";

const aviso = (dados: object) => `/toast.html#${encodeURIComponent(JSON.stringify({ time: "2026-11-11T12:00:00Z", mudo: true, ...dados }))}`;
const avaliacao = { title: "Nova avaliação do atendimento: ★★★★★", body: "Cliente: Maria Souza — “Atendimento excelente, o técnico foi muito educado e resolveu tudo rápido.” — Técnico: Ana", context: "Avaliação do atendimento", kind: "system", tone: "info" };

test("aviso de avaliação grande: textos legíveis e maiores que o aviso normal", async ({ page }) => {
  await page.setViewportSize({ width: 576, height: 246 });
  await page.goto(aviso({ ...avaliacao, size: "grande" }));
  await expect(page.locator("#toast.grande")).toBeVisible();
  const tamanho = async (seletor: string) => page.locator(seletor).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const grande = { titulo: await tamanho("#title"), corpo: await tamanho("#body") };
  expect(grande.titulo).toBeGreaterThanOrEqual(22);
  expect(grande.corpo).toBeGreaterThanOrEqual(18);
  // O texto inteiro cabe na janela (nada cortado além do limite de linhas).
  const caixa = await page.locator("#toast").boundingBox();
  const corpo = await page.locator("#body").boundingBox();
  expect(corpo!.y + corpo!.height).toBeLessThanOrEqual(caixa!.y + caixa!.height);
  await page.screenshot({ path: "test-results/atendimento/aviso-grande.png" });

  await page.setViewportSize({ width: 400, height: 136 });
  await page.goto("about:blank"); // só o hash muda: sem isto a página não recarrega
  await page.goto(aviso({ ...avaliacao }));
  expect(await tamanho("#title")).toBeLessThan(grande.titulo);
  expect(await tamanho("#body")).toBeLessThan(grande.corpo);
});

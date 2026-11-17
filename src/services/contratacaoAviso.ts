/** Texto do aviso de contratação nova (sem dependências de tela, para poder testar). */
export function textoDoAviso(itens: ReadonlyArray<{ cliente?: string }>) {
  const nomes = itens.map((i) => (i.cliente || "").trim() || "Cliente sem nome");
  const title = itens.length > 1 ? `${itens.length} NOVAS CONTRATAÇÕES PELO SITE` : "NOVA CONTRATAÇÃO PELO SITE";
  const body = nomes.length > 3 ? `${nomes.slice(0, 3).join(" · ")} e mais ${nomes.length - 3}` : nomes.join(" · ");
  return { title, body: body.slice(0, 480) };
}

// Texto do aviso de marketing do Wi-Fi público (sem dependências, para testar e para o painel de teste de avisos).
/** Dado de marketing obtido pelo Wi-Fi público (evento wifi:marketing do chat interno). Só nome abreviado e rede: sem e-mail nem telefone. */
export interface LeadWifi {
  id: string;
  nome: string;
  rede: string;
  quando: string;
}

/** Texto do aviso: "Novo Dados de marketing obtidos por wifi-publico!" (vários: "N novos dados…"). */
export function textoDoAvisoMarketing(itens: ReadonlyArray<LeadWifi>, total = itens.length) {
  const title = total > 1 ? `${total} novos dados de marketing obtidos por wifi-publico!` : "Novo Dados de marketing obtidos por wifi-publico!";
  const quem = itens.map((i) => i.nome).filter(Boolean);
  const nomes = quem.length > 3 ? `${quem.slice(0, 3).join(" · ")} e mais ${total - 3}` : quem.join(" · ");
  const rede = itens.find((i) => i.rede)?.rede;
  return { title, body: [nomes, rede].filter(Boolean).join(" — ").slice(0, 480) };
}

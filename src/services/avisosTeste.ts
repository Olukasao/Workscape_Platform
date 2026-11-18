import { useNotices } from "../stores/workspace";
import { textoDoAviso } from "./contratacaoAviso";
import { textoDoAvisoMarketing } from "./marketingWifiTexto";

/**
 * Catálogo do painel Administração > Teste de avisos: cada botão dispara um aviso do Workspace com dados de exemplo
 * (aviso no canto da tela + item no sino), do jeito que o aviso real aparece. Nada é enviado a ninguém nem gravado:
 * é só no computador de quem clicou.
 */
export type TomAviso = "crit" | "warn" | "info" | "novo";

export interface AvisoTeste {
  id: string;
  grupo: string;
  rotulo: string;
  titulo: string;
  corpo: string;
  alvo: string;
  contexto?: string;
  tom?: TomAviso;
  grande?: boolean;
  /** quem manda o aviso (nome que aparece em cima), quando o aviso real tem */
  remetente?: string;
  tipo?: "system" | "direct" | "group";
}

const estrelas = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
const contratacao = textoDoAviso([{ cliente: "Cliente Exemplo" }]);
const marketing = textoDoAvisoMarketing([{ id: "teste", nome: "Maria S.", rede: "Acessanet EcoParque", quando: "" }]);

export const AVISOS_TESTE: AvisoTeste[] = [
  { id: "contratacao", grupo: "Comercial", rotulo: "Contratação nova pelo site", titulo: contratacao.title, corpo: contratacao.body, alvo: "/contratacoes", contexto: "Contratação pelo site", tom: "novo" },
  { id: "marketing-wifi", grupo: "Comercial", rotulo: "Dados de marketing (Wi-Fi público)", titulo: marketing.title, corpo: marketing.body, alvo: "/marketing", contexto: "Marketing · Wi-Fi público", tom: "novo" },

  { id: "pon-queda", grupo: "Rede (OLT)", rotulo: "Queda de PON", titulo: "Queda de PON", corpo: "OLT Exemplo · slot 1 · PON 3 — 24 de 40 clientes afetados", alvo: "/rede", contexto: "Rede · OLT", tom: "crit" },
  { id: "pon-voltou", grupo: "Rede (OLT)", rotulo: "PON voltou", titulo: "PON 3 voltou", corpo: "OLT Exemplo · slot 1 · PON 3 — ficou 12 min fora · 24 clientes afetados", alvo: "/rede", contexto: "Rede · OLT", tom: "novo" },
  { id: "massa", grupo: "Rede (OLT)", rotulo: "Muitos clientes afetados", titulo: "310 clientes afetados", corpo: "250 sem energia e 60 em LOSS (+120 agora) · OLT Exemplo", alvo: "/rede", contexto: "Rede · OLT", tom: "crit" },
  { id: "onu", grupo: "Rede (OLT)", rotulo: "ONU aguardando autorização", titulo: "ONU aguardando autorização", corpo: "OLT Exemplo · slot 1 · PON 3 — Huawei HG8145V5 4857544312345678", alvo: "/rede", contexto: "Rede · ONU nova", tom: "warn" },

  { id: "wifi-troca", grupo: "Chamados", rotulo: "Cliente trocou a senha do Wi-Fi", titulo: "Cliente trocou a senha do Wi-Fi pela Central", corpo: "Cliente Exemplo · Huawei EG8145V5 · 2.4 e 5 GHz · confirmou que conectou", alvo: "/chamados", contexto: "Wi-Fi do cliente", tom: "info", grande: true },
  { id: "wifi-problema", grupo: "Chamados", rotulo: "Cliente não conseguiu conectar", titulo: "Cliente não conseguiu conectar após trocar a senha", corpo: "Cliente Exemplo · Huawei EG8145V5 · 2.4 e 5 GHz · chamado 261118000001", alvo: "/chamados", contexto: "Wi-Fi do cliente", tom: "crit", grande: true },
  { id: "avaliacao-boa", grupo: "Chamados", rotulo: "Avaliação boa do atendimento", titulo: `Nova avaliação do atendimento: ${estrelas(5)}`, corpo: "Cliente: Cliente Exemplo — “Atendimento excelente”— Técnico: Técnico Exemplo", alvo: "/chamados?aba=avaliacoes", contexto: "Avaliação do atendimento", tom: "info", grande: true },
  { id: "avaliacao-ruim", grupo: "Chamados", rotulo: "Avaliação ruim do atendimento", titulo: `Nova avaliação do atendimento: ${estrelas(1)}`, corpo: "Cliente: Cliente Exemplo — “Demorou muito”— Técnico: Técnico Exemplo", alvo: "/chamados?aba=avaliacoes", contexto: "Avaliação do atendimento", tom: "crit", grande: true },
  { id: "atrasados", grupo: "Chamados", rotulo: "Chamados atrasados", titulo: "3 chamados atrasados", corpo: "Nos últimos 7 dias, 3 ordens de serviço ficaram sem atendimento. Toque para ver o Dashboard.", alvo: "/dashboard", contexto: "Agenda de Técnicos", tom: "warn" },

  { id: "atendimento", grupo: "Atendimento", rotulo: "Cliente aguardando na fila", titulo: "Cliente aguardando atendimento", corpo: "Cliente Exemplo entrou na fila do atendimento.", alvo: "/atendimento", contexto: "Atendimento", tom: "info" },

  { id: "mensagem", grupo: "Conversas", rotulo: "Mensagem direta", titulo: "Pessoa Exemplo", corpo: "Oi! Este é um teste de mensagem do chat.", alvo: "/chat", remetente: "Pessoa Exemplo", tipo: "direct" },
  { id: "grupo", grupo: "Conversas", rotulo: "Mensagem em grupo", titulo: "Pessoa Exemplo · Grupo Exemplo", corpo: "Mencionou você: teste de aviso de grupo.", alvo: "/chat", remetente: "Pessoa Exemplo", contexto: "Mencionou você em Grupo Exemplo", tipo: "group" },

  { id: "lembrete", grupo: "Pessoal", rotulo: "Lembrete", titulo: "Lembrete", corpo: "Ligar para o cliente · Enviar o relatório", alvo: "/lembretes", tom: "warn" },
  { id: "atualizacao", grupo: "Sistema", rotulo: "Atualização do Workspace", titulo: "Atualização do Acessa Workspace", corpo: "A versão 9.9.9 está pronta. Reinicie o aplicativo para atualizar.", alvo: "/settings" },
];

/** Resultado do teste: "ok", "sem-app" (fora do aplicativo do Windows: só o sino) ou o motivo da recusa do Windows. */
export type ResultadoTeste = { estado: "ok" } | { estado: "sem-app" } | { estado: "recusado"; motivo: string };

/** Dispara o aviso de teste: pop-up no canto da tela e item no sino, ambos marcados como teste. Não falha em silêncio: devolve o motivo se o Windows recusar. */
export async function dispararAvisoTeste(a: AvisoTeste): Promise<ResultadoTeste> {
  const agora = new Date().toISOString();
  const titulo = a.titulo;
  const corpo = a.corpo;
  useNotices.getState().add({ id: `teste:${a.id}:${Date.now()}`, title: `[TESTE] ${titulo}`, body: corpo, target: a.alvo, time: agora });
  if (!window.desktop?.notify) return { estado: "sem-app" };
  try {
    await window.desktop.notify({
    title: `[TESTE] ${titulo}`.slice(0, 120),
    body: corpo.slice(0, 480),
    target: a.alvo,
    kind: a.tipo ?? "system",
    ...(a.contexto ? { context: a.contexto } : {}),
    ...(a.tom ? { tone: a.tom } : {}),
    ...(a.grande ? { size: "grande" as const } : {}),
    ...(a.remetente ? { sender: a.remetente } : {}),
    });
    return { estado: "ok" };
  } catch (e) {
    return { estado: "recusado", motivo: e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']*':\s*/, "").slice(0, 200) : "erro desconhecido" };
  }
}

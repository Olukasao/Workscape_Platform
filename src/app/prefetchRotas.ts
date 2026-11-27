// Carregadores das telas (código dividido). Usados pelo lazy() do App e para pré-carregar as telas em segundo plano,
// assim o primeiro clique em cada página já encontra o código na memória e não mostra tela de espera.
export const carregar = {
  Resumo: () => import("../modules/Resumo"),
  Contratacoes: () => import("../modules/Contratacoes"),
  Changelog: () => import("../modules/Changelog"),
  Lembretes: () => import("../modules/Lembretes"),
  SuporteRemoto: () => import("../modules/SuporteRemoto"),
  RoteadorCliente: () => import("../modules/RoteadorCliente"),
  Marketing: () => import("../modules/Marketing"),
  Escritorio3D: () => import("../modules/escritorio/Escritorio3D"),
  Cursos: () => import("../modules/cursos/Cursos"),
  Chamados: () => import("../modules/Chamados"),
  Agenda: () => import("../modules/Agenda"),
  Profile: () => import("../modules/Profile"),
  Notifications: () => import("../modules/Notifications"),
  Dashboard: () => import("../modules/Dashboard"),
  Chat: () => import("../modules/Chat"),
  Navegador: () => import("../modules/Navegador"),
  RedeOlt: () => import("../modules/RedeOlt"),
  RotasBgp: () => import("../modules/RotasBgp"),
  TerminalSsh: () => import("../modules/Terminal"),
  AtendimentoChat: () => import("../modules/Atendimento"),
  Workspaces: () => import("../modules/Workspaces"),
  Assistente: () => import("../modules/Assistente"),
  Tools: () => import("../modules/Tools"),
};

type Chave = keyof typeof carregar;
const feitos = new Set<Chave>();
const ROTAS: Array<[string, Chave]> = [
  ["/chat", "Chat"], ["/agenda", "Agenda"], ["/dashboard", "Dashboard"], ["/chamados", "Chamados"], ["/atendimento", "AtendimentoChat"],
  ["/resumo", "Resumo"], ["/rede", "RedeOlt"], ["/rotas", "RotasBgp"], ["/terminal", "TerminalSsh"], ["/cursos", "Cursos"],
  ["/marketing", "Marketing"], ["/workspaces", "Workspaces"], ["/assistente", "Assistente"], ["/contratacoes", "Contratacoes"],
  ["/lembretes", "Lembretes"], ["/profile", "Profile"], ["/notifications", "Notifications"], ["/navegador", "Navegador"],
];

function carregarChave(k: Chave) {
  if (feitos.has(k)) return;
  feitos.add(k);
  carregar[k]().catch(() => feitos.delete(k)); // falhou (ex.: sem rede): tenta de novo na próxima vez
}

/** Passou o mouse / focou no item do menu: já baixa o código daquela tela. */
export function precarregarRota(path: string) {
  const hit = ROTAS.find(([p]) => path === p || path.startsWith(p + "/"));
  if (hit) carregarChave(hit[1]);
}

/** Depois do login, com o app ocioso, baixa as telas mais usadas uma a uma (sem disputar com o carregamento inicial). */
export function precarregarTelasComuns() {
  const fila: Chave[] = ["Chat", "Agenda", "Dashboard", "Chamados", "AtendimentoChat", "Resumo", "Lembretes"];
  const ocioso = (cb: () => void) =>
    typeof requestIdleCallback === "function" ? requestIdleCallback(cb, { timeout: 4000 }) : window.setTimeout(cb, 800);
  let i = 0;
  const proximo = () => {
    if (i >= fila.length) return;
    carregarChave(fila[i++]);
    ocioso(proximo);
  };
  window.setTimeout(() => ocioso(proximo), 2500);
}

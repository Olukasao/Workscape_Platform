import type { PassoTour } from "./tour";

export const TOUR_AGENDA_FIN = "agenda-financeira-v1";

/**
 * Quem recebe o convite automático (vai para a Agenda Comercial e o tour abre sozinho): as pessoas do financeiro (ids do Chat Interno, os mesmos
 * de AGENDA_FINANCEIRA_USER_IDS no servidor da agenda) e quem é admin ou coordenador. Os demais veem o aviso de novidade e podem abrir o tour pelo
 * botão "Como usar" da própria aba.
 */
export const IDS_FINANCEIRO = [13, 18, 21, 22];
export function ehDoFinanceiro(usuario: { id: number; perfil?: string } | null | undefined): boolean {
  if (!usuario) return false;
  if (IDS_FINANCEIRO.includes(Number(usuario.id))) return true;
  const perfil = String(usuario.perfil ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return perfil === "admin" || perfil === "administrador" || perfil.includes("coordenador");
}

// Os passos "af-ag-*" acontecem no modo Agenda (a tela troca de modo sozinha, sem mudar a escolha salva de cada pessoa); os outros, no Quadro.
export const passosTourAgendaFinanceira: PassoTour[] = [
  {
    id: "af-aba",
    rota: "/agenda",
    alvo: "af-aba",
    titulo: "Nova: Agenda Comercial",
    texto: "A fila de ativação de contratos do SGP agora tem uma agenda própria, ao lado da Agenda Instalação. Ela mostra quem está com cada ocorrência e deixa distribuir tudo em um lugar só. Vamos conhecer em um minuto.",
    lado: "baixo",
  },
  {
    id: "af-kpis",
    rota: "/agenda",
    alvo: "af-kpis",
    titulo: "A fila num relance",
    texto: "Aqui estão quantas ocorrências estão na fila, quantas ainda não têm responsável, quantas estão em atendimento e quantas já foram finalizadas. A espera média mostra há quanto tempo, em média, as abertas estão esperando. Passe o mouse em cada número para entender de onde ele vem.",
    lado: "baixo",
  },
  {
    id: "af-fila",
    rota: "/agenda",
    alvo: "af-fila",
    titulo: "A fila de distribuição",
    texto: "Esta coluna guarda as ocorrências que ainda não têm uma colaboradora. A mais antiga fica no alto. As bordas vermelha e amarela avisam quando uma está esperando há muito tempo.",
    lado: "direita",
  },
  {
    id: "af-card",
    rota: "/agenda",
    alvo: "af-card",
    opcional: true,
    titulo: "O cartão da ocorrência",
    texto: "Cada cartão mostra o número, o cliente, o contrato, o tipo, quando abriu e há quanto tempo espera. Clique nele para ver a descrição, as observações e abrir a ocorrência no SGP. Para distribuir, arraste o cartão para uma colaboradora. Com Ctrl pressionado dá para marcar vários e mandar todos de uma vez.",
    lado: "direita",
  },
  {
    id: "af-colunas",
    rota: "/agenda",
    alvo: "af-colunas",
    titulo: "Uma coluna para cada colaboradora",
    texto: "Carina, Helena, Monique e Patrícia têm uma coluna cada, com o que está com elas e um resumo do trabalho do dia. Arraste entre as colunas para transferir, ou de volta para a fila. Toda mudança fica no Histórico e aparece na hora para todo mundo.",
    lado: "baixo",
  },
  {
    id: "af-aviso-sgp",
    rota: "/agenda",
    alvo: "af-aviso-sgp",
    opcional: true,
    titulo: "Importante: o que o SGP recebe",
    texto: "Por enquanto o SGP não aceita a troca de responsável por aqui. Por isso o que você distribui fica registrado na agenda e o cartão avisa “não gravado no SGP”. Se alguém mudar o responsável direto no SGP, o SGP passa a valer.",
    lado: "baixo",
  },
  {
    id: "af-filtros",
    rota: "/agenda",
    alvo: "af-filtros",
    titulo: "Filtros e pesquisa",
    texto: "Pesquise por cliente, CPF, contrato ou número da ocorrência. Filtre por colaboradora, status, prioridade, tipo ou só as que estão sem responsável.",
    lado: "baixo",
  },
  {
    id: "af-ag-modo",
    rota: "/agenda",
    alvo: "af-modo",
    titulo: "Dois jeitos de ver",
    texto: "O Quadro é o que você viu: a fila e uma coluna por pessoa. O modo Agenda mostra a mesma coisa em uma grade por horário, parecida com a Agenda dos Técnicos. A tela lembra o modo que você escolher.",
    lado: "baixo",
  },
  {
    id: "af-ag-grade",
    rota: "/agenda",
    alvo: "af-grade",
    titulo: "A grade por horário",
    texto: "Cada ocorrência fica na hora em que abriu. Azul é aberta, amarelo é em atendimento, cinza é aguardando retorno e verde é concluída. No fim de cada dia ficam as concluídas, na coluna de quem finalizou. Também dá para arrastar daqui.",
    lado: "cima",
  },
  {
    id: "af-ag-periodo",
    rota: "/agenda",
    alvo: "af-periodo",
    titulo: "Dia ou 7 dias",
    texto: "No modo Agenda você escolhe ver um dia só ou a semana inteira. Na semana, cada dia ganha a sua grade, e dá para voltar ou avançar de 7 em 7 dias.",
    lado: "baixo",
  },
  {
    id: "af-historico",
    rota: "/agenda",
    alvo: "af-historico",
    titulo: "Quem mexeu em quê",
    texto: "O Histórico guarda cada movimentação: qual ocorrência, de quem para quem, quem fez e a hora. O botão “Como usar” aqui do lado mostra este passo a passo de novo quando você quiser.",
    lado: "baixo",
  },
];

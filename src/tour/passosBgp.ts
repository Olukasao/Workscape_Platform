import type { PassoTour } from "./tour";

export const TOUR_BGP = "bgp-v1";

// Tour da tela Rotas (BGP). Os passos "hist-*" acontecem na aba Histórico: a tela troca de aba sozinha por eles.
export const passosTourBgp: PassoTour[] = [
  {
    id: "menu",
    alvo: "nav-rotas",
    titulo: "Rotas (BGP): a internet vista pelo nosso roteador",
    texto: "Aqui você acompanha, em tempo real, as conexões da AcessaNet com as operadoras e com o IX, e o caminho que cada rota faz pela internet. Vamos conhecer a tela em um minuto.",
    lado: "direita",
  },
  {
    id: "painel",
    rota: "/rotas",
    alvo: "bgp-hero",
    titulo: "O estado da rede num relance",
    texto: "Este painel responde a pergunta mais importante: está tudo no ar? Fica azul quando todas as sessões estão de pé e vermelho assim que alguma cai.",
    lado: "baixo",
  },
  {
    id: "numeros",
    rota: "/rotas",
    alvo: "bgp-stats",
    titulo: "Os números que importam",
    texto: "Roteadores e sessões BGP no ar, quantos prefixos (rotas) o roteador conhece e quantas atualizações chegam por minuto. Uma queda brusca nas sessões é sinal de problema com uma operadora.",
    lado: "baixo",
  },
  {
    id: "busca",
    rota: "/rotas",
    alvo: "bgp-busca",
    titulo: "Procure um IP, prefixo ou AS",
    texto: "Digite um IP (8.8.8.8), um prefixo (187.52.38.0/24) ou um AS (AS15169). Você vê quem origina a rota e o caminho completo, de AS em AS, até o destino.",
    lado: "baixo",
  },
  {
    id: "sessoes",
    rota: "/rotas",
    alvo: "bgp-peers",
    titulo: "Suas sessões com operadoras e IX",
    texto: "Cada cartão é uma conexão BGP. Verde é no ar; vermelho é caída. O nome e o AS dizem com quem estamos conectados.",
    lado: "cima",
  },
  {
    id: "agora",
    rota: "/rotas",
    alvo: "bgp-feed",
    titulo: "O que está mudando agora",
    texto: "Cada linha é uma rota anunciada ou retirada neste instante. As etiquetas mostram o caminho; a última, em azul, é quem origina o prefixo.",
    lado: "cima",
  },
  {
    id: "abas",
    rota: "/rotas",
    alvo: "bgp-tabs",
    titulo: "Visão geral e Histórico",
    texto: "A Visão geral mostra o agora. Na aba Histórico você volta no tempo para entender o que aconteceu: uma queda, uma rota que sumiu, um caminho que mudou.",
    lado: "baixo",
  },
  {
    id: "hist-tempo",
    rota: "/rotas",
    alvo: "bgp-tempo",
    titulo: "Como estava em…",
    texto: "Informe um prefixo e uma data e hora do passado. Você vê o caminho que ele fazia naquele momento e, logo abaixo, tudo o que mudou nele daquela data até hoje. Ótimo para entender o que aconteceu depois de um problema.",
    lado: "baixo",
  },
  {
    id: "hist-filtros",
    rota: "/rotas",
    alvo: "bgp-filtros",
    titulo: "Filtre a linha do tempo",
    texto: "Escolha o período (de 1 hora a 30 dias), filtre por prefixo ou AS e separe o que foi anunciado do que foi retirado.",
    lado: "baixo",
  },
  {
    id: "hist-linha",
    rota: "/rotas",
    alvo: "bgp-linha",
    titulo: "Tudo o que aconteceu, dia a dia",
    texto: "Os eventos aparecem agrupados por dia, do mais novo para o mais antigo. Use Carregar mais para ir ainda mais fundo.",
    lado: "cima",
  },
  {
    id: "fim",
    rota: "/rotas",
    titulo: "Pronto!",
    texto: "É isso. Para rever este passo a passo quando quiser, use o botão Ver o tour no topo da tela.",
  },
];

// Histórico do Acessa Workspace, em linguagem simples. Mais recente primeiro.
// A cada atualização nossa, acrescente uma entrada aqui (1 a 5 frases curtas, sem termos técnicos).
export interface ChangelogEntry {
  versao: string;
  data: string; // AAAA-MM-DD
  itens: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    versao: "0.6.3",
    data: "2026-11-06",
    itens: [
      "Telefone: a transferência ficou bem mais rápida. A chamada sai da sua tela assim que a central aceita, sem esperar o destino atender, e aparece \"Transferindo…\".",
    ],
  },
  {
    versao: "0.6.2",
    data: "2026-11-06",
    itens: [
      "Novo em Configurações: Atalhos de teclado. Crie combinações como Ctrl + , para abrir o telefone, o Chat Interno e outras telas.",
    ],
  },
  {
    versao: "0.6.1",
    data: "2026-11-06",
    itens: [
      "O aviso \"Telefone: não precisa mais digitar o 0\" aparece de novo para todos, já legível no tema escuro.",
    ],
  },
  {
    versao: "0.6.0",
    data: "2026-11-06",
    itens: [
      "Nova aba \"Call Center\" no Navegador do Workspace.",
      "Corrigido: o aviso do telefone ficava ilegível no tema escuro. Agora ele se adapta ao tema claro e escuro.",
    ],
  },
  {
    versao: "0.5.117",
    data: "2026-11-06",
    itens: [
      "Aviso para todos: o telefone agora coloca o 0 sozinho nas ligações para números de fora. Não é preciso digitar o 0.",
    ],
  },
  {
    versao: "0.5.116",
    data: "2026-11-06",
    itens: [
      "Telefone > Recentes: ao clicar em uma chamada, abrem as opções \"Copiar número\" e \"Ligar novamente\". Antes o clique já discava na hora.",
    ],
  },
  {
    versao: "0.5.115",
    data: "2026-11-06",
    itens: [
      "Telefone: aviso no topo do teclado dizendo que o 0 já vem sozinho. Ao digitar um número de fora, aparece como ele vai ser discado (por exemplo, Vai discar 011999998888).",
    ],
  },
  {
    versao: "0.5.114",
    data: "2026-11-06",
    itens: [
      "Telefone: o Workspace nunca reinicia nem fecha para atualizar enquanto há uma ligação tocando, sendo feita ou em andamento. A atualização espera a ligação terminar e só então é aplicada.",
    ],
  },
  {
    versao: "0.5.113",
    data: "2026-11-06",
    itens: [
      "Telefone: ligações para números de fora (com DDD) agora saem com o 0 na frente sozinhas, para todo mundo. Você continua digitando o número normal. Ramais e filas não mudam.",
    ],
  },
  {
    versao: "0.5.112",
    data: "2026-11-06",
    itens: [
      "Dashboard > Atendimento dos técnicos: o ranking agora mostra quantos tipos de chamado cada técnico atendeu. Clique em \"tipos\" para ver o detalhe (por exemplo, Remoção de KIT 14, Offline 8).",
      "A visão resumida passou do top 3 para o top 10 do mês.",
    ],
  },
  {
    versao: "0.5.111",
    data: "2026-11-06",
    itens: [
      "Dashboard > Atendimento dos técnicos: agora mostra a nota que o cliente deu ao atendimento. Há a nota média geral, a nota de cada técnico no ranking e a lista das últimas avaliações, com o nome do cliente, o técnico da OS e o comentário.",
    ],
  },
  {
    versao: "0.5.110",
    data: "2026-11-06",
    itens: [
      "Dashboard: novo painel \"Atendimento dos técnicos\" com atendidos, adiados, não atendidos e pendentes. Na visão resumida: hoje, semana, mês e o top 3. Na visão completa: dia, semana ou mês (com setas para navegar), gráfico por dia, ranking completo dos técnicos e motivos mais frequentes.",
    ],
  },
  {
    versao: "0.5.109",
    data: "2026-11-06",
    itens: [
      "Admin > Telefone: nova coluna \"Online\" mostra quem está com o telefone conectado agora (e quem está em chamada ou em Não perturbe).",
    ],
  },
  {
    versao: "0.5.108",
    data: "2026-11-06",
    itens: [
      "Telefone: novo botão \"Destacar\" no topo do cartão. O telefone vira uma janela própria, que você pode levar para outro monitor, fixar por cima e redimensionar (o telefone cresce junto com a janela).",
      "Terminal: novo botão \"Destacar\" para abrir o Terminal em uma janela separada. As sessões abertas na janela destacada fecham quando ela é fechada.",
    ],
  },
  {
    versao: "0.5.107",
    data: "2026-11-06",
    itens: [
      "Telefone: ao transferir uma chamada, há botões prontos para Suporte, Financeiro e Comercial.",
      "Telefone: se a central recusar a transferência, o motivo aparece na tela; quando ela aceita, a sua ligação é encerrada sozinha.",
    ],
  },
  {
    versao: "0.5.106",
    data: "2026-11-05",
    itens: [
      "Pré-cadastro (Pessoa física e Pessoa jurídica) agora abre dentro do próprio Workspace, no Navegador (aba SGP), em vez de abrir o navegador do computador.",
      "Terminal: o botão \"Novo\" foi corrigido (ficava meio escondido e difícil de clicar).",
      "Terminal: agora há temas de cores (Azul-noite, Clássico, Matrix, Âmbar, Solarized, Dracula, Monokai e Claro) e ajuste do tamanho da letra.",
      "Terminal: novo Anti-idle (anti-AFK). Se você ficar um tempo sem digitar, o Workspace manda um sinal discreto para o equipamento não derrubar a sessão. Dá para ligar, desligar e escolher o tempo em cada sessão ou em cada equipamento.",
    ],
  },
  {
    versao: "0.5.105",
    data: "2026-11-05",
    itens: [
      "Corrigido: os avisos internos agora aparecem em qualquer tela do Workspace, sem precisar abrir o Chat antes.",
      "Os avisos internos ficaram mais compactos: aparecem no meio da tela, num popup no mesmo estilo do aviso de atualização.",
    ],
  },
  {
    versao: "0.5.104",
    data: "2026-11-05",
    itens: [
      "Avisos internos de prioridade alta ou crítica agora chamam a atenção: a caixa treme como um telefone tocando e vai estabilizando.",
    ],
  },
  {
    versao: "0.5.103",
    data: "2026-11-05",
    itens: [
      "Novo: Terminal dentro do Workspace (em Operação), no estilo SecureCRT. Conecte por SSH ou Telnet, com abas, lista de equipamentos por pasta e conexão rápida.",
      "As senhas dos equipamentos ficam guardadas só no seu computador, cifradas pelo Windows, ou são pedidas a cada conexão.",
    ],
  },
  {
    versao: "0.5.102",
    data: "2026-11-05",
    itens: [
      "Configurações > Aparência: cada pessoa pode escolher a própria imagem de fundo do Workspace (ou ficar sem imagem) e decidir se ela aparece inteira ou preenchendo a tela.",
      "As imagens de fundo do Ed e do Pedro agora aparecem inteiras, sem cortar as bordas.",
    ],
  },
  {
    versao: "0.5.101",
    data: "2026-11-05",
    itens: [
      "Corrigido: bloqueios e outras ações da agenda podiam sair como \"Usuário não identificado\" quando a sessão vencia com o app aberto. Agora a sessão é renovada antes de vencer.",
      "O Workspace do Pedro ganhou uma imagem de fundo personalizada.",
    ],
  },
  {
    versao: "0.5.100",
    data: "2026-10-31",
    itens: [
      "O toque do Workscape Phone ficou ainda mais alto e mais encorpado quando alguém liga.",
    ],
  },
  {
    versao: "0.5.99",
    data: "2026-10-31",
    itens: [
      "O toque do Workscape Phone quando alguém liga agora é um toque de telefone bem mais alto e agudo, para ninguém deixar de ouvir a chamada.",
    ],
  },
  {
    versao: "0.5.98",
    data: "2026-10-30",
    itens: [
      "Novo atalho Pré-cadastro em Ferramentas, na categoria Comercial: ao clicar, escolha Pessoa física ou Pessoa jurídica e o pré-cadastro do SGP abre no navegador.",
      "O mesmo atalho Pré-cadastro também pode ser adicionado em Meu acesso rápido, no mesmo formato da Agenda.",
      "O botão flutuante de contratações pendentes ganhou o atalho Pré-cadastro: escolha Pessoa física ou Pessoa jurídica.",
    ],
  },
  {
    versao: "0.5.97",
    data: "2026-10-30",
    itens: [
      "Atalhos que levam ao SGP agora abrem direto no navegador, em vez de só copiar o link.",
    ],
  },
  {
    versao: "0.5.96",
    data: "2026-10-28",
    itens: [
      "Admin > Workscape Phone: agora dá para ativar de novo um ramal que foi desativado.",
      "Admin > Workscape Phone: novo botão Excluir para apagar de vez um ramal cadastrado. O histórico de chamadas da pessoa continua guardado.",
    ],
  },
  {
    versao: "0.5.95",
    data: "2026-10-27",
    itens: [
      "O telefone do Workspace agora tem nome: Workscape Phone.",
      "Telefone com visual novo: o toque agora é um pulso de luz azul-ciano (no botão do topo e na faixa de chamada), no lugar do ícone tremendo.",
      "Telefone: na conversa aparece um avatar grande com as iniciais de quem está na linha, e o cronômetro e os números ficam firmes, sem dançar.",
      "Telefone: o cartão ganhou uma versão clara para quem usa o Workspace no tema claro, e as teclas ficaram mais nítidas em qualquer fundo.",
      "Telefone: novo som da marca, de três notas suaves, para o toque, atender, desligar e chamada perdida.",
    ],
  },
  {
    versao: "0.5.94",
    data: "2026-10-27",
    itens: [
      "Telefone: novo botão no topo do Workspace, ao lado do Tempo real. A bolinha mostra se o ramal está conectado, o número vermelho mostra as chamadas perdidas e o ícone balança quando alguém está ligando. Um clique abre ou fecha o telefone.",
      "Corrigido: o telefone, o Assistente e os outros cartões flutuantes não ficam mais presos no canto superior esquerdo depois de minimizar o Workspace. Eles voltam para onde você deixou.",
      "Telefone: quando alguém liga, só aparece a faixa para atender ou recusar. O telefone abre sozinho quando a conversa começa.",
    ],
  },
  {
    versao: "0.5.93",
    data: "2026-10-27",
    itens: [
      "Telefone: quando alguém liga, o Workspace mostra quem é pelo ramal (por exemplo, Ana Souza, Ramal 1003). Números de fora aparecem formatados e marcados como externos. O mesmo vale no aviso do canto da tela e na lista de recentes.",
    ],
  },
  {
    versao: "0.5.92",
    data: "2026-10-27",
    itens: [
      "Telefone: nova aba Recentes com as últimas chamadas. É só tocar numa linha para ligar de volta.",
      "Telefone: as chamadas perdidas aparecem em vermelho, com um contador no atalho do Início e na aba.",
      "Telefone: quando alguém liga e o Workspace está minimizado ou na bandeja, aparece um aviso no canto da tela e o ícone pisca na barra de tarefas.",
      "Telefone: agora dá para mudar o tamanho. Arraste o cantinho de baixo, ou use as setas do teclado nele. Duplo clique volta ao tamanho normal.",
      "Telefone: novo botão Não perturbe (o sininho cortado no topo do cartão). Ligado, as chamadas não tocam nem avisam e ficam em Recentes como perdidas. A escolha fica salva.",
      "Telefone: se o ramal ou a senha estiverem errados, o cartão avisa na hora e, se a central não responder, deixa de ficar em Conectando.",
    ],
  },
  {
    versao: "0.5.91",
    data: "2026-10-27",
    itens: [
      "O telefone agora é todo do Workspace: o MicroSIP não é mais aberto em nenhum lugar. O atalho Telefone do acesso rápido do chat também abre o telefone do Workspace.",
      "Quando o telefone não conecta, o cartão mostra o motivo e tem o botão Tentar conectar de novo.",
    ],
  },
  {
    versao: "0.5.90",
    data: "2026-10-27",
    itens: [
      "O card Telefone, em Ferramentas, agora explica que a ligação sai pelo seu ramal, direto no Workspace.",
    ],
  },
  {
    versao: "0.5.89",
    data: "2026-10-27",
    itens: [
      "Novo telefone do Workspace (Workscape Phone): quem tem ramal cadastrado liga e recebe chamadas direto pelo Workspace, sem abrir o MicroSIP. Dá para silenciar, colocar em espera, usar o teclado e transferir a ligação.",
      "No chat, quem tem ramal aparece com o número ao lado do nome e o botão de telefone liga para ele.",
      "A administração ganhou a aba Telefone para cadastrar os ramais, ver as chamadas e a auditoria.",
    ],
  },
  {
    versao: "0.5.88",
    data: "2026-10-27",
    itens: [
      "O histórico de mensagens do Chat Interno ganhou um visual novo: conversas mais fáceis de ler, não lidas em destaque e a conversa aberta marcada de forma mais clara.",
      "A aba Disparo não fica mais cortada na lista de conversas.",
    ],
  },
  {
    versao: "0.5.87",
    data: "2026-10-26",
    itens: [
      "O Workspace do Ed ganhou um fundo exclusivo com a arte do Ed, o Tecladista.",
    ],
  },
  {
    versao: "0.5.86",
    data: "2026-10-26",
    itens: [
      "Corrigido o travamento da aba Agenda: ela volta a abrir na versão estável do Workspace, e a versão web fica disponível pelo botão sem poder prender a navegação do aplicativo.",
    ],
  },
  {
    versao: "0.5.85",
    data: "2026-10-26",
    itens: [
      "O Resumo de hoje ficou bem mais rápido: ele passou a usar as IAs mais ágeis, espera menos pelo painel e guarda o último resumo no computador, então aparece na hora ao abrir o app e só é refeito depois de 15 minutos.",
    ],
  },
  {
    versao: "0.5.84",
    data: "2026-10-26",
    itens: [
      "Corrigido: o botão \"Relatar bug ou sugestão\" do Início voltou a abrir o formulário e a enviar, sem travar as outras telas.",
    ],
  },
  {
    versao: "0.5.83",
    data: "2026-10-26",
    itens: [
      "Download de imagens e arquivos do chat: o nome sugerido agora sempre vem com a extensão certa (como .png), mesmo quando o arquivo foi enviado sem ela, e o Windows mantém a extensão ao salvar.",
      "O ícone de copiar imagem no visualizador ficou mais claro.",
      "Resumo de hoje: os recados da agenda que são só chamados de clientes (LOS/LOBI, offline, rompimento, agendamento de cliente) não aparecem mais. Ficam só avisos importantes da equipe, como técnico sem veículo ou atuando em dupla.",
    ],
  },
  {
    versao: "0.5.82",
    data: "2026-10-26",
    itens: [
      "Ao baixar uma imagem do chat, o arquivo agora sai com o nome e a extensão certos (como imagem.png), e não mais sem extensão.",
      "Novo botão para copiar a imagem: no visualizador (ícone de copiar) e no menu da mensagem (\"Copiar imagem\"). Depois é só colar no chat, no Word ou onde quiser.",
    ],
  },
  {
    versao: "0.5.81",
    data: "2026-10-26",
    itens: [
      "Fora do escritório: em Configurações, o novo \"Conexão e VPN\" testa se o app alcança cada servidor e, se a VPN do Windows estiver sem a rota do escritório, o botão \"Corrigir a VPN\" resolve. Na tela de entrada, quando a conexão falha, o mesmo teste aparece em \"Está fora do escritório?\".",
    ],
  },
  {
    versao: "0.5.80",
    data: "2026-10-26",
    itens: [
      "Ditado por voz: clique no microfone, fale e clique de novo, e a IA escreve o que você falou. Funciona nos Lembretes, na conversa com a Inteligência Artificial e nas Notas.",
    ],
  },
  {
    versao: "0.5.79",
    data: "2026-10-26",
    itens: [
      "A Agenda de técnicos agora abre sempre na versão web para todo mundo. O botão \"Versão minimalista\" leva para a agenda do aplicativo.",
      "Nos Lembretes, saiu a opção \"Avisar também no chat da Assistente Acessa\": o formulário ficou mais simples.",
    ],
  },
  {
    versao: "0.5.78",
    data: "2026-10-26",
    itens: [
      "Nos Lembretes, o horário agora é digitado (por exemplo, 0900) e entra sozinho na lista. Não precisa mais clicar em \"+ Horário\": se você já digitou e clicar em Salvar, ele também entra.",
    ],
  },
  {
    versao: "0.5.77",
    data: "2026-10-26",
    itens: [
      "Nova aba Lembretes: escreva do seu jeito, como \"me lembre de beber água todos os dias às 9h e às 15h\", e a IA monta o alarme. Dá para repetir todo dia, em dias da semana, todo mês ou uma vez só.",
      "Quando chega a hora, um alarme aparece no app com som: você conclui ou adia por 5, 10 ou 30 minutos. Também há um atalho Lembretes no Início.",
      "A IA saiu das Notas: elas voltaram a ser só o bloco de anotações de antes.",
    ],
  },
  {
    versao: "0.5.76",
    data: "2026-10-26",
    itens: [
      "Os changelogs agora mostram, no canto inferior direito de cada atualização, quem fez: Lucas Soares.",
    ],
  },
  {
    versao: "0.5.75",
    data: "2026-10-26",
    itens: [
      "Nas Notas, os selos (Fixada, Minha nota, Compartilhada com…) e o texto das notas agora são fáceis de ler no tema claro.",
    ],
  },
  {
    versao: "0.5.74",
    data: "2026-10-26",
    itens: [
      "Notas com IA: ao salvar, a IA sugere o título e etiquetas (como financeiro e OLT) para você filtrar as notas depois.",
      "Lembretes nas notas: a IA acha compromissos como \"ligar para o cliente amanhã às 10h\" e cria o lembrete. Você recebe o aviso da Assistente Acessa no chat e eles aparecem no Resumo de hoje.",
      "Base de conhecimento viva: notas que os colegas marcam como úteis podem virar artigos, e a IA avisa quando duas notas dizem coisas diferentes sobre o mesmo procedimento.",
    ],
  },
  {
    versao: "0.5.73",
    data: "2026-10-26",
    itens: [
      "O app agora abre no tema claro. Se preferir o escuro, é só trocar em Configurações.",
      "A barra do Navegador agora fica certinha no tema claro: abas, endereço e botões com as cores certas.",
    ],
  },
  {
    versao: "0.5.72",
    data: "2026-10-26",
    itens: [
      "O Telefone agora abre um card flutuante de vidro, com teclado, que você pode arrastar. Digite ou cole o número e o MicroSIP abre já discando.",
    ],
  },
  {
    versao: "0.5.71",
    data: "2026-10-26",
    itens: [
      "Novo atalho \"Telefone\" no Início, em Ferramentas e no Meu acesso rápido: digite ou cole o número e o MicroSIP abre já discando.",
    ],
  },
  {
    versao: "0.5.70",
    data: "2026-10-26",
    itens: [
      "O resumo de hoje no Início não repete mais o \"Bom dia\": ele vai direto ao que importa.",
    ],
  },
  {
    versao: "0.5.69",
    data: "2026-10-26",
    itens: [
      "O Início foi redesenhado: ele agora é o primeiro cartão do carrossel, junto com o vídeo, os destaques e a agenda de técnicos, todos sem bordas.",
      "O resumo de hoje aparece sozinho, a coluna \"Agora\" mostra massivos, fila e avisos, e os atalhos levam direto ao Chat interno, Agenda técnica, Navegador, Inteligência Artificial e Ferramentas.",
      "O \"Meu acesso rápido\", onde você escolhe o que quer fixar, agora fica em Ferramentas. As Notas rápidas também ficam só lá, com todas as suas notas.",
      "No Navegador, agora há abas para o Zabbix e o Grafana.",
      "O nome \"Assistente\" mudou para \"Inteligência Artificial\" no menu e nas telas.",
    ],
  },
  {
    versao: "0.5.68",
    data: "2026-10-24",
    itens: [
      "No Disparo de mensagens, o botão \"Escrever com IA\" monta ou melhora o texto da mensagem para você conferir antes de enviar.",
      "As imagens prontas do Assistente Acessa agora só aparecem quando você clica em \"Adicionar imagem pronta\".",
    ],
  },
  {
    versao: "0.5.67",
    data: "2026-10-24",
    itens: [
      "No Disparo de mensagens, quem é administrador agora pode enviar como Assistente Acessa, com imagens prontas (Harry 404 e Ed, o Tecladista), escolhendo quem recebe.",
    ],
  },
  {
    versao: "0.5.66",
    data: "2026-10-24",
    itens: [
      "Pergunte ao Assistente qual é o teclado mais barulhento e descubra de quem é. ⌨️",
    ],
  },
  {
    versao: "0.5.65",
    data: "2026-10-24",
    itens: [
      "Se alguém perguntar ao Assistente se a agenda está fora do ar, ele já sabe quem foi: o Harry. 🫠",
    ],
  },
  {
    versao: "0.5.64",
    data: "2026-10-24",
    itens: [
      "A página inicial do Assistente agora aparece sempre que você abre o Assistente, mesmo com conversas antigas. Para voltar a ela, clique em Nova conversa.",
    ],
  },
  {
    versao: "0.5.63",
    data: "2026-10-24",
    itens: [
      "O Assistente ganhou uma página inicial animada que explica como ele funciona, o que consulta e traz perguntas para experimentar.",
      "Na tela de Rede, o botão \"Explicar para o atendimento\" escreve um texto simples sobre a queda para você repassar ao cliente, e os avisos de queda ficaram mais completos.",
      "Os recados da agenda de técnicos (os blocos \"Outro\") agora aparecem no resumo do dia e no briefing do chat.",
    ],
  },
  {
    versao: "0.5.62",
    data: "2026-10-24",
    itens: [
      "Na Administração, aba IA, tem o botão \"Enviar agora para os destinatários\" no resumo do dia.",
      "Os alertas de rede que você ignorou na tela de Rede não aparecem mais no resumo do dia enviado pelo chat.",
    ],
  },
  {
    versao: "0.5.61",
    data: "2026-10-24",
    itens: [
      "No Assistente, o botão brilhante \"Ver o tour da IA\" mostra o passo a passo de novo, quando você quiser.",
    ],
  },
  {
    versao: "0.5.60",
    data: "2026-10-24",
    itens: [
      "O passo a passo da IA é obrigatório na primeira vez, e quem já viu não precisa ver de novo.",
      "O resumo das 8h no chat agora cumprimenta pelo nome (\"Bom dia, Fulano!\") e conta só os chamados abertos das filas Suporte Técnico, N1, N2 e N3.",
      "Na Administração, aba IA, dá para escolher quem recebe o resumo do dia, por pessoa ou por setor.",
    ],
  },
  {
    versao: "0.5.59",
    data: "2026-10-24",
    itens: [
      "Novidade: nas aulas dos Cursos tem a \"Ajuda da IA\", que resume a aula e tira dúvidas sobre ela.",
      "Dá para colar um print (Ctrl+V) direto na conversa com o Assistente.",
      "Um passo a passo mostra como usar a inteligência artificial; ele abre ao confirmar o aviso da novidade e também no botão brilhante \"Ver o tour da IA\".",
      "Quando a sua sessão está para acabar, o Workspace renova sozinho, sem pedir senha de novo.",
      "O Navegador e a Agenda de Técnicos agora ficam dentro da categoria Operação.",
      "Na Administração, as abas IA e Versões mostram o uso da IA por setor e pessoa e a versão instalada em cada computador.",
    ],
  },
  {
    versao: "0.5.58",
    data: "2026-10-24",
    itens: [
      "Efeitos sonoros: agora quem tem permissão pode disparar com volume de até 200% (acima de 100% o som é amplificado) e sem esperar entre um disparo e outro.",
      "Na aba Permissões dos efeitos sonoros, dá para escolher o volume máximo e o \"sem limite de tempo\" de cada pessoa.",
    ],
  },
  {
    versao: "0.5.57",
    data: "2026-10-24",
    itens: [
      "A caixa do aviso interno ficou mais bonita: a cor muda conforme a prioridade (verde, azul, âmbar ou vermelho), tem botões sempre visíveis no rodapé e funciona nos modos claro e escuro.",
      "Na Administração, o formulário do aviso obrigatório ganhou uma prévia ao vivo que acompanha a rolagem e botões fixos no rodapé.",
    ],
  },
  {
    versao: "0.5.56",
    data: "2026-10-24",
    itens: [
      "A comemoração de venda agora solta fogos de artifício coloridos na tela, no lugar do foguete.",
      "Os efeitos sonoros voltaram a funcionar: quem recebe o som ouve em qualquer tela do Workspace.",
      "A Administração foi reorganizada em abas (Visão geral, Usuários, Grupos, Comunicação e Retorno), com busca e filtros, e todas as opções aparecem sem precisar diminuir o zoom.",
      "Corrigido: ações da agenda (como bloqueios e ausências) não saem mais como \"Usuário não identificado\" depois de algumas horas com o app aberto.",
      "O resumo do dia ficou mais legível, principalmente no modo claro.",
    ],
  },
  {
    versao: "0.5.55",
    data: "2026-10-24",
    itens: [
      "O resumo do dia agora aparece sozinho na tela inicial toda vez que você entra, escrito pela IA da internet.",
      "Dá para pedir o resumo de hoje ou da semana quando quiser, e fechar o resumo no botão Fechar.",
    ],
  },
  {
    versao: "0.5.54",
    data: "2026-10-24",
    itens: [
      "O Assistente agora tem memória: ele guarda o que você conta sobre você (setor, região, como prefere as respostas) e avisa \"Memorizei\", com a opção de desfazer. Veja e edite tudo no botão Memória.",
      "A janela flutuante do Assistente agora pode ser movida pela tela.",
      "Na bolha de contratações do site, arraste até a lixeira no canto direito para tirá-la da tela. Ela volta na próxima vez que você abrir o aplicativo.",
    ],
  },
  {
    versao: "0.5.53",
    data: "2026-10-24",
    itens: [
      "O Assistente agora consegue consultar a agenda de técnicos, os chamados, o resumo do dia e a rede. Pergunte, por exemplo, qual técnico está com mais OS hoje.",
      "Ele só lê o que você já pode ver, e nunca recebe CPF, telefone nem endereço completo. Dá para desligar no botão \"Workspace\".",
    ],
  },
  {
    versao: "0.5.52",
    data: "2026-10-24",
    itens: [
      "O Assistente ganhou um visual novo, parecido com o ChatGPT e o Claude, com as suas conversas anteriores salvas na lateral. Elas ficam só neste computador.",
      "Agora dá para escolher qual IA responde ao Assistente.",
      "Novo botão flutuante do Assistente em todas as telas. Dá para esconder em Configurações.",
    ],
  },
  {
    versao: "0.5.51",
    data: "2026-10-24",
    itens: [
      "O Assistente agora pesquisa na internet (Google) e mostra de onde veio a informação. Dá para ligar e desligar em \"Pesquisar na internet\".",
      "O Assistente responde sobre qualquer assunto, não só sobre a empresa.",
    ],
  },
  {
    versao: "0.5.50",
    data: "2026-10-24",
    itens: [
      "O Assistente agora usa só a IA da internet. Lembre de não escrever dados de clientes nem senhas nas perguntas.",
    ],
  },
  {
    versao: "0.5.49",
    data: "2026-10-24",
    itens: [
      "Novo: Assistente. Faça perguntas e receba respostas de uma IA pela internet.",
      "Rede (OLT): agora dá para ignorar um alerta e ver os ignorados quando quiser, com opção de restaurar.",
      "Configurações: você pode escolher a cor de destaque, o fundo do modo escuro e deixar o tema automático.",
    ],
  },
  {
    versao: "0.5.48",
    data: "2026-10-24",
    itens: [
      "As notificações agora aparecem no sino lá em cima, ao lado da sua foto, com o número de avisos novos.",
      "\"Workspaces\" passou para dentro de Ferramentas.",
    ],
  },
  {
    versao: "0.5.47",
    data: "2026-10-24",
    itens: [
      "A barra lateral foi reorganizada em grupos (Visão geral, Comunicação, Operação, Conteúdo e Espaço de trabalho) e não mostra mais a barra de rolagem.",
      "O aplicativo abre mais rápido.",
    ],
  },
  {
    versao: "0.5.46",
    data: "2026-10-23",
    itens: [
      "Corrigido: em Chamados > SGP, agora mostra \"carregando\" lendo os chamados, inclusive ao atualizar de novo depois de fazer login. Também tem um botão \"Atualizar\" e um \"Já entrei, tentar de novo\" na tela de login.",
      "Corrigido: a tabela de chamados não ultrapassa mais a borda do card (tinha casos em que o fundo não acompanhava e ficava com a aparência quebrada).",
    ],
  },
  {
    versao: "0.5.45",
    data: "2026-10-23",
    itens: [
      "Corrigido: em Chamados > SGP, o botão de \"fazer login\" agora abre o Navegador do próprio Workspace (aba SGP), que é onde o login realmente precisa ser feito.",
    ],
  },
  {
    versao: "0.5.44",
    data: "2026-10-23",
    itens: [
      "Chamados > SGP agora mostra a lista de verdade por fila (Suporte Técnico, N1, N2, N3), igual à aba do site, em vez de só abrir o SGP. Clicar num chamado abre ele no SGP.",
      "Se a pessoa ainda não entrou no SGP pelo Navegador do Workspace, a aba avisa e oferece o atalho para fazer login primeiro.",
    ],
  },
  {
    versao: "0.5.43",
    data: "2026-10-23",
    itens: [
      "Nova aba Chamados: lista os chamados abertos pelo site (protocolo, cliente, assunto e situação, com detalhe ao clicar), e um atalho por categoria do SGP (Suporte Técnico, N1, N2, N3) que abre o relatório real do SGP no navegador.",
    ],
  },
  {
    versao: "0.5.42",
    data: "2026-10-23",
    itens: [
      "IA local: nova ferramenta \"Explicar erro\" em Ferramentas > Rede e NOC, pra colar um erro ou log e entender o que pode ser.",
      "Solicitações internas: botão \"Corrigir ortografia com IA\" na descrição, ao criar uma nova solicitação.",
      "Resumo de hoje/semana na Home passa a olhar também as filas de Suporte Técnico, N1, N2 e N3, e o resumo da semana agora usa o histórico real dos dias, não só o instante de agora.",
    ],
  },
  {
    versao: "0.5.41",
    data: "2026-10-23",
    itens: [
      "Disparo de mensagens (admin) saiu do menu principal e agora é uma aba dentro do Chat Interno, ao lado de Mensagens, Grupos e Pessoas.",
    ],
  },
  {
    versao: "0.5.40",
    data: "2026-10-23",
    itens: [
      "Corrigido de vez o motor da IA local: faltavam três arquivos de sistema (do próprio Windows) no pacote, e por isso ela fechava sozinha ao tentar abrir em alguns PCs.",
    ],
  },
  {
    versao: "0.5.39",
    data: "2026-10-23",
    itens: [
      "Corrigido: a IA local agora mostra o andamento (ex.: baixando o modelo, X%) em vez de parecer travada, e avisa o motivo real quando não consegue iniciar.",
      "Cursos: os dois cursos de desenvolvimento agora mostram Lucas Soares como responsável, com o nome levando ao GitHub dele.",
    ],
  },
  {
    versao: "0.5.38",
    data: "2026-10-23",
    itens: [
      "Home: saudação agora muda com a hora (Bom dia, Boa tarde, Boa noite) e ganhou \"Resumo de hoje\" / \"Resumo da semana\", feito pela IA local com mensagens, avisos e alertas do momento.",
      "Corrigido: o servidor interno de modelos de IA não estava reconhecendo o pedido do app (erro \"Servidor de modelos indisponível\").",
    ],
  },
  {
    versao: "0.5.37",
    data: "2026-10-23",
    itens: [
      "Corrigido: a IA local do chat e das solicitações internas dava erro em alguns PCs de 8 GB ou 12 GB, porque o Windows mostra um pouco menos de memória do que a anunciada.",
      "Quando a IA realmente não funciona num PC (pouca memória, ou fora do Windows), agora a mensagem explica o motivo em vez de um erro genérico.",
    ],
  },
  {
    versao: "0.5.36",
    data: "2026-10-23",
    itens: [
      "Chat interno: novo botão de IA (um brilho ✨ ao lado do emoji) para reescrever seu rascunho, sugerir uma resposta ou resumir a conversa.",
      "Solicitações internas: botão \"Resumir com IA\" em cada uma, para ver rapidinho o problema, o que já foi feito e o que falta.",
      "A IA roda dentro do próprio computador, sem internet depois de baixada uma vez: nada do que você escreve sai da máquina. Só funciona no Windows, com 8 GB de RAM ou mais.",
    ],
  },
  {
    versao: "0.5.35",
    data: "2026-10-23",
    itens: [
      "Marketing > Site: agora mostra os números do site da AcessaNet. Clientes que acessaram, acessos, sessões, contas criadas, chamados abertos pelo site, contratações online e visitantes do Wi-Fi público, com gráficos por dia e filtro por período.",
      "Todos os usuários veem esses dados, e não aparece nome, CPF, e-mail nem telefone de ninguém.",
    ],
  },
  {
    versao: "0.5.34",
    data: "2026-10-23",
    itens: [
      "Nova aba Cursos: a universidade da AcessaNet dentro do Workspace. Você escolhe um curso, assiste às aulas, faz as provas, acompanha seu progresso e recebe o certificado em PDF ao concluir.",
      "Quem gerencia os cursos monta tudo sem programar: cria aulas com texto, imagens, vídeos, PDFs e códigos, monta provas, escolhe quem faz cada curso e vê os relatórios.",
      "Nova aba Marketing no menu, com as abas Resumo, Site, Instagram, Facebook, WhatsApp, Google e YouTube. Por enquanto estão vazias; vamos preencher aos poucos.",
    ],
  },
  {
    versao: "0.5.33",
    data: "2026-10-22",
    itens: [
      "As janelas flutuantes agora podem ficar bem pequenas (até cerca de 280 × 160) e se adaptam ao tamanho: os botões viram só ícones, os blocos se reorganizam e o visual compacto liga sozinho quando a janela é pequena.",
      "A Agenda em versão web agora abre com zoom de 75% por padrão (dá para ajustar com os botões ou Ctrl + / Ctrl −, e Ctrl 0 volta aos 75%).",
    ],
  },
  {
    versao: "0.5.32",
    data: "2026-10-22",
    itens: [
      "No chat, o texto selecionado com o mouse agora aparece destacado em amarelo, em qualquer cor de mensagem, para ficar claro o que será copiado (Ctrl+C ou botão direito > Copiar).",
    ],
  },
  {
    versao: "0.5.31",
    data: "2026-10-22",
    itens: [
      "Corrigido: a aba Rede (OLT) não mostrava os incidentes de agora. Ela passou a ler os alertas mais recentes da OLT Cloud e a reconhecer todos os tipos (queda de PON, PON sem energia, CTO sem energia, PON fora do ar).",
      "Novo “Panorama da rede agora”: quantos clientes estão sem energia, em LOSS e online no total, por OLT e as PONs mais afetadas. Assim uma queda de energia que atinge muita gente aparece mesmo quando não gera um alerta por PON.",
      "Aviso flutuante vermelho quando muitos clientes ficam afetados de uma vez (por exemplo, falta de energia na região).",
      "A lista de clientes afetados de cada incidente agora mostra os clientes sem energia e em LOSS da PON.",
    ],
  },
  {
    versao: "0.5.30",
    data: "2026-10-22",
    itens: [
      "Miniaplicativos: agora o Painel NOC, o Resumo e a Rede (OLT) também podem ser destacados em janelas próprias (botão “Destacar”), junto com o Chat, a Agenda e o Navegador. Cada janela pode ser redimensionada e movida para outro monitor, e todas continuam sincronizadas com o aplicativo principal.",
      "Nas janelas destacadas há “Fixar por cima”, que mantém o painel sempre visível sobre as outras janelas, e “Reintegrar”, que devolve ao Workspace.",
      "A Agenda em versão web (a padrão) agora também tem o botão “Destacar” (e “Reintegrar” na janela própria).",
      "Nova aba “Workspaces”: escolha os painéis (Painel NOC, Rede, Agenda, Chat, Resumo, Navegador), abra todos lado a lado em janelas flutuantes (sempre por cima, se quiser) e salve o conjunto com um nome para abrir de novo com um clique. Salva também a posição e o tamanho de cada janela, inclusive em outro monitor.",
      "As janelas destacadas ganharam “Modo compacto” (menos textos e espaços) para ocupar pouco da tela.",
      "Aviso de incidente de rede mais chamativo: queda de PON aparece em vermelho com ícone de alerta, som de alarme e fica mais tempo na tela; queda de CTO aparece em âmbar. Na aba Rede há “Testar aviso” para ver como fica.",
    ],
  },
  {
    versao: "0.5.29",
    data: "2026-10-22",
    itens: [
      "Nova aba “Rede (OLT)” para quem tem acesso à rede: mostra em tempo real as quedas de PON, quedas de CTO e falta de energia da OLT Cloud, com quantos clientes foram afetados e há quanto tempo.",
      "Em cada incidente dá para ver os clientes afetados (contrato, nome e última queda) e copiar a lista de contratos.",
      "Quando cai uma PON ou CTO, aparece um aviso com som na tela de quem acompanha a rede.",
    ],
  },
  {
    versao: "0.5.28",
    data: "2026-10-22",
    itens: [
      "A Agenda de Técnicos agora abre direto na versão web (igual à da web). Para usar a agenda do aplicativo, clique em “Voltar para a agenda do app”; para voltar à versão web, use o botão “Versão web”.",
      "O aplicativo agora procura atualização a cada ~5 minutos, mesmo já tendo uma baixada: se sair uma versão mais nova, ele baixa a mais nova no lugar, e antes de reiniciar confere de novo. Ninguém instala mais uma versão que já ficou velha.",
    ],
  },
  {
    versao: "0.5.27",
    data: "2026-10-22",
    itens: [
      "Na Agenda de Técnicos, novo botão “Versão web”: abre a agenda original (igual à da web) aqui dentro do aplicativo, já com o seu usuário, e o botão “Voltar para a agenda do app” retorna à tela de antes.",
    ],
  },
  {
    versao: "0.5.26",
    data: "2026-10-22",
    itens: [
      "As próximas atualizações serão feitas sozinhas, sem avisos: o aplicativo baixa em segundo plano e reinicia quando o computador estiver parado ou o aplicativo minimizado.",
      "Corretor ortográfico no chat: palavras erradas ficam sublinhadas e, com o botão direito sobre elas, aparecem sugestões de correção e a opção de adicionar ao dicionário.",
      "Depois de atualizar, o aplicativo volta do jeito que estava (minimizado ou na bandeja), sem aparecer na frente do seu trabalho.",
    ],
  },
  {
    versao: "0.5.25",
    data: "2026-10-22",
    itens: [
      "A barra lateral abre e fecha de forma mais fluida, e agora todas as páginas acompanham a largura dela.",
      "Corrigido: a logo no topo da barra não sobe mais ao recolher ou abrir.",
      "Corrigido: a aba Navegador voltou a se ajustar certinho quando a barra abre e fecha.",
    ],
  },
  {
    versao: "0.5.24",
    data: "2026-10-22",
    itens: [
      "A barra lateral agora fica recolhida (só ícones) e abre quando você encosta o mouse na borda esquerda da tela. Ela recolhe sozinha ao sair de cima ou ao escolher um item.",
      "O botão da barra passa a fixá-la aberta (ou soltar de novo). Quem preferir o modo antigo desliga em Configurações > Barra lateral.",
      "O Chat Interno e o Navegador também podem ser destacados em janelas próprias (botão “Destacar”), como a Agenda. O botão “Reintegrar” devolve ao Workspace; o Navegador mantém as páginas abertas ao mudar de janela.",
    ],
  },
  {
    versao: "0.5.23",
    data: "2026-10-22",
    itens: [
      "No Navegador, novo atalho para a OLT, junto com SGP e Mundiale.",
      "O zoom da grade da Agenda de Técnicos foi retirado; a agenda volta a ficar como antes.",
      "Agenda de Técnicos agora pode ser destacada: o botão “Destacar” abre a agenda em uma janela própria, que pode ir para outro monitor, enquanto você usa o resto do Workspace. Lá há o “Modo compacto” e o botão “Reintegrar”, que devolve a agenda ao Workspace.",
    ],
  },
  {
    versao: "0.5.22",
    data: "2026-10-22",
    itens: [
      "No chat, agora dá para encaminhar qualquer mensagem (sua ou de outra pessoa) para vários contatos e grupos de uma vez: abra as opções da mensagem e escolha “Encaminhar”.",
      "No Navegador, agora dá para diminuir ou aumentar o zoom da página (botões na barra, Ctrl + / Ctrl − / Ctrl 0 ou Ctrl + roda do mouse). Cada site guarda o seu zoom.",
    ],
  },
  {
    versao: "0.5.21",
    data: "2026-10-22",
    itens: [
      "Nova aba “Navegador”: abre o SGP, a Mundiale, a OLT ou qualquer site dentro do Workspace.",
      "Ao trocar de aba do Workspace, a página do Navegador continua como estava. Ao sair da conta, os logins do Navegador são apagados.",
    ],
  },
  {
    versao: "0.5.20",
    data: "2026-10-22",
    itens: [
      "Depois de entrar, o Workspace agora mantém todas as pessoas conectadas mesmo após uma atualização.",
      "A sessão continua protegida pelo Windows; sair do aplicativo ou uma sessão expirada ainda pedem novo acesso.",
      "Os emojis do chat agora aparecem corretamente em todos os computadores.",
      "O aviso de figurinha ou imagem recebida agora mostra “Figurinha” ou “Imagem”, em vez de um endereço estranho.",
      "O aviso de nova mensagem agora mostra a foto de quem enviou.",
      "Figurinhas recebidas agora aparecem como imagem no chat, e não como um endereço de texto.",
    ],
  },
  {
    versao: "0.5.19",
    data: "2026-10-22",
    itens: [
      "O aviso de nova mensagem ficou mais bonito e agora toca um som quando chega.",
      "Quando alguém menciona você em um grupo, o aviso aparece em destaque dourado e com um som diferente.",
      "A Agenda de Instalação começa a carregar antes do clique e abre mais rápido; a Agenda também para de consultar quando está fora da tela.",
    ],
  },
  {
    versao: "0.5.18",
    data: "2026-10-22",
    itens: [
      "Links enviados nas conversas agora abrem corretamente no navegador.",
      "Agora é possível selecionar e copiar o texto das mensagens; a opção “Copiar texto” também funciona em mensagens antigas.",
    ],
  },
  {
    versao: "0.5.17",
    data: "2026-10-21",
    itens: [
      "No painel de administração: lista de quem está com o aplicativo aberto agora, com setor, versão e desde quando.",
    ],
  },
  {
    versao: "0.5.16",
    data: "2026-10-21",
    itens: [
      "A cada venda nova, aparece um aviso no topo da tela, toca um som e foguetes sobem e explodem em fogos.",
      "No painel de administração: “Testar foguetes na minha tela” mostra a comemoração só para você; “Testar para todos” mostra para todos, depois de confirmar.",
      "Nova tela de entrada, com cumprimento pelo nome e aviso quando a sessão expira.",
    ],
  },
  {
    versao: "0.5.15",
    data: "2026-10-21",
    itens: [
      "Novo menu Disparo (só para administradores): escreva uma mensagem, anexe um arquivo e escolha quem recebe, por pessoa, setor ou grupo.",
    ],
  },
  {
    versao: "0.5.14",
    data: "2026-10-21",
    itens: [
      "Painel NOC: ao clicar em um cartão de chamados (Suporte, Offline, Instalação, etc.), o relatório dele abre no SGP no navegador.",
    ],
  },
  {
    versao: "0.5.14",
    data: "2026-10-21",
    itens: [
      "Dashboard configurado por padrão em http://192.168.1.133:5000. Configurações antigas que apontavam para a Agenda na porta 8500 são corrigidas automaticamente ao abrir o app.",
    ],
  },
  {
    versao: "0.5.13",
    data: "2026-10-21",
    itens: [
      "Dashboard: os dados passam pela conexão autenticada do Chat Interno. O aplicativo não abre mais uma conexão direta com o servidor na porta 5000.",
      "Corrige o caminho de conexão afetado por websocket error, socket hang up e ECONNRESET. O servidor mantém a última base de clientes para os novos acessos.",
    ],
  },
  {
    versao: "0.5.12",
    data: "2026-10-21",
    itens: [
      "Dashboard: o endereço da página antiga agora é convertido automaticamente para o servidor de dados na porta 5000.",
      "Diagnóstico de conexão no painel com servidor utilizado, última resposta recebida e último erro.",
      "Ambiente de desenvolvimento na rede interna, com mudanças de interface em tempo real ao salvar o código.",
    ],
  },
  {
    versao: "0.5.11",
    data: "2026-10-21",
    itens: [
      "Painel NOC: total de ocorrências abertas e horários reais de atualização dos chamados e da base de clientes.",
      "Avisos quando a consulta de instalações ou chamados ao SGP falha, mantendo os últimos números recebidos.",
      "Conexão alternativa no desktop e proteção para não misturar dados guardados de outros servidores ou usuários.",
    ],
  },
  {
    versao: "0.5.10",
    data: "2026-10-21",
    itens: [
      "Painel NOC: agora o próprio aplicativo busca os dados direto no servidor, sem depender da página. Corrige o caso de ficar sem dados com a mensagem de erro de conexão.",
    ],
  },
  {
    versao: "0.5.9",
    data: "2026-10-21",
    itens: [
      "Painel NOC: se a conexão com o servidor falhar, o app tenta outro caminho (como o painel antigo) e mostra o motivo, com o botão Tentar novamente.",
      "Painel NOC: sem conexão, continua mostrando os últimos números recebidos, marcados como desatualizados.",
    ],
  },
  {
    versao: "0.5.8",
    data: "2026-10-21",
    itens: [
      "Corrigido: com zoom alto ou janela baixa, o menu lateral agora rola e dá para chegar em todos os itens.",
      "A janela passa a abrir sempre dentro da área da tela, mesmo em telas pequenas.",
      "Painel NOC: abre na visão resumida, igual ao painel do servidor (192.168.1.133). A visão completa fica no botão do topo.",
      "Painel NOC: a base de clientes aparece logo ao abrir, usando o último valor recebido, em vez de ficar vazia até a próxima atualização.",
    ],
  },
  {
    versao: "0.5.7",
    data: "2026-10-21",
    itens: ["Perfil: agora você pode trocar o seu e-mail de acesso (pedimos a senha atual para confirmar)."],
  },
  {
    versao: "0.5.6",
    data: "2026-10-21",
    itens: [
      "Agenda: agora é só clicar, como antes. Clique em Ausência ou Equipe no topo do técnico, ou num horário vazio para marcar almoço, reunião e outros bloqueios.",
      "Clique em um bloqueio já marcado para editar, terminar o chamado ou remover.",
      "Agenda: botão Histórico ao lado de Gerenciar abre direto o histórico de ações.",
      "Perfil: agora você pode trocar a sua foto e a sua senha.",
    ],
  },
  {
    versao: "0.5.5",
    data: "2026-10-21",
    itens: [
      "Agenda: novo botão Gerenciar para registrar ausências, cores de equipe e bloqueios de horário (almoço, reunião, chamado externo).",
      "Coordenador de rota: filtros de status e motivo, pesquisa de técnico e lista de alertas.",
      "Contratações: botão flutuante com o número de pedidos pendentes e atalho para abrir o painel do site no navegador.",
      "Painel NOC: botão Visão resumida no topo, que lembra a sua escolha.",
      "Administração do chat disponível no menu lateral para administradores.",
      "A TI agora pode forçar a atualização: aparece um aviso na tela de todos para atualizar.",
      "Nova aba Changelog.",
    ],
  },
  {
    versao: "0.5.4",
    data: "2026-10-21",
    itens: ["O botão Verificar atualizações agora mostra que está verificando e a hora da última verificação."],
  },
  {
    versao: "0.5.3",
    data: "2026-10-21",
    itens: [
      "Corrigida a atualização automática, que não conseguia falar com o servidor.",
      "Logo e ícone novos do aplicativo.",
    ],
  },
  {
    versao: "0.5.2",
    data: "2026-10-21",
    itens: [
      "O zoom padrão agora é 70%.",
      "O ícone do aplicativo aparece certo na barra de tarefas.",
    ],
  },
  {
    versao: "0.5.1",
    data: "2026-10-21",
    itens: ["O aplicativo passa a se atualizar sozinho pelo servidor da empresa."],
  },
];

export interface Chamador {
  /** Nome, ramal ou número formatado: o que aparece em destaque. */
  titulo: string;
  /** Linha de apoio: "Ramal 1003", "Número externo"… */
  sub: string;
  /** Ramal interno (da equipe ou não), vazio para número externo. */
  ramal: string;
  externo: boolean;
}

// Ramais da central têm poucos dígitos; telefones da rua têm 8 ou mais.
const RAMAL_INTERNO = /^\d{2,6}$/;
// Para discar um ramal a central exige um prefixo (778 + ramal, ex.: 7781003). Esse número com prefixo continua sendo ramal.
const RAMAL_COM_PREFIXO = /^778(\d{2,5})$/;

/** (24) 99999-1234 / (24) 3333-1234. Tira o +55 e o 0 de operadora; o que não for número brasileiro fica como veio. */
export function formatarTelefone(bruto: string): string {
  let d = bruto.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.startsWith("0") && (d.length === 11 || d.length === 12)) d = d.slice(1);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return bruto;
}

/** Nomes que a própria central coloca quando não sabe quem é ("asterisk" numa transferência, "unknown"…): não servem de nome. */
const NOME_GENERICO = /^(asterisk|unknown|unavailable|outbound call|wp_\w+|<unknown>)$/i;
export const nomeGenerico = (nome: string) => NOME_GENERICO.test(nome.trim().replace(/^"|"$/g, ""));

/** Número de verdade: a central às vezes põe "asterisk" no lugar do número (usuário SIP genérico). Sem dígito não é número. */
export const numeroUtil = (numero: string) => { const n = numero.trim(); return !n || nomeGenerico(n) || !/\d/.test(n) ? "" : n; };

/**
 * Descobre quem está ligando. O nome da equipe (diretório de ramais) vale mais que o nome que vem no cabeçalho SIP,
 * porque a central às vezes manda só o número ou um nome genérico.
 */
export function identificarChamador(numero: string, nomeSip: string, equipe: Map<string, string>): Chamador {
  const n = numeroUtil(numero);
  const nomeLimpo = nomeGenerico(nomeSip) ? "" : nomeSip.trim();
  if (!n) return { titulo: nomeLimpo || "Número desconhecido", sub: "", ramal: "", externo: false };
  const semPrefixo = RAMAL_COM_PREFIXO.exec(n)?.[1] ?? "";
  const daEquipe = equipe.get(n) ?? (semPrefixo ? equipe.get(semPrefixo) : undefined);
  if (daEquipe) return { titulo: daEquipe, sub: `Ramal ${semPrefixo || n}`, ramal: semPrefixo || n, externo: false };
  if (semPrefixo) return { titulo: nomeLimpo || `Ramal ${semPrefixo}`, sub: nomeLimpo ? `Ramal ${semPrefixo}` : "Ramal interno", ramal: semPrefixo, externo: false };
  if (RAMAL_INTERNO.test(n)) return { titulo: nomeLimpo || `Ramal ${n}`, sub: nomeLimpo ? `Ramal ${n}` : "Ramal interno", ramal: n, externo: false };
  const tel = formatarTelefone(n);
  return { titulo: nomeLimpo || tel, sub: nomeLimpo ? tel : "Número externo", ramal: "", externo: true };
}

/** Iniciais para o avatar: "Ana Souza" -> "AS", "Plantão" -> "PL". Número ou ramal não tem iniciais (vazio): o avatar mostra o ícone. */
export function iniciais(titulo: string): string {
  const limpo = titulo.trim();
  if (!limpo || /^[\d\s()+\-.*#]+$/.test(limpo) || /^ramal\b/i.test(limpo) || /^n[úu]mero\b/i.test(limpo)) return "";
  const palavras = limpo.split(/\s+/).filter((p) => /\p{L}/u.test(p));
  if (!palavras.length) return "";
  const primeira = [...palavras[0]].find((c) => /\p{L}/u.test(c)) ?? "";
  if (palavras.length === 1) return [...palavras[0]].filter((c) => /\p{L}/u.test(c)).slice(0, 2).join("").toLocaleUpperCase("pt-BR");
  const ultima = [...palavras[palavras.length - 1]].find((c) => /\p{L}/u.test(c)) ?? "";
  return (primeira + ultima).toLocaleUpperCase("pt-BR");
}

/** Nível de áudio 0..255 -> 0..1 para o anel do avatar. A raiz deixa a fala normal visível sem precisar gritar. */
export function nivelParaAnel(nivel: number): number {
  return Math.max(0, Math.min(1, Math.sqrt(Math.max(0, nivel) / 255) * 1.25));
}

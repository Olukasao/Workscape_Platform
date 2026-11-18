import { useServers } from "../stores/workspace";

// Efeitos sonoros remotos: quem tem permissão toca um som no computador de outra pessoa que está online.
// Quem recebe ouve o som onde quer que esteja no Workspace (antes só tocava com a tela do Chat carregada).
// Os arquivos de áudio ficam no servidor do Chat, em /sounds.

// Volume em porcentagem. Até 100% é o volume normal; de 101% a 200% o som é amplificado (com limitador).
// O servidor já limita o que cada pessoa pode pedir; este é o teto de segurança de quem recebe.
export const VOLUME_ABSOLUTO_PERCENT = 200;
const VOLUME_PADRAO_PERCENT = 60;
const CHAVES_CONHECIDAS: Record<string, string> = {
  faaaa: "/sounds/faaaa.wav",
  vine_boom: "/sounds/vine-boom.wav",
  metal_pipe: "/sounds/metal-pipe.wav",
  windows_error: "/sounds/windows-error.wav",
  bruh: "/sounds/bruh.wav",
  minecraft_cave: "/sounds/minecraft-cave.wav",
};
const CAMINHO_VALIDO = /^\/sounds\/(?:custom\/)?[a-zA-Z0-9._-]+\.(mp3|wav|ogg|opus|webm|m4a|mp4|aac|flac)$/i;

export interface EfeitoRemoto {
  sound?: string;
  sound_key?: string;
  soundKey?: string;
  /** Fração de 0 a 1 (apps antigos) ou, se maior que 1, porcentagem. */
  volume?: number | string;
  /** Porcentagem de 0 a 200 (campo novo). */
  volume_percent?: number | string;
  label?: string;
  requested_by?: string;
}

/** Caminho do som no servidor, ou "" se o pedido não for um som permitido (nunca toca endereço de fora). */
export function caminhoPermitido(payload: EfeitoRemoto = {}): string {
  const chave = String(payload.sound_key || payload.soundKey || "").trim().toLowerCase();
  if (CHAVES_CONHECIDAS[chave]) return CHAVES_CONHECIDAS[chave];
  const caminho = String(payload.sound || "").trim();
  return CAMINHO_VALIDO.test(caminho) ? caminho : "";
}

/** Endereço completo do áudio no servidor do Chat. Dentro do app, "/sounds/x.wav" sozinho apontaria para o próprio app. */
export function urlDoSom(caminho: string, origem = useServers.getState().config.chat): string {
  if (!CAMINHO_VALIDO.test(caminho)) return "";
  try {
    return new URL(caminho, origem).href;
  } catch {
    return "";
  }
}

/** Volume do pedido em porcentagem, de 0 a 200. Aceita o campo novo (volume_percent) ou o antigo (volume). */
export function percentDoEfeito(payload: Pick<EfeitoRemoto, "volume" | "volume_percent"> = {}): number {
  const novo = payload.volume_percent;
  if (novo !== undefined && novo !== null && novo !== "" && Number.isFinite(Number(novo))) {
    return Math.max(0, Math.min(VOLUME_ABSOLUTO_PERCENT, Math.round(Number(novo))));
  }
  const antigo = payload.volume;
  const n = Number(antigo);
  if (antigo === undefined || antigo === null || antigo === "" || !Number.isFinite(n)) return VOLUME_PADRAO_PERCENT;
  return Math.max(0, Math.min(VOLUME_ABSOLUTO_PERCENT, Math.round(n > 1 ? n : n * 100)));
}

let atual: HTMLAudioElement | null = null;
let contexto: AudioContext | null = null;
/** Controle de ganho do som que está tocando (null quando tocou pelo caminho simples, sem amplificador). */
let ganhoAtual: GainNode | null = null;

/** Descarta o contexto de áudio e o som atual (usado nos testes; o app cria outro na próxima vez que tocar). */
export function reiniciarContextoDeAudio() {
  atual?.pause();
  atual = null;
  ganhoAtual = null;
  contexto = null;
}

/** Contexto de áudio pronto para tocar (rodando), ou null se o navegador não deixar: aí o som toca pelo caminho simples. */
async function contextoPronto(): Promise<AudioContext | null> {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    contexto ??= new Ctx();
    if (contexto.state !== "running") await contexto.resume?.();
    // Suspenso (sem permissão para tocar sozinho): um som ligado a ele sairia mudo, então fica no caminho simples.
    return contexto.state === "running" ? contexto : null;
  } catch {
    return null;
  }
}

/** Liga o áudio a um ganho seguido de um limitador (sem ele, o som estoura). Devolve o ganho, para mudar o volume ao vivo, ou null. */
function ligarGanho(ctx: AudioContext, audio: HTMLAudioElement, ganho: number): GainNode | null {
  try {
    const fonte = ctx.createMediaElementSource(audio);
    const amplificador = ctx.createGain();
    amplificador.gain.value = ganho;
    // Limitador: segura os picos para o som ficar alto sem distorcer nem machucar o alto-falante.
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = -3;
    limitador.knee.value = 0;
    limitador.ratio.value = 20;
    limitador.attack.value = 0.003;
    limitador.release.value = 0.12;
    fonte.connect(amplificador).connect(limitador).connect(ctx.destination);
    return amplificador;
  } catch {
    return null;
  }
}

/** Toca um áudio do servidor no volume pedido (0–200%). Sempre que possível passa pelo ganho, para o volume poder mudar ao vivo. */
export async function tocarSomNoVolume(url: string, percent: number): Promise<boolean> {
  if (!url || typeof window === "undefined" || typeof window.Audio !== "function") return false;
  const pct = Math.max(0, Math.min(VOLUME_ABSOLUTO_PERCENT, percent));
  // Um efeito novo corta o anterior, para não empilhar sons.
  atual?.pause();
  atual = null;
  ganhoAtual = null;
  try {
    // Para ligar o áudio de outro endereço ao ganho o navegador exige permissão de leitura (CORS), que o servidor dá em /sounds.
    const ctx = await contextoPronto();
    if (ctx) {
      const audio = new window.Audio();
      audio.crossOrigin = "anonymous";
      audio.src = url;
      audio.volume = 1;
      const ganho = ligarGanho(ctx, audio, pct / 100);
      if (ganho) {
        atual = audio;
        ganhoAtual = ganho;
        await audio.play();
        return true;
      }
    }
  } catch {
    /* cai para o volume normal abaixo */
    atual = null;
    ganhoAtual = null;
  }
  try {
    const audio = new window.Audio(url);
    audio.volume = Math.min(1, pct / 100);
    atual = audio;
    await audio.play();
    return true;
  } catch (erro) {
    console.warn("[efeitos-sonoros] não foi possível tocar:", erro instanceof Error ? erro.message : erro);
    return false;
  }
}

/**
 * Muda o volume do som que está tocando agora (quem enviou mexe no controle e o volume acompanha, sem cortar o som).
 * 0–200% quando o som passa pelo ganho; no caminho simples o teto é 100%. Devolve false se não há som tocando.
 */
export function ajustarVolumeAoVivo(percent: number): boolean {
  const pct = Math.max(0, Math.min(VOLUME_ABSOLUTO_PERCENT, Number.isFinite(percent) ? percent : 0));
  if (!atual) return false;
  if (ganhoAtual) {
    const alvo = pct / 100;
    if (contexto && typeof ganhoAtual.gain.setTargetAtTime === "function") ganhoAtual.gain.setTargetAtTime(alvo, contexto.currentTime, 0.03); // suave: sem estalos
    else ganhoAtual.gain.value = alvo;
    return true;
  }
  atual.volume = Math.min(1, pct / 100);
  return true;
}

/** Toca o efeito recebido. Devolve false se o pedido foi recusado ou o áudio não pôde tocar. */
export async function tocarEfeitoRemoto(payload: EfeitoRemoto): Promise<boolean> {
  const url = urlDoSom(caminhoPermitido(payload));
  if (!url) return false;
  return tocarSomNoVolume(url, percentDoEfeito(payload));
}

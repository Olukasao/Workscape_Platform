// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const memoria = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => void memoria.set(k, v), removeItem: (k: string) => void memoria.delete(k) });
vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });

class AudioFalso {
  static criados: AudioFalso[] = [];
  volume = 1;
  pausado = false;
  crossOrigin = "";
  src: string;
  constructor(src = "") { this.src = src; AudioFalso.criados.push(this); }
  pause() { this.pausado = true; }
  async play() { if (this.src.includes("bloqueia")) throw new Error("bloqueado"); }
}
// Cadeia de áudio falsa, para conferir a amplificação acima de 100%.
const cadeia: { ganho?: { gain: { value: number } }; limitador?: { threshold: { value: number } }; ligados: string[] } = { ligados: [] };
class ContextoFalso {
  state = "running";
  currentTime = 0;
  destination = { nome: "saida" };
  resume() { return Promise.resolve(); }
  createMediaElementSource() { const n = { connect: (x: { nome?: string }) => { cadeia.ligados.push(`fonte->${x.nome}`); return x; } }; return n; }
  createGain() { const g = { nome: "ganho", gain: { value: 1 }, connect: (x: { nome?: string }) => { cadeia.ligados.push(`ganho->${x.nome}`); return x; } }; cadeia.ganho = g; return g; }
  createDynamicsCompressor() { const c = { nome: "limitador", threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, connect: (x: { nome?: string }) => { cadeia.ligados.push(`limitador->${x.nome}`); return x; } }; cadeia.limitador = c; return c; }
}
const janela: Record<string, unknown> = { Audio: AudioFalso };
vi.stubGlobal("window", janela);

const { ajustarVolumeAoVivo, reiniciarContextoDeAudio, caminhoPermitido, urlDoSom, percentDoEfeito, tocarEfeitoRemoto } = await import("../src/services/efeitosSonoros");
const CHAT = "http://192.168.1.133:8600";

describe("efeitos sonoros remotos", () => {
  beforeEach(() => { AudioFalso.criados = []; });

  it("aceita os sons conhecidos pela chave e os enviados (custom) pelo caminho", () => {
    expect(caminhoPermitido({ sound_key: "vine_boom" })).toBe("/sounds/vine-boom.wav");
    expect(caminhoPermitido({ sound: "/sounds/custom/1789-abc-meme.mp3" })).toBe("/sounds/custom/1789-abc-meme.mp3");
    expect(caminhoPermitido({ soundKey: "BRUH" })).toBe("/sounds/bruh.wav");
  });

  it("recusa endereços de fora, caminhos estranhos e extensões que não são de áudio", () => {
    for (const sound of ["https://evil.com/a.mp3", "//evil.com/a.mp3", "/sounds/../etc/passwd", "/sounds/a.exe", "/outra/pasta/a.mp3", "/sounds/custom/a b.mp3", ""]) {
      expect(caminhoPermitido({ sound })).toBe("");
    }
  });

  it("monta o endereço no servidor do Chat, e não dentro do app", () => {
    expect(urlDoSom("/sounds/faaaa.wav", CHAT)).toBe("http://192.168.1.133:8600/sounds/faaaa.wav");
    expect(urlDoSom("/sounds/custom/x.mp3", `${CHAT}/`)).toBe("http://192.168.1.133:8600/sounds/custom/x.mp3");
    expect(urlDoSom("https://evil.com/a.mp3", CHAT)).toBe("");
  });

  it("lê o volume em porcentagem: campo novo, campo antigo e teto de 200%", () => {
    expect(percentDoEfeito({ volume_percent: 150 })).toBe(150);
    expect(percentDoEfeito({ volume_percent: 999 })).toBe(200);
    expect(percentDoEfeito({ volume_percent: -4 })).toBe(0);
    expect(percentDoEfeito({ volume: 0.5 })).toBe(50);
    expect(percentDoEfeito({ volume: 1 })).toBe(100);
    expect(percentDoEfeito({ volume: 80 })).toBe(80);
    expect(percentDoEfeito({ volume: 0.5, volume_percent: 120 })).toBe(120);
    expect(percentDoEfeito({})).toBe(60);
    expect(percentDoEfeito({ volume: "abc" })).toBe(60);
  });

  it("até 100% toca no volume normal, pelo servidor do Chat, e corta o efeito anterior", async () => {
    const { useServers } = await import("../src/stores/workspace");
    useServers.setState({ config: { ...useServers.getState().config, chat: CHAT } });
    expect(await tocarEfeitoRemoto({ sound_key: "faaaa", volume_percent: 50 })).toBe(true);
    const primeiro = AudioFalso.criados[0];
    expect(primeiro.src).toBe(`${CHAT}/sounds/faaaa.wav`);
    expect(primeiro.volume).toBe(0.5);
    expect(await tocarEfeitoRemoto({ sound: "/sounds/custom/novo.mp3", volume: 0.9 })).toBe(true);
    expect(primeiro.pausado).toBe(true);
    expect(AudioFalso.criados[1].volume).toBe(0.9);
    expect(cadeia.ligados).toHaveLength(0);
  });

  it("acima de 100% amplifica com ganho e limitador (e pede leitura permitida do áudio)", async () => {
    janela.AudioContext = ContextoFalso;
    cadeia.ligados = [];
    expect(await tocarEfeitoRemoto({ sound_key: "bruh", volume_percent: 150 })).toBe(true);
    const audio = AudioFalso.criados.at(-1)!;
    expect(audio.crossOrigin).toBe("anonymous");
    expect(audio.volume).toBe(1);
    expect(cadeia.ganho!.gain.value).toBeCloseTo(1.5);
    expect(cadeia.limitador!.threshold.value).toBe(-3);
    expect(cadeia.ligados).toEqual(["fonte->ganho", "ganho->limitador", "limitador->saida"]);
    delete janela.AudioContext;
  });

  it("se o navegador não puder amplificar, toca no máximo normal em vez de ficar mudo", async () => {
    delete janela.AudioContext;
    expect(await tocarEfeitoRemoto({ sound_key: "bruh", volume_percent: 180 })).toBe(true);
    const audio = AudioFalso.criados.at(-1)!;
    expect(audio.volume).toBe(1);
    expect(audio.crossOrigin).not.toBe("anonymous");
  });

  it("não toca pedido inválido e devolve false se o áudio for bloqueado", async () => {
    expect(await tocarEfeitoRemoto({ sound: "https://evil.com/a.mp3" })).toBe(false);
    expect(AudioFalso.criados).toHaveLength(0);
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await tocarEfeitoRemoto({ sound: "/sounds/custom/bloqueia.mp3" })).toBe(false);
    aviso.mockRestore();
  });

  it("volume ao vivo: no caminho do ganho vai de 0 a 200% com o som tocando, inclusive subindo acima de onde começou", async () => {
    janela.AudioContext = ContextoFalso;
    cadeia.ligados = [];
    expect(await tocarEfeitoRemoto({ sound_key: "bruh", volume_percent: 60 })).toBe(true);
    const audio = AudioFalso.criados.at(-1)!;
    expect(audio.volume).toBe(1); // o volume fica no ganho
    expect(cadeia.ganho!.gain.value).toBeCloseTo(0.6);
    expect(ajustarVolumeAoVivo(150)).toBe(true);
    expect(cadeia.ganho!.gain.value).toBeCloseTo(1.5); // acima de onde começou
    expect(ajustarVolumeAoVivo(0)).toBe(true);
    expect(cadeia.ganho!.gain.value).toBe(0);
    expect(ajustarVolumeAoVivo(999)).toBe(true);
    expect(cadeia.ganho!.gain.value).toBeCloseTo(2); // teto de 200%
    expect(audio.pausado).toBe(false); // o som não foi cortado
    delete janela.AudioContext;
  });

  it("volume ao vivo sem ganho (caminho simples): acompanha até 100%; sem som tocando devolve false", async () => {
    delete janela.AudioContext;
    expect(await tocarEfeitoRemoto({ sound_key: "bruh", volume_percent: 40 })).toBe(true);
    const audio = AudioFalso.criados.at(-1)!;
    expect(audio.volume).toBeCloseTo(0.4);
    expect(ajustarVolumeAoVivo(25)).toBe(true);
    expect(audio.volume).toBeCloseTo(0.25);
    expect(ajustarVolumeAoVivo(180)).toBe(true);
    expect(audio.volume).toBe(1); // sem amplificador, o teto é 100%
  });

  it("o contexto de áudio suspenso não deixa o som mudo: cai no caminho simples", async () => {
    class Suspenso extends ContextoFalso { state = "suspended"; resume() { return Promise.resolve(); } }
    reiniciarContextoDeAudio();
    janela.AudioContext = Suspenso;
    expect(await tocarEfeitoRemoto({ sound_key: "bruh", volume_percent: 70 })).toBe(true);
    const audio = AudioFalso.criados.at(-1)!;
    expect(audio.volume).toBeCloseTo(0.7);
    delete janela.AudioContext;
    reiniciarContextoDeAudio();
  });
});

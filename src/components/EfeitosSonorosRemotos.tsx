import { useEffect } from "react";
import { socket } from "../services/socket";
import { ajustarVolumeAoVivo, percentDoEfeito, tocarEfeitoRemoto, type EfeitoRemoto } from "../services/efeitosSonoros";
import { useSession } from "../stores/workspace";

/** Ouve os efeitos sonoros enviados por outras pessoas e toca em qualquer tela do Workspace. Não desenha nada. */
export default function EfeitosSonorosRemotos() {
  const token = useSession((s) => s.token);
  useEffect(() => {
    if (!token) return;
    const s = socket;
    const aoReceber = (dados: EfeitoRemoto = {}) => void tocarEfeitoRemoto(dados);
    // Volume ao vivo: quem enviou mexe no controle e o som que está tocando acompanha.
    const aoMudarVolume = (dados: EfeitoRemoto = {}) => { ajustarVolumeAoVivo(percentDoEfeito(dados)); };
    s.on("play-prank-sound", aoReceber);
    s.on("prank-sound-volume", aoMudarVolume);
    return () => { s.off("play-prank-sound", aoReceber); s.off("prank-sound-volume", aoMudarVolume); };
  }, [token]);
  return null;
}

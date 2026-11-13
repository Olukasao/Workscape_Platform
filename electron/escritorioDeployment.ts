// Servidor do Escritório (Office 3D) na rede interna, só em HTTP como o chat e o painel NOC.
// Fixo de propósito: o app só abre páginas dessa origem na visão nativa do Escritório (login único por bilhete, sem senha).
export const escritorioOrigin = "http://192.168.1.133:8790";
/** O endereço com o bilhete de login único precisa ser da origem do Escritório, ir para /sso e não trazer usuário nem senha. */
export function urlDoEscritorioValida(input: string): string | null {
  try {
    const u = new URL(input);
    if (u.origin !== escritorioOrigin || u.pathname !== "/sso" || u.username || u.password || u.hash) return null;
    if ([...u.searchParams.keys()].some((k) => k !== "ticket")) return null;
    return u.href;
  } catch {
    return null;
  }
}

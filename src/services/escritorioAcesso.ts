import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useSession } from "../stores/workspace";

/**
 * O Escritório (Workspace 3D) só aparece para quem o servidor liberar (ESCRITORIO_USUARIOS no chat interno).
 * Sem resposta do servidor, fica escondido: nunca aparece "por padrão".
 */
export function useEscritorioDisponivel() {
  const user = useSession((s) => s.user);
  const q = useQuery({
    queryKey: ["escritorio", "disponivel", user?.id],
    enabled: !!user,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: async () => (await api.get<{ disponivel: boolean }>("/escritorio/disponivel")).data.disponivel === true,
  });
  return q.data === true;
}

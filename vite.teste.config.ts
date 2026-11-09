import { defineConfig, mergeConfig } from "vite";
import live from "./vite.live.config.ts";

// Teste em TEMPO REAL contra o servidor de TESTES: igual ao "live" (recarrega ao salvar o código),
// mas o chat vai para o servidor e o banco de testes (porta 8601), nunca para a produção.
const chatTeste = "http://192.168.1.133:8601";
export default mergeConfig(live, defineConfig({
  server: {
    port: 5181,
    proxy: {
      "/__workspace/chat": { target: chatTeste, changeOrigin: true, ws: true, rewrite: (url: string) => url.replace("/__workspace/chat", "") },
      "/uploads": { target: chatTeste, changeOrigin: true },
      "/sounds": { target: chatTeste, changeOrigin: true },
    },
  },
}));

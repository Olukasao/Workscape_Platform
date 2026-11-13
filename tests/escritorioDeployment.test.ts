import { describe, expect, it } from "vitest";
import { escritorioOrigin, urlDoEscritorioValida } from "../electron/escritorioDeployment";

describe("endereço de login único do Escritório", () => {
  it("aceita só /sso da origem do Escritório com o bilhete", () => {
    const ok = `${escritorioOrigin}/sso?ticket=abc.def`;
    expect(urlDoEscritorioValida(ok)).toBe(ok);
  });
  it("recusa outra origem, outro caminho, parâmetros extras, usuário e senha", () => {
    expect(urlDoEscritorioValida("https://exemplo.com/sso?ticket=a.b")).toBeNull();
    expect(urlDoEscritorioValida(`${escritorioOrigin}/api/health`)).toBeNull();
    expect(urlDoEscritorioValida(`${escritorioOrigin}/sso?ticket=a.b&x=1`)).toBeNull();
    expect(urlDoEscritorioValida(escritorioOrigin.replace("http://", "http://u:p@") + "/sso?ticket=a.b")).toBeNull();
    expect(urlDoEscritorioValida("javascript:alert(1)")).toBeNull();
    expect(urlDoEscritorioValida("não é url")).toBeNull();
  });
});

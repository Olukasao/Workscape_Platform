import { useState } from "react";
import { Server, ShieldCheck, Save, Moon, Sun, MonitorCog, Palette, CircleCheck, LoaderCircle, Settings2, ZoomIn, Minus, Plus, PanelLeftClose } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useServers, useSession, usePreferences } from "../stores/workspace";
import { Button } from "../components/ui/button";
import { errorMessage } from "../services/api";
import { FUNDO_PADRAO_POR_USUARIO, ESCOLHA_INICIAL, prepararImagem, resolverFundo } from "../services/fundoUsuario";
import { DESTAQUES, FUNDOS, COR_PADRAO } from "../services/aparencia";
import { PageHeader } from "../components/ui/primitives";
import { useZoomPreference } from "../services/useApplicationZoom";
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "../services/zoom";
import AtalhosConfig from "../components/AtalhosConfig";
import RespostasRapidasConfig from "../components/RespostasRapidasConfig";
import UpdateSettings from "../components/UpdateSettings";
import DiagnosticoConexao from "../components/DiagnosticoConexao";
import { defaultConfig } from "../../electron/policy";
export default function Settings() {
  const { percent, setZoom } = useZoomPreference();
  const { config, save } = useServers(),
    { theme, setTheme, themeAuto, setThemeAuto, accent, setAccent, darkBackground, setDarkBackground, autoHideSidebar, setAutoHideSidebar, assistenteFlutuante, setAssistenteFlutuante } = usePreferences(),
    clear = useSession((s) => s.clear),
    usuario = useSession((s) => s.user),
    { fundoPorUsuario, setFundo } = usePreferences(),
    [erroFundo, setErroFundo] = useState(""),
    query = useQueryClient(),
    navigate = useNavigate();
  const [form, setForm] = useState(config),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await save(form);
      clear();
      query.clear();
      setSaved(true);
      if (window.desktop) await window.desktop.window("reload");
      else navigate("/login");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page narrow-page settings-page">
      <PageHeader
        icon={Settings2}
        title="Configurações"
        description="Conexões corporativas e preferências deste dispositivo."
      />
      <section className="panel settings-section" aria-labelledby="app-zoom-title">
        <div className="section-title">
          <span className="section-icon"><ZoomIn size={17} /></span>
          <div>
            <h2 id="app-zoom-title">Zoom do aplicativo</h2>
            <p>Aproxime ou afaste toda a interface. A preferência é salva automaticamente para seu usuário neste computador.</p>
          </div>
        </div>
        <div className="app-zoom-controls">
          <Button type="button" variant="outline" size="icon" aria-label="Diminuir zoom" disabled={percent <= MIN_ZOOM} onClick={() => setZoom(percent - ZOOM_STEP)}>
            <Minus size={16} />
          </Button>
          <label className="app-zoom-slider">
            <span>Zoom geral <output aria-live="polite">{percent}%</output></span>
            <input type="range" aria-label="Zoom geral" aria-valuetext={`${percent}%`} min={MIN_ZOOM} max={MAX_ZOOM} step={ZOOM_STEP} value={percent} onChange={(e) => setZoom(Number(e.target.value))} />
          </label>
          <Button type="button" variant="outline" size="icon" aria-label="Aumentar zoom" disabled={percent >= MAX_ZOOM} onClick={() => setZoom(percent + ZOOM_STEP)}>
            <Plus size={16} />
          </Button>
          <Button type="button" variant="ghost" onClick={() => setZoom(DEFAULT_ZOOM)}>Restaurar padrão ({DEFAULT_ZOOM}%)</Button>
        </div>
        <p className="muted">Atalhos: Ctrl + para aproximar, Ctrl − para afastar e Ctrl 0 para restaurar.</p>
      </section>
      <section className="panel settings-section" aria-labelledby="sidebar-auto-title">
        <div className="section-title">
          <span className="section-icon"><PanelLeftClose size={17} /></span>
          <div>
            <h2 id="sidebar-auto-title">Barra lateral</h2>
            <p>Recolhe sozinha quando o mouse sai de cima e abre ao encostar o mouse na esquerda da tela. Desligue para controlar manualmente.</p>
          </div>
        </div>
        <label className="settings-check">
          <input type="checkbox" checked={autoHideSidebar} onChange={(e) => setAutoHideSidebar(e.target.checked)} />
          <span>Recolher a barra lateral automaticamente</span>
        </label>
        <p className="muted">Atalho Ctrl \ : com a opção ligada, fixa a barra aberta (ou solta de novo).</p>
      </section>
      <AtalhosConfig />
      <RespostasRapidasConfig />
      <section className="panel settings-section" aria-labelledby="assistente-flut-title">
        <div className="section-title">
          <span className="section-icon"><MonitorCog size={17} /></span>
          <div>
            <h2 id="assistente-flut-title">Inteligência Artificial</h2>
            <p>Mostra um botão no canto da tela para conversar com o Assistente sem sair do que você está fazendo.</p>
          </div>
        </div>
        <label className="settings-check">
          <input type="checkbox" checked={assistenteFlutuante} onChange={(e) => setAssistenteFlutuante(e.target.checked)} />
          <span>Mostrar o botão flutuante do Assistente</span>
        </label>
      </section>
      <UpdateSettings />
      {window.desktop?.testarConexao ? (
        <section className="panel settings-section">
          <div className="section-title">
            <span className="section-icon"><Server size={17} /></span>
            <div>
              <h2>Conexão e VPN</h2>
              <p>Fora do escritório, o app precisa da VPN ligada. Use o teste abaixo para ver qual servidor não responde.</p>
            </div>
          </div>
          <DiagnosticoConexao />
        </section>
      ) : null}
      <form onSubmit={submit}>
        <section className="panel settings-section">
          <div className="section-title">
            <span className="section-icon"><Server size={17} /></span>
            <div>
              <h2>Servidores</h2>
              <p>
                Os endereços corporativos já estão configurados. Altere somente
                se a equipe de TI orientar.
              </p>
            </div>
          </div>
          {(
            [
              ["chat", "Chat Interno", defaultConfig.chat],
              [
                "agenda",
                "Agenda de Técnicos",
                defaultConfig.agenda,
              ],
              [
                "dashboard",
                "Dashboard operacional · Socket.IO",
                defaultConfig.dashboard,
              ],
            ] as const
          ).map(([key, label, placeholder]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                type="url"
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <p className="subtle-note">
            <ShieldCheck size={16} />
            Use HTTPS com certificado confiável. Não inclua /api, senhas ou
            tokens nas URLs.
          </p>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={form.allowInsecureLan}
              onChange={(e) =>
                setForm({ ...form, allowInsecureLan: e.target.checked })
              }
            />
            <span>
              Permitir HTTP para serviços legados da rede interna
              <small>O tráfego HTTP não é criptografado.</small>
            </span>
          </label>
        </section>
        <section className="panel settings-section">
          <div className="section-title">
            <span className="section-icon"><MonitorCog size={17} /></span>
            <div>
              <h2>Recursos desktop</h2>
              <p>Preferências aplicadas pelo aplicativo Electron.</p>
            </div>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={form.closeToTray}
              onChange={(e) =>
                setForm({ ...form, closeToTray: e.target.checked })
              }
            />
            <span>
              Continuar na bandeja ao fechar
              <small>Receba mensagens enquanto houver conexão.</small>
            </span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              disabled={!window.desktop}
              checked={form.launchAtLogin}
              onChange={(e) =>
                setForm({ ...form, launchAtLogin: e.target.checked })
              }
            />
            <span>Iniciar com o Windows</span>
          </label>
        </section>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="inline-success">
            <CircleCheck size={15} />
            Configurações salvas.
          </p>
        )}
        <div className="form-footer">
          <span className="muted">
            A sessão será encerrada ao alterar os servidores.
          </span>
          <Button disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {busy ? "Salvando…" : "Salvar e reconectar"}
          </Button>
        </div>
      </form>
      <section className="panel settings-section">
        <div className="section-title">
          <Moon size={19} />
          <div>
            <h2>Aparência</h2>
            <p>Modo, cor de destaque e fundo do aplicativo. Vale para todas as telas.</p>
          </div>
        </div>
        <div className="aparencia">
          <div className="aparencia-linha">
            <span className="aparencia-rotulo">Modo</span>
            <div className="flex gap-2 flex-wrap">
              <Button variant={themeAuto ? "default" : "outline"} onClick={() => setThemeAuto(true)} title="Acompanha o tema do Windows">
                <MonitorCog size={16} />
                Automático
              </Button>
              <Button variant={!themeAuto && theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>
                <Moon size={16} />
                Escuro
              </Button>
              <Button variant={!themeAuto && theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>
                <Sun size={16} />
                Claro
              </Button>
            </div>
          </div>
          <div className="aparencia-linha">
            <span className="aparencia-rotulo">Cor de destaque</span>
            <div className="aparencia-amostras" role="group" aria-label="Cor de destaque">
              {DESTAQUES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="aparencia-amostra"
                  style={{ background: d.cor }}
                  aria-label={d.nome}
                  aria-pressed={accent.toLowerCase() === d.cor}
                  title={d.nome}
                  onClick={() => setAccent(d.cor)}
                />
              ))}
              <label className="aparencia-personalizada" title="Escolher outra cor">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label="Escolher outra cor de destaque" />
                <span>Outra cor</span>
              </label>
            </div>
          </div>
          <div className="aparencia-linha">
            <span className="aparencia-rotulo">Fundo do modo escuro</span>
            <div className="aparencia-amostras" role="group" aria-label="Fundo do modo escuro">
              {FUNDOS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="aparencia-fundo"
                  aria-pressed={darkBackground === f.id}
                  onClick={() => setDarkBackground(f.id)}
                >
                  <i style={{ background: f.amostra }} aria-hidden="true" />
                  {f.nome}
                </button>
              ))}
            </div>
            {theme === "light" ? <small className="muted">Aparece quando o aplicativo estiver no modo escuro.</small> : null}
          </div>
          <div className="aparencia-linha">
            <span className="aparencia-rotulo">Imagem de fundo</span>
            {usuario ? (() => {
              const chave = String(usuario.id);
              const escolha = fundoPorUsuario[chave] ?? ESCOLHA_INICIAL;
              const atual = resolverFundo(usuario.id, escolha);
              const temPadrao = usuario.id in FUNDO_PADRAO_POR_USUARIO;
              return (
                <>
                  <div className="aparencia-amostras" role="group" aria-label="Imagem de fundo">
                    <div className="aparencia-fundo-previa" style={atual ? { backgroundImage: `url(${JSON.stringify(atual.url)})` } : undefined} aria-hidden="true" />
                    {temPadrao ? (
                      <button type="button" className="aparencia-fundo" aria-pressed={escolha.tipo === "padrao"} onClick={() => setFundo(chave, { ...escolha, tipo: "padrao" })}>Arte da minha conta</button>
                    ) : null}
                    <button type="button" className="aparencia-fundo" aria-pressed={escolha.tipo === "nenhum" || (!temPadrao && escolha.tipo === "padrao")} onClick={() => setFundo(chave, { ...escolha, tipo: "nenhum" })}>Sem imagem</button>
                    <label className="aparencia-fundo" aria-pressed={escolha.tipo === "proprio"} style={{ cursor: "pointer" }}>
                      Escolher imagem…
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={async (e) => {
                          const arquivo = e.target.files?.[0];
                          e.target.value = "";
                          if (!arquivo) return;
                          try {
                            setErroFundo("");
                            setFundo(chave, { ...escolha, tipo: "proprio", imagem: await prepararImagem(arquivo) });
                          } catch (erro) {
                            setErroFundo(errorMessage(erro));
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="aparencia-amostras" role="group" aria-label="Ajuste da imagem">
                    <button type="button" className="aparencia-fundo" aria-pressed={escolha.ajuste === "inteira"} onClick={() => setFundo(chave, { ...escolha, ajuste: "inteira" })} title="Mostra a imagem toda, sem cortar">Imagem inteira</button>
                    <button type="button" className="aparencia-fundo" aria-pressed={escolha.ajuste === "cobrir"} onClick={() => setFundo(chave, { ...escolha, ajuste: "cobrir" })} title="Preenche a tela, cortando as bordas se precisar">Preencher a tela</button>
                  </div>
                  {erroFundo ? <small className="muted" role="alert">{erroFundo}</small> : <small className="muted">Vale só para a sua conta neste computador.</small>}
                </>
              );
            })() : <small className="muted">Entre na sua conta para escolher uma imagem de fundo.</small>}
          </div>
          <div>
            <Button
              variant="ghost"
              size="sm"
              disabled={accent.toLowerCase() === COR_PADRAO && darkBackground === "marinho"}
              onClick={() => { setAccent(COR_PADRAO); setDarkBackground("marinho"); }}
            >
              Restaurar cores padrão
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

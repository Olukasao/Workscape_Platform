// Aviso de nova mensagem. Os dados chegam no hash da URL; a resposta ao
// processo principal também é pelo hash (#open ou #close). Texto sempre via
// textContent: nada da mensagem é interpretado como HTML.
(() => {
  let dados = {};
  try {
    dados = JSON.parse(decodeURIComponent(location.hash.slice(1)) || "{}");
  } catch {
    dados = {};
  }
  const $ = (id) => document.getElementById(id);
  const nome = String(dados.sender || dados.title || "").trim();
  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  $("title").textContent = String(dados.title || "Nova mensagem");
  $("context").textContent = String(dados.context || "");
  $("body").textContent = String(dados.body || "");
  $("avatar").textContent = iniciais || "?";
  // Foto de quem enviou (miniatura já validada); se falhar, ficam as iniciais.
  if (/^data:image\/(jpeg|png|webp);base64,/.test(String(dados.avatar || ""))) {
    const foto = new Image();
    foto.alt = "";
    foto.onload = () => {
      $("avatar").textContent = "";
      $("avatar").classList.add("foto");
      $("avatar").appendChild(foto);
    };
    foto.src = dados.avatar;
  }
  // Incidente de rede: ícone de alerta no lugar das iniciais, cor própria e permanência maior.
  const grande = dados.size === "grande";
  if (grande) $("toast").classList.add("grande");
  const tom = ["crit", "warn", "info"].includes(dados.tone) ? dados.tone : "";
  if (tom) {
    $("toast").classList.add(`tom-${tom}`);
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", grande ? "30" : "22");
    svg.setAttribute("height", grande ? "30" : "22");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    const forma = document.createElementNS(NS, "path");
    forma.setAttribute("d", "M12 3 2 20h20L12 3Zm0 6v5m0 3.5h.01");
    svg.appendChild(forma);
    $("avatar").textContent = "";
    $("avatar").appendChild(svg);
  }
  if (dados.kind === "group") {
    $("avatar").classList.add("grupo");
    document.querySelector(".pulso").classList.add("grupo");
  }
  $("tipo").textContent = dados.kind === "group" ? "Grupo" : dados.kind === "system" ? "Aviso" : "Mensagem";
  const mencao = /^mencionou/i.test(String(dados.context || ""));
  if (mencao) $("toast").classList.add("mencao");
  const quando = new Date(dados.time || Date.now());
  $("time").textContent = quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  document.title = `${$("title").textContent}: ${$("body").textContent}`;

  const DURACAO = Math.min(Math.max(Number(dados.duration) || (grande ? 20000 : tom === "crit" ? 20000 : tom ? 12000 : 7000), 3000), 20000);
  let restante = DURACAO;
  let inicio = Date.now();
  let timer;
  const barra = $("progress");
  const responder = (acao) => {
    clearTimeout(timer);
    $("toast").classList.add("saindo");
    setTimeout(() => (location.hash = acao), acao === "open" ? 0 : 180);
  };
  const animarBarra = () => {
    barra.animate(
      [{ transform: `scaleX(${restante / DURACAO})` }, { transform: "scaleX(0)" }],
      { duration: restante, fill: "forwards" },
    );
  };
  const iniciar = () => {
    inicio = Date.now();
    timer = setTimeout(() => responder("close"), restante);
    animarBarra();
  };
  // Passar o mouse pausa o tempo, para dar tempo de ler.
  $("toast").addEventListener("mouseenter", () => {
    clearTimeout(timer);
    restante = Math.max(800, restante - (Date.now() - inicio));
    barra.getAnimations().forEach((a) => a.pause());
  });
  $("toast").addEventListener("mouseleave", iniciar);
  $("open").addEventListener("click", () => responder("open"));
  $("close").addEventListener("click", (e) => {
    e.stopPropagation();
    responder("close");
  });
  iniciar();

  // Som de chegada gerado na hora (sem arquivo): dois toques curtos, mais agudos se for menção.
  const tocar = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      // Incidente crítico: três toques graves e insistentes; mensagem: dois toques suaves; menção: três agudos.
      const notas = tom === "crit" ? [660, 523.25, 660, 523.25] : tom ? [740, 988] : mencao ? [880, 1174.66, 1568] : [783.99, 1174.66];
      const t0 = ctx.currentTime + 0.02;
      notas.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const ini = t0 + i * 0.13;
        osc.type = tom === "crit" ? "triangle" : "sine";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, ini);
        g.gain.exponentialRampToValueAtTime(tom === "crit" ? 0.32 : 0.22, ini + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, ini + 0.4);
        osc.connect(g).connect(ctx.destination);
        osc.start(ini);
        osc.stop(ini + 0.42);
      });
      setTimeout(() => ctx.close().catch(() => {}), 1200);
    } catch {
      /* sem áudio disponível: segue sem som */
    }
  };
  if (!dados.mudo) tocar();
})();

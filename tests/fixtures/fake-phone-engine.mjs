// Motor falso para testar electron/phone.ts: fala o mesmo protocolo JSON por linhas do motor real.
import { createInterface } from "node:readline";
import { existsSync, writeFileSync, appendFileSync } from "node:fs";

const modo = process.env.FAKE_MODE || "ok";
const trilha = process.env.FAKE_TRACE; // arquivo onde gravamos os comandos recebidos (sem a senha)
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
const rl = createInterface({ input: process.stdin });
let id = 0;
let dnd = false;
let recDir = "";
const confirmadas = new Set();
out({ event: "hello", version: "fake" });
rl.on("line", (linha) => {
  const m = JSON.parse(linha);
  if (trilha) appendFileSync(trilha, JSON.stringify({ ...m, password: m.password ? "<presente>" : undefined }) + "\n");
  switch (m.cmd) {
    case "dnd": if (!process.env.FAKE_LEGACY) { dnd = !!m.on; out({ event: "dnd", on: dnd }); } break; // motor antigo ignora
    case "init": out({ event: "ready", version: "fake", pjsip: "0" }); break;
    case "register":
      if (process.env.FAKE_CRASH_ONCE && !existsSync(process.env.FAKE_CRASH_ONCE)) { writeFileSync(process.env.FAKE_CRASH_ONCE, "1"); process.exit(1); }
      if (modo === "mudo") break;
      if (modo === "auth401") { for (let i = 0; i < 4; i++) out({ event: "reg_state", code: 401, reason: "Unauthorized", active: false, expiresSec: -1 }); break; }
      out({ event: "reg_state", code: 200, reason: "OK", active: true, expiresSec: 60 });
      if (modo === "incoming") setTimeout(() => {
        const remote = '"Ana Souza" <sip:1003@sip.exemplo.com>';
        if (dnd) { out({ event: "incoming_blocked", id: 7, remote }); setTimeout(() => out({ event: "call_ended", id: 7, status: 486, reason: "Busy Here", durationSec: 0 }), 20); }
        else out({ event: "incoming", id: 7, remote, remoteContact: "" });
      }, 50);
      break;
    case "unregister": out({ event: "reg_state", code: 200, reason: "OK", active: false, expiresSec: -1 }); break;
    case "devices": out({ event: "devices", capture: [{ id: 1, name: "Microfone", driver: "WMME" }], playback: [{ id: 2, name: "Fone", driver: "WMME" }] }); break;
    case "call":
      id += 1;
      out({ event: "call_started", id, number: m.number });
      out({ event: "call_state", id, state: "early", status: 180, remote: `sip:${m.number}@sip.exemplo.com` });
      setTimeout(() => { confirmadas.add(id); out({ event: "call_state", id, state: "confirmed", status: 200, remote: `sip:${m.number}@sip.exemplo.com` }); }, 30);
      break;
    case "rec_dir": recDir = m.dir || ""; out({ event: "rec_dir", on: !!recDir }); break;
    case "answer": confirmadas.add(m.id); out({ event: "call_state", id: m.id, state: "confirmed", status: 200, remote: "" }); if (modo === "incoming") setTimeout(() => out({ event: "levels", mic: 300, remoto: 90 }), 30); break;
    case "reject": case "hangup":
      // Como o motor real: com pasta de gravação e conversa atendida, grava dois WAVs e avisa ANTES de "call_ended".
      if (recDir && confirmadas.has(m.id)) {
        const base = `${recDir}/chamada-${m.id}-${Date.now()}`;
        const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(40)]);
        writeFileSync(`${base}-local.wav`, wav); writeFileSync(`${base}-remoto.wav`, wav);
        out({ event: "recording_saved", id: m.id, local: `${base}-local.wav`, remote: `${base}-remoto.wav` });
      }
      out({ event: "call_ended", id: m.id, status: m.cmd === "reject" ? 603 : 200, reason: "x", durationSec: 3 }); break;
    case "quit": out({ event: "bye" }); process.exit(0);
    default: break;
  }
});

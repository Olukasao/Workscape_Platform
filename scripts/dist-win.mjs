import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const args = [require.resolve("electron-builder/cli.js"), "--config", "electron-builder.config.cjs", "--win", "--x64", "--publish", "never"];
const release = process.argv.includes("--release");
const saida = process.env.WORKSPACE_AMBIENTE === "teste" ? "release-teste" : "release";
if (release && process.platform !== "win32") throw new Error("Gere releases assinadas no runner Windows.");
const env = { ...process.env, WORKSPACE_RELEASE: release ? "1" : "0", ELECTRON_BUILDER_COMPRESSION_LEVEL: process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL || "5" };
let tools;
if (process.platform !== "win32") {
  args.push("--config.win.signAndEditExecutable=false");
  tools = await mkdtemp(path.join(tmpdir(), "workspace-nsis-tools-"));
  const bin = path.join(tools, "bin"); await mkdir(bin);
  const helper = path.resolve("scripts/extract-nsis-uninstaller.cjs");
  await writeFile(path.join(bin, "wine"), `#!/usr/bin/env node\nrequire(${JSON.stringify(helper)});\n`, { mode: 0o755 });
  env.USE_SYSTEM_WINE = "true";
  env.WORKSPACE_NSIS_EXTRACT_ROOT = path.resolve(saida);
  env.PATH = bin + path.delimiter + process.env.PATH;
  console.log("Build local: template NSIS padrão e extração pelo leitor oficial do electron-builder. Sem assinatura; releases oficiais usam Windows.");
}
const child = spawn(process.execPath, args, { stdio: "inherit", env });
child.on("exit", async (code) => {
  let result = code ?? 1;
  try {
    if (result === 0) {
      const { version } = JSON.parse(await readFile("package.json", "utf8"));
      await copyFile(`${saida}/AcessaWorkspace-${version}-Setup.exe`, `${saida}/AcessaWorkspace-Setup.exe`);
    }
  } catch (error) { console.error(error.message); result = 1; }
  finally { if (tools) await rm(tools, { recursive: true, force: true }); }
  process.exit(result);
});
child.on("error", async (error) => {
  console.error(error.message);
  if (tools) await rm(tools, { recursive: true, force: true });
  process.exit(1);
});

import { build } from "esbuild";
await build({
  entryPoints: ["electron/main.ts", "electron/preload.ts"],
  outdir: "dist-electron",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  loader: { ".node": "empty" },
  define: { __WORKSPACE_AMBIENTE__: JSON.stringify(process.env.WORKSPACE_AMBIENTE || "") },
});

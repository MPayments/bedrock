import * as esbuild from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/server.mjs",
  external: ["tigerbeetle-node", "tlsclientwrapper"],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

await mkdir("dist", { recursive: true });
await writeFile("dist/types.js", "export {};\n", "utf8");

console.log("api bundled → dist/server.mjs");

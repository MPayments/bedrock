import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  compilePack,
  loadRawPackDefinition,
  readOptionalFlag,
  renderCompiledPack,
} from "./pack-common";

async function main() {
  const { packRef, definition } = await loadRawPackDefinition();
  const compiled = compilePack(definition);
  const output = renderCompiledPack(compiled);
  const outPath = readOptionalFlag("out");

  if (outPath) {
    const absolutePath = resolve(process.cwd(), outPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `${output}\n`, "utf8");
    console.log(
      `Compiled ${packRef} -> ${absolutePath} (${compiled.checksum})`,
    );
    return;
  }

  process.stdout.write(`${output}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

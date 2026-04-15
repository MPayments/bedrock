import {
  backupRouteComposerTables,
  resolveRouteComposerCutoverOutputDir,
} from "./route-composer";

async function main() {
  const outputDir = resolveRouteComposerCutoverOutputDir();
  const manifest = await backupRouteComposerTables(outputDir);

  console.log(
    `[route-composer:backup] Wrote ${Object.keys(manifest.tables).length} table snapshots to ${outputDir}`,
  );
}

try {
  await main();
} catch (error) {
  console.error("[route-composer:backup] Failed.");
  console.error(error);
  process.exitCode = 1;
}

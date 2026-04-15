import {
  assertRouteComposerCutoverInvariants,
  backupRouteComposerTables,
  resolveRouteComposerCutoverOutputDir,
  runRouteComposerEtl,
} from "./route-composer";

async function main() {
  const outputDir = resolveRouteComposerCutoverOutputDir();
  const manifest = await backupRouteComposerTables(outputDir);
  const etl = await runRouteComposerEtl();
  const checks = await assertRouteComposerCutoverInvariants();

  console.log(
    [
      `[route-composer:cutover] Backup complete: ${Object.keys(manifest.tables).length} tables -> ${outputDir}`,
      `[route-composer:cutover] ETL complete: deleted ${etl.deletedLegacyGeneratedApplicationAssets} legacy generated application assets, ${etl.deletedLegacyGeneratedApplicationFileLinks} file links, ${etl.deletedLegacyGeneratedApplicationVersions} versions.`,
      `[route-composer:cutover] Invariants complete: ${checks.requiredTables.length} required tables present, no legacy application tables, no deal_application files.`,
    ].join("\n"),
  );
}

try {
  await main();
} catch (error) {
  console.error("[route-composer:cutover] Failed.");
  console.error(error);
  process.exitCode = 1;
}

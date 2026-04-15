import { runRouteComposerEtl } from "./route-composer";

async function main() {
  const result = await runRouteComposerEtl();

  console.log(
    [
      `[route-composer:etl] Deleted ${result.deletedLegacyGeneratedApplicationAssets} legacy generated application assets, ${result.deletedLegacyGeneratedApplicationFileLinks} file links, ${result.deletedLegacyGeneratedApplicationVersions} versions.`,
      `[route-composer:etl] Legacy commercial tables detected: ${result.legacyCommercialTables.length > 0 ? result.legacyCommercialTables.join(", ") : "none"}`,
    ].join("\n"),
  );
}

try {
  await main();
} catch (error) {
  console.error("[route-composer:etl] Failed.");
  console.error(error);
  process.exitCode = 1;
}

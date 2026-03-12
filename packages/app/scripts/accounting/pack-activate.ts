import {
  compilePack,
  createPackRuntime,
  loadRawPackDefinition,
  readOptionalFlag,
  readRequiredFlag,
} from "./pack-common";

async function main() {
  const scopeId = readRequiredFlag("scope-id");
  const scopeType = readOptionalFlag("scope-type") ?? "book";
  const effectiveAtValue = readOptionalFlag("effective-at");
  const effectiveAt = effectiveAtValue ? new Date(effectiveAtValue) : undefined;

  if (effectiveAt && Number.isNaN(effectiveAt.getTime())) {
    throw new Error(`Invalid --effective-at value: ${effectiveAtValue}`);
  }

  const { packRef, definition } = await loadRawPackDefinition();
  const runtime = createPackRuntime(definition);
  const compiled = compilePack(definition);
  await runtime.storeCompiledPackVersion({ pack: compiled });
  const assignment = await runtime.activatePackForScope({
    scopeId,
    scopeType,
    packChecksum: compiled.checksum,
    effectiveAt,
  });

  console.log(
    `Activated ${packRef} (${compiled.checksum}) for ${assignment.scopeType}:${assignment.scopeId} at ${assignment.effectiveAt.toISOString()}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

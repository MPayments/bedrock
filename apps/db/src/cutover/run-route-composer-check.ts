import { assertRouteComposerCutoverInvariants } from "./route-composer";

async function main() {
  const result = await assertRouteComposerCutoverInvariants();

  console.log(
    `[route-composer:check] OK at ${result.checkedAt}. Required tables: ${result.requiredTables.join(", ")}`,
  );
}

try {
  await main();
} catch (error) {
  console.error("[route-composer:check] Failed.");
  console.error(error);
  process.exitCode = 1;
}

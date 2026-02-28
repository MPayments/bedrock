import { validatePackDefinition } from "../src/index";

import { loadRawPackDefinition } from "./pack-common";

async function main() {
  const { packRef, definition } = await loadRawPackDefinition();
  const result = validatePackDefinition(definition);

  if (!result.ok) {
    console.error(`Pack validation failed for ${packRef}:`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Pack validation passed for ${packRef} (${definition.packKey}@${definition.version})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { loadRawPackDefinition } from "./pack-common";
import {
  DEFAULT_CHART_TEMPLATE_ACCOUNTS,
  DEFAULT_GLOBAL_CORRESPONDENCE_RULES,
} from "../src/constants";
import { validatePackDefinition } from "../src/packs/application";

async function main() {
  const { packRef, definition } = await loadRawPackDefinition();
  const result = validatePackDefinition(definition, {
    knownAccountNos: DEFAULT_CHART_TEMPLATE_ACCOUNTS.map(
      (account) => account.accountNo,
    ),
    knownPostingCodes: DEFAULT_GLOBAL_CORRESPONDENCE_RULES.map(
      (rule) => rule.postingCode,
    ),
  });

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

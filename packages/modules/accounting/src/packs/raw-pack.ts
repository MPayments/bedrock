import { readFileSync } from "node:fs";

import { AccountingPackDefinitionSchema } from "./schema";

export const rawPackDefinition = AccountingPackDefinitionSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../assets/default-pack.json", import.meta.url),
      "utf8",
    ),
  ) as unknown,
);

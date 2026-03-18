import { AccountingPackDefinitionSchema } from "./schema";
import defaultPackRaw from "../assets/default-pack.json" with { type: "json" };

export const rawPackDefinition = AccountingPackDefinitionSchema.parse(
  defaultPackRaw as unknown,
);

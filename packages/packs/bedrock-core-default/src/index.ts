import {
  DEFAULT_ACCOUNTING_PACK_DEFINITION,
  type AccountingPackDefinition,
} from "@bedrock/accounting";
import { AccountingPackDefinitionSchema } from "@bedrock/packs-schema";

export const PACK_PACKAGE_NAME = "@bedrock/pack-bedrock-core-default";

export const rawPackDefinition = AccountingPackDefinitionSchema.parse(
  DEFAULT_ACCOUNTING_PACK_DEFINITION,
) as AccountingPackDefinition;

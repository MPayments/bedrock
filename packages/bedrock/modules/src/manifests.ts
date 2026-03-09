import { ACCOUNTING_MODULE_MANIFEST } from "@bedrock/accounting/manifest";
import { CURRENCIES_MODULE_MANIFEST } from "@bedrock/assets/manifest";
import { BALANCES_MODULE_MANIFEST } from "@bedrock/balances/manifest";
import { DOCUMENTS_MODULE_MANIFEST } from "@bedrock/documents/manifest";
import { LEDGER_MODULE_MANIFEST } from "@bedrock/ledger/manifest";
import { IDEMPOTENCY_MODULE_MANIFEST } from "@bedrock/operations/manifest";
import { RECONCILIATION_MODULE_MANIFEST } from "@bedrock/reconciliation/manifest";

import { SYSTEM_MODULES_MANIFEST } from "./system-modules.manifest";
import type { ModuleManifest } from "./types";

export const DORMANT_MODULE_IDS = ["reconciliation"] as const;
export type DormantModuleId = (typeof DORMANT_MODULE_IDS)[number];

export const BEDROCK_CORE_MODULE_MANIFESTS = [
  SYSTEM_MODULES_MANIFEST,
  IDEMPOTENCY_MODULE_MANIFEST,
  LEDGER_MODULE_MANIFEST,
  ACCOUNTING_MODULE_MANIFEST,
  DOCUMENTS_MODULE_MANIFEST,
  CURRENCIES_MODULE_MANIFEST,
  BALANCES_MODULE_MANIFEST,
  RECONCILIATION_MODULE_MANIFEST,
] as const satisfies readonly ModuleManifest[];

export type BedrockCoreModuleId =
  (typeof BEDROCK_CORE_MODULE_MANIFESTS)[number]["id"];

import { SYSTEM_MODULES_MANIFEST } from "./system-modules.manifest";
import type { ModuleManifest } from "./types";
import { ACCOUNTING_MODULE_MANIFEST } from "../accounting/manifest";
import { BALANCES_MODULE_MANIFEST } from "../balances/manifest";
import { COUNTERPARTIES_MODULE_MANIFESTS } from "../counterparties/manifest";
import { COUNTERPARTY_ACCOUNTS_MODULE_MANIFESTS } from "../counterparty-accounts/manifest";
import { CURRENCIES_MODULE_MANIFEST } from "../currencies/manifest";
import { CUSTOMERS_MODULE_MANIFEST } from "../customers/manifest";
import { DOCUMENTS_MODULE_MANIFEST } from "../documents/manifest";
import { IDEMPOTENCY_MODULE_MANIFEST } from "../idempotency/manifest";
import { LEDGER_MODULE_MANIFEST } from "../ledger/manifest";

export const DORMANT_MODULE_IDS = ["reconciliation"] as const;
export type DormantModuleId = (typeof DORMANT_MODULE_IDS)[number];

export const BEDROCK_CORE_MODULE_MANIFESTS = [
  SYSTEM_MODULES_MANIFEST,
  IDEMPOTENCY_MODULE_MANIFEST,
  LEDGER_MODULE_MANIFEST,
  ACCOUNTING_MODULE_MANIFEST,
  DOCUMENTS_MODULE_MANIFEST,
  ...COUNTERPARTY_ACCOUNTS_MODULE_MANIFESTS,
  ...COUNTERPARTIES_MODULE_MANIFESTS,
  CUSTOMERS_MODULE_MANIFEST,
  CURRENCIES_MODULE_MANIFEST,
  BALANCES_MODULE_MANIFEST,
] as const satisfies ModuleManifest[];

export type BedrockCoreModuleId =
  (typeof BEDROCK_CORE_MODULE_MANIFESTS)[number]["id"];

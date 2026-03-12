import { SYSTEM_MODULES_MANIFEST } from "./system-modules.manifest";
import type { ModuleManifest } from "./types";
import { ACCOUNTING_MODULE_MANIFEST } from "../accounting/manifest";
import { BALANCES_MODULE_MANIFEST } from "../balances/manifest";
import { COUNTERPARTIES_MODULE_MANIFESTS } from "../counterparties/manifest";
import { CURRENCIES_MODULE_MANIFEST } from "../currencies/manifest";
import { CUSTOMERS_MODULE_MANIFEST } from "../customers/manifest";
import { DOCUMENTS_MODULE_MANIFEST } from "../documents/manifest";
import { FEES_MODULE_MANIFEST } from "../fees/manifest";
import { FX_MODULE_MANIFESTS } from "../fx/manifest";
import { IDEMPOTENCY_MODULE_MANIFEST } from "../idempotency/manifest";
import { IFRS_DOCUMENTS_MODULE_MANIFEST } from "../ifrs-documents/manifest";
import { LEDGER_MODULE_MANIFEST } from "../ledger/manifest";
import { ORGANIZATIONS_MODULE_MANIFEST } from "../organizations/manifest";
import { PAYMENTS_MODULE_MANIFEST } from "../payments/manifest";
import { REQUISITE_PROVIDERS_MODULE_MANIFEST } from "../requisite-providers/manifest";
import { REQUISITES_MODULE_MANIFEST } from "../requisites/manifest";

export const DORMANT_MODULE_IDS = ["reconciliation"] as const;
export type DormantModuleId = (typeof DORMANT_MODULE_IDS)[number];

export const BEDROCK_MODULE_MANIFESTS = [
  SYSTEM_MODULES_MANIFEST,
  IDEMPOTENCY_MODULE_MANIFEST,
  LEDGER_MODULE_MANIFEST,
  ACCOUNTING_MODULE_MANIFEST,
  DOCUMENTS_MODULE_MANIFEST,
  ...COUNTERPARTIES_MODULE_MANIFESTS,
  CUSTOMERS_MODULE_MANIFEST,
  CURRENCIES_MODULE_MANIFEST,
  ORGANIZATIONS_MODULE_MANIFEST,
  REQUISITE_PROVIDERS_MODULE_MANIFEST,
  REQUISITES_MODULE_MANIFEST,
  BALANCES_MODULE_MANIFEST,
  FEES_MODULE_MANIFEST,
  ...FX_MODULE_MANIFESTS,
  IFRS_DOCUMENTS_MODULE_MANIFEST,
  PAYMENTS_MODULE_MANIFEST,
] as const satisfies ModuleManifest[];

export type BedrockModuleId =
  (typeof BEDROCK_MODULE_MANIFESTS)[number]["id"];

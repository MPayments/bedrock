import {
  BEDROCK_CORE_MODULE_MANIFESTS,
  type ModuleManifest,
} from "@bedrock/core/module-runtime";

import { FEES_MODULE_MANIFEST } from "../fees/manifest";
import { FX_MODULE_MANIFESTS } from "../fx/manifest";
import { IFRS_DOCUMENTS_MODULE_MANIFEST } from "../ifrs-documents/manifest";
import { PAYMENTS_MODULE_MANIFEST } from "../payments/manifest";

export const BEDROCK_APPLICATION_MODULE_MANIFESTS = [
  FEES_MODULE_MANIFEST,
  ...FX_MODULE_MANIFESTS,
  IFRS_DOCUMENTS_MODULE_MANIFEST,
  PAYMENTS_MODULE_MANIFEST,
] as const satisfies ModuleManifest[];

export const BEDROCK_MODULE_MANIFESTS = [
  ...BEDROCK_CORE_MODULE_MANIFESTS,
  ...BEDROCK_APPLICATION_MODULE_MANIFESTS,
] as const satisfies ModuleManifest[];

export type BedrockApplicationModuleId =
  (typeof BEDROCK_APPLICATION_MODULE_MANIFESTS)[number]["id"];
export type BedrockModuleId =
  (typeof BEDROCK_MODULE_MANIFESTS)[number]["id"];

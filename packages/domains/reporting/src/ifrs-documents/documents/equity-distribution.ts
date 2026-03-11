import type { DocumentModule } from "@multihansa/documents/runtime";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  EquityDistributionInputSchema,
  EquityDistributionSchema,
  type EquityDistribution,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createEquityDistributionDocumentModule(): DocumentModule<
  EquityDistribution,
  EquityDistribution
> {
  return createSimpleIfrsDocumentModule({
    docType: "equity_distribution",
    docNoPrefix: IFRS_DOCUMENT_METADATA.equity_distribution.docNoPrefix,
    title: "Распределение капитала",
    createSchema: EquityDistributionInputSchema,
    updateSchema: EquityDistributionInputSchema,
    payloadSchema: EquityDistributionSchema,
  });
}

import type { DocumentModule } from "@bedrock/documents/runtime";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  EquityContributionInputSchema,
  EquityContributionSchema,
  type EquityContribution,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createEquityContributionDocumentModule(): DocumentModule<
  EquityContribution,
  EquityContribution
> {
  return createSimpleIfrsDocumentModule({
    docType: "equity_contribution",
    docNoPrefix: IFRS_DOCUMENT_METADATA.equity_contribution.docNoPrefix,
    title: "Вклад в капитал",
    createSchema: EquityContributionInputSchema,
    updateSchema: EquityContributionInputSchema,
    payloadSchema: EquityContributionSchema,
  });
}

import type { DocumentModule } from "@bedrock/core/documents";

import { IFRS_DOCUMENT_METADATA } from "../metadata";
import {
  IntercompanyInterestSettlementInputSchema,
  IntercompanyInterestSettlementSchema,
  type IntercompanyInterestSettlement,
} from "../validation";
import { createSimpleIfrsDocumentModule } from "./internal/simple-module";

export function createIntercompanyInterestSettlementDocumentModule(): DocumentModule<
  IntercompanyInterestSettlement,
  IntercompanyInterestSettlement
> {
  return createSimpleIfrsDocumentModule({
    docType: "intercompany_interest_settlement",
    docNoPrefix: IFRS_DOCUMENT_METADATA.intercompany_interest_settlement.docNoPrefix,
    title: "Расчет по межкорпоративным процентам",
    createSchema: IntercompanyInterestSettlementInputSchema,
    updateSchema: IntercompanyInterestSettlementInputSchema,
    payloadSchema: IntercompanyInterestSettlementSchema,
  });
}

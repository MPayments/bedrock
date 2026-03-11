import {
  createDocumentRegistry,
  type DocumentRegistry,
} from "@multihansa/documents/runtime";
import {
  type RequisitesService,
} from "@multihansa/parties/requisites";
import { createIfrsDocumentModules } from "@multihansa/reporting/ifrs-documents";
import {
  createPaymentIntentDocumentModule,
  createPaymentResolutionDocumentModule,
} from "@multihansa/treasury/payments";

export function createMultihansaDocumentRegistry(input: {
  requisitesService: RequisitesService;
}): DocumentRegistry {
  return createDocumentRegistry([
    ...createIfrsDocumentModules({
      requisitesService: input.requisitesService,
    }),
    createPaymentIntentDocumentModule({
      requisitesService: input.requisitesService,
    }),
    createPaymentResolutionDocumentModule({
      requisitesService: input.requisitesService,
    }),
  ]);
}

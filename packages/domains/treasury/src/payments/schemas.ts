import { createPaginatedListSchema } from "@multihansa/common/pagination";
import { z } from "zod";

import { DocumentSchema } from "@multihansa/documents";

export const PaymentListResponseSchema = createPaginatedListSchema(DocumentSchema);

export const PaymentDetailsSchema = z.object({
  document: DocumentSchema,
  details: z.unknown(),
  connectorIntent: z.null(),
  attempts: z.array(z.unknown()),
  events: z.array(z.unknown()),
});

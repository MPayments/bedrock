import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import { DealTypeSchema } from "./zod";

const nullableText = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

export const CreateDealInputSchema = z.object({
  customerId: z.uuid(),
  agreementId: z.uuid(),
  calculationId: z.uuid(),
  type: DealTypeSchema,
  counterpartyId: z.uuid().optional(),
  comment: nullableText,
});

export type CreateDealInput = z.infer<typeof CreateDealInputSchema>;

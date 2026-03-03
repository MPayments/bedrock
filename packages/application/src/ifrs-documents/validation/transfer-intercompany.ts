import type { z } from "zod";

import {
  TransferIntraInputSchema,
  TransferIntraPayloadSchema,
} from "./transfer-intra";

export const TransferIntercompanyInputSchema = TransferIntraInputSchema;
export const TransferIntercompanyPayloadSchema = TransferIntraPayloadSchema;

export type TransferIntercompanyInput = z.infer<
  typeof TransferIntercompanyInputSchema
>;
export type TransferIntercompanyPayload = z.infer<
  typeof TransferIntercompanyPayloadSchema
>;

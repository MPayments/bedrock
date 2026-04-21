import { z } from "zod";

import {
  PaymentRouteDraftSchema,
  PaymentRouteVisualMetadataSchema,
} from "./zod";

export const CreatePaymentRouteTemplateInputSchema = z.object({
  draft: PaymentRouteDraftSchema,
  maxMarginBps: z.number().int().nonnegative().nullable().default(null),
  minMarginBps: z.number().int().nonnegative().nullable().default(null),
  name: z.string().trim().min(1),
  visual: PaymentRouteVisualMetadataSchema.default({
    nodePositions: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  }),
});

export const UpdatePaymentRouteTemplateInputSchema =
  CreatePaymentRouteTemplateInputSchema.partial()
    .extend({
      draft: PaymentRouteDraftSchema.optional(),
      maxMarginBps: z.number().int().nonnegative().nullable().optional(),
      minMarginBps: z.number().int().nonnegative().nullable().optional(),
      name: z.string().trim().min(1).optional(),
      visual: PaymentRouteVisualMetadataSchema.optional(),
    })
    .refine(
      (value) =>
        value.name !== undefined ||
        value.draft !== undefined ||
        value.visual !== undefined ||
        value.minMarginBps !== undefined ||
        value.maxMarginBps !== undefined,
      "At least one field must be provided",
    );

export type CreatePaymentRouteTemplateInput = z.infer<
  typeof CreatePaymentRouteTemplateInputSchema
>;
export type UpdatePaymentRouteTemplateInput = z.infer<
  typeof UpdatePaymentRouteTemplateInputSchema
>;

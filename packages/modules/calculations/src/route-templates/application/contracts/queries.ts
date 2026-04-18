import { z } from "zod";

import {
  ListPaymentRouteTemplatesQuerySchema,
  PAYMENT_ROUTE_TEMPLATES_LIST_CONTRACT,
  PaymentRouteDraftSchema,
} from "./zod";

export const PreviewPaymentRouteInputSchema = z.object({
  draft: PaymentRouteDraftSchema,
});

export { PAYMENT_ROUTE_TEMPLATES_LIST_CONTRACT };
export { ListPaymentRouteTemplatesQuerySchema };
export type PreviewPaymentRouteInput = z.infer<
  typeof PreviewPaymentRouteInputSchema
>;
export type ListPaymentRouteTemplatesQuery = z.infer<
  typeof ListPaymentRouteTemplatesQuerySchema
>;

import { z } from "zod";

import type { CustomerSnapshot } from "../../domain/customer";

export const CustomerSchema = z.object({
  id: z.uuid(),
  externalRef: z.string().nullable(),
  displayName: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Customer = CustomerSnapshot;

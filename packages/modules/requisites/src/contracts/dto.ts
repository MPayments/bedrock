import { z } from "zod";

import { RequisiteKindSchema } from "./zod";

export const RequisiteProviderSchema = z.object({
  id: z.uuid(),
  kind: RequisiteKindSchema,
  name: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  address: z.string().nullable(),
  contact: z.string().nullable(),
  bic: z.string().nullable(),
  swift: z.string().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RequisiteProvider = z.infer<typeof RequisiteProviderSchema>;

export const RequisiteProviderOptionSchema = z.object({
  id: z.uuid(),
  kind: RequisiteKindSchema,
  name: z.string(),
  label: z.string(),
});

export const RequisiteProviderOptionsResponseSchema = z.object({
  data: z.array(RequisiteProviderOptionSchema),
});

export type RequisiteProviderOption = z.infer<
  typeof RequisiteProviderOptionSchema
>;

import { z } from "zod";

export const CrmActivityEntityTypeSchema = z.enum([
  "customer",
  "agreement",
  "deal",
  "calculation",
  "document",
  "task",
]);

export type CrmActivityEntityType = z.infer<typeof CrmActivityEntityTypeSchema>;

export const CrmActivityItemSchema = z.object({
  id: z.string(),
  action: z.string(),
  entityType: CrmActivityEntityTypeSchema,
  entityId: z.string().nullable(),
  entityTitle: z.string().nullable(),
  source: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
});

export type CrmActivityItem = z.infer<typeof CrmActivityItemSchema>;

export const CrmActivityResponseSchema = z.object({
  data: z.array(CrmActivityItemSchema),
  unavailable: z.boolean(),
});

export type CrmActivityResponse = z.infer<typeof CrmActivityResponseSchema>;

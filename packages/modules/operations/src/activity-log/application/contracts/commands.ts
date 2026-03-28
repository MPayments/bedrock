import { z } from "zod";

export const ACTIVITY_ACTION_VALUES = [
  "create",
  "update",
  "delete",
  "status_change",
  "comment",
  "upload_document",
] as const;

export const ACTIVITY_ENTITY_VALUES = [
  "application",
  "deal",
  "client",
  "calculation",
  "contract",
  "todo",
  "document",
] as const;

export const ACTIVITY_SOURCE_VALUES = ["web", "bot"] as const;

export type ActivityAction = (typeof ACTIVITY_ACTION_VALUES)[number];
export type ActivityEntity = (typeof ACTIVITY_ENTITY_VALUES)[number];
export type ActivitySource = (typeof ACTIVITY_SOURCE_VALUES)[number];

export const LogActivityInputSchema = z.object({
  userId: z.string(),
  action: z.enum(ACTIVITY_ACTION_VALUES),
  entityType: z.enum(ACTIVITY_ENTITY_VALUES),
  entityId: z.number().int(),
  entityTitle: z.string().optional(),
  source: z.enum(ACTIVITY_SOURCE_VALUES).default("web"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type LogActivityInput = z.infer<typeof LogActivityInputSchema>;

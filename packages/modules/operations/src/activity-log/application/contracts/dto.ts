import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import {
  ACTIVITY_ACTION_VALUES,
  ACTIVITY_ENTITY_VALUES,
  ACTIVITY_SOURCE_VALUES,
} from "./commands";

export const ActivityLogEntrySchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  action: z.enum(ACTIVITY_ACTION_VALUES),
  entityType: z.enum(ACTIVITY_ENTITY_VALUES),
  entityId: z.number().int(),
  entityTitle: z.string().nullable(),
  source: z.enum(ACTIVITY_SOURCE_VALUES),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  userName: z.string().nullable(),
});

export type ActivityLogEntry = z.infer<typeof ActivityLogEntrySchema>;

export const PaginatedActivityLogSchema =
  createPaginatedListSchema(ActivityLogEntrySchema);

export type PaginatedActivityLog = z.infer<typeof PaginatedActivityLogSchema>;

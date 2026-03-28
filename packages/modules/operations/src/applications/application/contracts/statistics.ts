import { z } from "zod";

// --- Statistics ---

export const ApplicationsStatisticsQuerySchema = z.object({
  agentId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type ApplicationsStatisticsQuery = z.infer<
  typeof ApplicationsStatisticsQuerySchema
>;

export const ApplicationsStatisticsSchema = z.object({
  totalCount: z.number(),
  byStatus: z.record(z.string(), z.number()),
  totalAmountInBase: z.number(),
});

export type ApplicationsStatistics = z.infer<
  typeof ApplicationsStatisticsSchema
>;

// --- By Day ---

export const ApplicationsByDayQuerySchema = z.object({
  agentId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type ApplicationsByDayQuery = z.infer<
  typeof ApplicationsByDayQuerySchema
>;

export const ApplicationsByDayEntrySchema = z.object({
  date: z.string(),
  count: z.number(),
  byStatus: z.record(z.string(), z.number()),
});

export const ApplicationsByDaySchema = z.object({
  data: z.array(ApplicationsByDayEntrySchema),
});

export type ApplicationsByDay = z.infer<typeof ApplicationsByDaySchema>;
export type ApplicationsByDayEntry = z.infer<
  typeof ApplicationsByDayEntrySchema
>;

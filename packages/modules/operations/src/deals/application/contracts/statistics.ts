import { z } from "zod";

// --- Statistics ---

export const DealsStatisticsQuerySchema = z.object({
  agentId: z.coerce.number().int().optional(),
  clientId: z.coerce.number().int().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type DealsStatisticsQuery = z.infer<typeof DealsStatisticsQuerySchema>;

export const DealsStatisticsSchema = z.object({
  totalCount: z.number(),
  byStatus: z.record(z.string(), z.number()),
  totalAmount: z.string(),
});

export type DealsStatistics = z.infer<typeof DealsStatisticsSchema>;

// --- By Day ---

export const DealsByDayQuerySchema = z.object({
  agentId: z.coerce.number().int().optional(),
  clientId: z.coerce.number().int().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type DealsByDayQuery = z.infer<typeof DealsByDayQuerySchema>;

export const DealsByDayEntrySchema = z.object({
  date: z.string(),
  count: z.number(),
  byStatus: z.record(z.string(), z.number()),
});

export const DealsByDaySchema = z.object({
  data: z.array(DealsByDayEntrySchema),
});

export type DealsByDay = z.infer<typeof DealsByDaySchema>;
export type DealsByDayEntry = z.infer<typeof DealsByDayEntrySchema>;

// --- By Status ---

export const DealsByStatusEntrySchema = z.object({
  status: z.string(),
  count: z.number(),
});

export const DealsByStatusSchema = z.object({
  data: z.array(DealsByStatusEntrySchema),
});

export type DealsByStatus = z.infer<typeof DealsByStatusSchema>;
export type DealsByStatusEntry = z.infer<typeof DealsByStatusEntrySchema>;

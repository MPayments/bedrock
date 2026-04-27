import { z } from "zod";

import { PaginationInputSchema } from "@bedrock/shared/core/pagination";

export const ReportUuidSchema = z.uuid({ version: "v4" });
export const ReportDateTimeSchema = z.iso.datetime();
const ReportFinancialStatusSchema = z.enum(["pending", "posted", "failed"]);

function toArray(value: unknown): unknown[] | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues.flatMap((item) => {
    if (typeof item !== "string") {
      return [item];
    }

    return item
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  });
}

const ReportUuidArrayQuerySchema = z.preprocess(
  toArray,
  z.array(ReportUuidSchema).optional(),
);

const ReportStatusArrayQuerySchema = z
  .preprocess(toArray, z.array(ReportFinancialStatusSchema).optional())
  .transform((value) => (value && value.length > 0 ? value : ["posted"]));

const ReportScopeTypeSchema = z
  .enum(["all", "counterparty", "group", "book"])
  .default("all");

const ReportAttributionModeSchema = z
  .enum(["analytic_counterparty", "book_org"])
  .default("analytic_counterparty");

export const ReportScopeQuerySchema = z
  .object({
    scopeType: ReportScopeTypeSchema,
    counterpartyId: ReportUuidArrayQuerySchema.optional().default([]),
    groupId: ReportUuidArrayQuerySchema.optional().default([]),
    bookId: ReportUuidArrayQuerySchema.optional().default([]),
    includeDescendants: z.coerce.boolean().default(true),
    attributionMode: ReportAttributionModeSchema,
    includeUnattributed: z.coerce.boolean().default(false),
    currency: z.string().trim().min(1).max(16).optional(),
    status: ReportStatusArrayQuerySchema,
  })
  .superRefine((value, ctx) => {
    if (value.scopeType === "counterparty" && value.counterpartyId.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["counterpartyId"],
        message: "counterpartyId[] is required for scopeType=counterparty",
      });
    }

    if (value.scopeType === "group" && value.groupId.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["groupId"],
        message: "groupId[] is required for scopeType=group",
      });
    }

    if (value.scopeType === "book" && value.bookId.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["bookId"],
        message: "bookId[] is required for scopeType=book",
      });
    }
  });

export const ReportPeriodRangeQuerySchema = z
  .object({
    from: ReportDateTimeSchema,
    to: ReportDateTimeSchema,
  })
  .superRefine((value, ctx) => {
    if (new Date(value.from) > new Date(value.to)) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "from must be earlier than or equal to to",
      });
    }
  });

export const ReportAsOfQuerySchema = z.object({
  asOf: ReportDateTimeSchema,
});

export const ReportPaginationQuerySchema = PaginationInputSchema.pick({
  limit: true,
  offset: true,
});

export const ReportScopeMetaSchema = z.object({
  scopeType: z.enum(["all", "counterparty", "group", "book"]),
  requestedCounterpartyIds: z.array(z.uuid()),
  requestedGroupIds: z.array(z.uuid()),
  requestedBookIds: z.array(z.uuid()),
  resolvedCounterpartyIdsCount: z.number().int().nonnegative(),
  attributionMode: z.enum(["analytic_counterparty", "book_org"]),
  hasUnattributedData: z.boolean(),
});

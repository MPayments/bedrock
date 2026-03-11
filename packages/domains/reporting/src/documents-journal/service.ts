import { defineService, error } from "@bedrock/core";
import { ListLedgerOperationsQuerySchema } from "@multihansa/ledger";
import {
  NotFoundDomainError,
} from "@multihansa/common/bedrock";
import { mapOperationDetailsDto } from "@multihansa/accounting";
import {
  OperationDetailsSchema,
  OperationSummarySchema,
  OperationsListResponseSchema,
} from "@multihansa/documents";
import { z } from "zod";

import { AccountingReportingDomainServiceToken } from "../tokens";

const JournalOperationParamsSchema = z.object({
  operationId: z.uuid(),
});

export const documentsJournalService = defineService("documents-journal", {
  deps: {
    reporting: AccountingReportingDomainServiceToken,
  },
  ctx: ({ reporting }) => ({
    reporting,
  }),
  actions: ({ action }) => ({
    journal: action({
      input: ListLedgerOperationsQuerySchema,
      output: OperationsListResponseSchema,
      handler: async ({ ctx, input }) => {
        const result = await ctx.reporting.listOperationsWithLabels(input);
        return {
          ...result,
          data: result.data.map((row) =>
            OperationSummarySchema.parse({
              ...row,
              postingDate: row.postingDate.toISOString(),
              postedAt: row.postedAt?.toISOString() ?? null,
              lastOutboxErrorAt: row.lastOutboxErrorAt?.toISOString() ?? null,
              createdAt: row.createdAt.toISOString(),
            }),
          ),
        };
      },
    }),
    getJournalOperation: action({
      input: JournalOperationParamsSchema,
      output: OperationDetailsSchema,
      errors: [NotFoundDomainError],
      handler: async ({ ctx, input }) => {
        const details = await ctx.reporting.getOperationDetailsWithLabels(
          input.operationId,
        );

        if (!details) {
          return error(NotFoundDomainError, {
            message: `Operation not found: ${input.operationId}`,
          });
        }

        return mapOperationDetailsDto(details);
      },
    }),
  }),
});

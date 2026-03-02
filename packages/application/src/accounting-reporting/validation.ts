import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/kernel/pagination";

const uuidSchema = z.uuid({ version: "v4" });

const FINANCIAL_RESULTS_COUNTERPARTY_SORTABLE_COLUMNS = [
  "entityName",
  "currency",
  "revenueMinor",
  "expenseMinor",
  "netMinor",
] as const;

const FINANCIAL_RESULTS_GROUP_SORTABLE_COLUMNS = [
  "groupName",
  "currency",
  "revenueMinor",
  "expenseMinor",
  "netMinor",
] as const;

interface FinancialResultsByCounterpartyFilters {
  attributionMode: {
    kind: "string";
    cardinality: "single";
    enumValues: readonly ["book_org", "analytic_counterparty"];
  };
  status: {
    kind: "string";
    cardinality: "multi";
    enumValues: readonly ["pending", "posted", "failed"];
  };
  from: { kind: "string"; cardinality: "single" };
  to: { kind: "string"; cardinality: "single" };
  currency: { kind: "string"; cardinality: "single" };
  counterpartyId: { kind: "string"; cardinality: "single" };
  groupId: { kind: "string"; cardinality: "single" };
  includeDescendants: { kind: "boolean"; cardinality: "single" };
}

interface FinancialResultsByGroupFilters {
  attributionMode: {
    kind: "string";
    cardinality: "single";
    enumValues: readonly ["book_org", "analytic_counterparty"];
  };
  status: {
    kind: "string";
    cardinality: "multi";
    enumValues: readonly ["pending", "posted", "failed"];
  };
  from: { kind: "string"; cardinality: "single" };
  to: { kind: "string"; cardinality: "single" };
  currency: { kind: "string"; cardinality: "single" };
  groupId: { kind: "string"; cardinality: "multi" };
  includeDescendants: { kind: "boolean"; cardinality: "single" };
}

export const FINANCIAL_RESULTS_COUNTERPARTY_LIST_CONTRACT: ListQueryContract<
  typeof FINANCIAL_RESULTS_COUNTERPARTY_SORTABLE_COLUMNS,
  FinancialResultsByCounterpartyFilters
> = {
  sortableColumns: FINANCIAL_RESULTS_COUNTERPARTY_SORTABLE_COLUMNS,
  defaultSort: { id: "netMinor", desc: true },
  filters: {
    attributionMode: {
      kind: "string",
      cardinality: "single",
      enumValues: ["book_org", "analytic_counterparty"],
    },
    status: {
      kind: "string",
      cardinality: "multi",
      enumValues: ["pending", "posted", "failed"],
    },
    from: {
      kind: "string",
      cardinality: "single",
    },
    to: {
      kind: "string",
      cardinality: "single",
    },
    currency: {
      kind: "string",
      cardinality: "single",
    },
    counterpartyId: {
      kind: "string",
      cardinality: "single",
    },
    groupId: {
      kind: "string",
      cardinality: "single",
    },
    includeDescendants: {
      kind: "boolean",
      cardinality: "single",
    },
  },
};

export const FINANCIAL_RESULTS_GROUP_LIST_CONTRACT: ListQueryContract<
  typeof FINANCIAL_RESULTS_GROUP_SORTABLE_COLUMNS,
  FinancialResultsByGroupFilters
> = {
  sortableColumns: FINANCIAL_RESULTS_GROUP_SORTABLE_COLUMNS,
  defaultSort: { id: "netMinor", desc: true },
  filters: {
    attributionMode: {
      kind: "string",
      cardinality: "single",
      enumValues: ["book_org", "analytic_counterparty"],
    },
    status: {
      kind: "string",
      cardinality: "multi",
      enumValues: ["pending", "posted", "failed"],
    },
    from: {
      kind: "string",
      cardinality: "single",
    },
    to: {
      kind: "string",
      cardinality: "single",
    },
    currency: {
      kind: "string",
      cardinality: "single",
    },
    groupId: {
      kind: "string",
      cardinality: "multi",
    },
    includeDescendants: {
      kind: "boolean",
      cardinality: "single",
    },
  },
};

const listFinancialResultsByCounterpartyQueryBaseSchema =
  createListQuerySchemaFromContract(
    FINANCIAL_RESULTS_COUNTERPARTY_LIST_CONTRACT,
  );

const listFinancialResultsByGroupQueryBaseSchema =
  createListQuerySchemaFromContract(FINANCIAL_RESULTS_GROUP_LIST_CONTRACT);

export const ListFinancialResultsByCounterpartyQuerySchema =
  listFinancialResultsByCounterpartyQueryBaseSchema.superRefine(
    (value, ctx) => {
      if (value.from && !z.iso.datetime().safeParse(value.from).success) {
        ctx.addIssue({
          code: "custom",
          path: ["from"],
          message: "from must be an ISO datetime",
        });
      }

      if (value.to && !z.iso.datetime().safeParse(value.to).success) {
        ctx.addIssue({
          code: "custom",
          path: ["to"],
          message: "to must be an ISO datetime",
        });
      }

      if (value.currency) {
        const currency = value.currency.trim().toUpperCase();
        if (!/^[A-Z0-9_]{2,16}$/.test(currency)) {
          ctx.addIssue({
            code: "custom",
            path: ["currency"],
            message:
              "currency must be 2-16 uppercase alphanumeric characters or underscores",
          });
        }
      }

      if (
        value.counterpartyId &&
        !uuidSchema.safeParse(value.counterpartyId).success
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["counterpartyId"],
          message: "counterpartyId must be UUID",
        });
      }

      if (value.groupId && !uuidSchema.safeParse(value.groupId).success) {
        ctx.addIssue({
          code: "custom",
          path: ["groupId"],
          message: "groupId must be UUID",
        });
      }
    },
  );

export const ListFinancialResultsByGroupQuerySchema =
  listFinancialResultsByGroupQueryBaseSchema.superRefine((value, ctx) => {
    if (!value.groupId || value.groupId.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["groupId"],
        message: "groupId[] is required",
      });
    } else {
      for (let i = 0; i < value.groupId.length; i += 1) {
        if (!uuidSchema.safeParse(value.groupId[i]).success) {
          ctx.addIssue({
            code: "custom",
            path: ["groupId", i],
            message: "groupId must be UUID",
          });
        }
      }
    }

    if (value.from && !z.iso.datetime().safeParse(value.from).success) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "from must be an ISO datetime",
      });
    }

    if (value.to && !z.iso.datetime().safeParse(value.to).success) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be an ISO datetime",
      });
    }

    if (value.currency) {
      const currency = value.currency.trim().toUpperCase();
      if (!/^[A-Z0-9_]{2,16}$/.test(currency)) {
        ctx.addIssue({
          code: "custom",
          path: ["currency"],
          message:
            "currency must be 2-16 uppercase alphanumeric characters or underscores",
        });
      }
    }
  });

export type ListFinancialResultsByCounterpartyQuery = z.infer<
  typeof ListFinancialResultsByCounterpartyQuerySchema
>;
export type ListFinancialResultsByGroupQuery = z.infer<
  typeof ListFinancialResultsByGroupQuerySchema
>;

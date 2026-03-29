import { z } from "zod";

import {
  createListQuerySchemaFromContract,
  type ListQueryContract,
} from "@bedrock/shared/core/pagination";

import { APPLICATION_STATUS_VALUES } from "../../domain/application-status";

export const APPLICATIONS_LIST_CONTRACT = {
  sortableColumns: ["createdAt", "updatedAt"] as const,
  defaultSort: { id: "createdAt" as const, desc: true },
  filters: {
    agentId: {
      kind: "string" as const,
      cardinality: "single" as const,
    },
    clientId: {
      kind: "number" as const,
      cardinality: "single" as const,
      int: true,
    },
    counterpartyId: {
      kind: "string" as const,
      cardinality: "single" as const,
    },
    status: {
      kind: "string" as const,
      cardinality: "multi" as const,
      enumValues: APPLICATION_STATUS_VALUES,
    },
    dateFrom: { kind: "string" as const, cardinality: "single" as const },
    dateTo: { kind: "string" as const, cardinality: "single" as const },
  },
} satisfies ListQueryContract<readonly ["createdAt", "updatedAt"], any>;

export const ListApplicationsQuerySchema = createListQuerySchemaFromContract(
  APPLICATIONS_LIST_CONTRACT,
);

export type ListApplicationsQuery = z.infer<
  typeof ListApplicationsQuerySchema
>;

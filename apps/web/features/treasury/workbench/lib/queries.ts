import "server-only";

import { cache } from "react";
import { z } from "zod";

import {
  GetTreasuryAccountBalancesInputSchema,
  TreasuryAccountBalancesResponseSchema,
  TreasuryAccountSchema,
  CounterpartyEndpointSchema,
  TreasuryEndpointSchema,
} from "@bedrock/treasury/accounts";
import {
  ExecutionInstructionSchema,
  UnmatchedExternalRecordSchema,
} from "@bedrock/treasury/executions";
import {
  OperationTimelineItemSchema,
  TreasuryOperationSchema,
} from "@bedrock/treasury/operations";
import {
  ListTreasuryPositionsInputSchema,
  TreasuryPositionSchema,
} from "@bedrock/treasury/positions";

import { getServerApiClient } from "@/lib/api/server-client";
import { readEntityById, readOptionsList } from "@/lib/api/query";

const TreasuryAccountsResponseSchema = z.object({
  data: z.array(TreasuryAccountSchema),
});

const TreasuryEndpointsResponseSchema = z.object({
  data: z.array(TreasuryEndpointSchema),
});

const CounterpartyEndpointsResponseSchema = z.object({
  data: z.array(CounterpartyEndpointSchema),
});

const ExecutionInstructionsResponseSchema = z.object({
  data: z.array(ExecutionInstructionSchema),
});

const TreasuryOperationsResponseSchema = z.object({
  data: z.array(TreasuryOperationSchema),
});

const TreasuryPositionsResponseSchema = z.object({
  data: z.array(TreasuryPositionSchema),
});

const UnmatchedExternalRecordsResponseSchema = z.object({
  data: z.array(UnmatchedExternalRecordSchema),
});

const ListTreasuryAccountsInputSchema = z.object({
  ownerEntityId: z.uuid().optional(),
  operatorEntityId: z.uuid().optional(),
  assetId: z.uuid().optional(),
  kind: z
    .enum([
      "bank",
      "wallet",
      "exchange",
      "custodial",
      "virtual",
      "internal_control",
    ])
    .optional(),
  canReceive: z.boolean().optional(),
  canSend: z.boolean().optional(),
  search: z.string().trim().optional(),
});

const ListTreasuryEndpointsInputSchema = z.object({
  accountId: z.uuid().optional(),
  endpointType: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

const ListCounterpartyEndpointsInputSchema = z.object({
  counterpartyId: z.uuid().optional(),
  assetId: z.uuid().optional(),
  endpointType: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

const ListTreasuryOperationsInputSchema = z.object({
  operationKind: z
    .enum([
      "collection",
      "payout",
      "intracompany_transfer",
      "intercompany_funding",
      "fx_conversion",
      "sweep",
      "return",
      "adjustment",
    ])
    .optional(),
  instructionStatus: z
    .enum([
      "draft",
      "approved",
      "reserved",
      "submitted",
      "partially_settled",
      "settled",
      "failed",
      "returned",
      "void",
    ])
    .optional(),
  entityId: z.uuid().optional(),
  assetId: z.uuid().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

const ListExecutionInstructionsInputSchema = z.object({
  operationId: z.uuid().optional(),
  sourceAccountId: z.uuid().optional(),
  assetId: z.uuid().optional(),
  instructionStatus: z
    .enum([
      "draft",
      "approved",
      "reserved",
      "submitted",
      "partially_settled",
      "settled",
      "failed",
      "returned",
      "void",
    ])
    .optional(),
  limit: z.number().int().positive().max(500).optional(),
});

const ListUnmatchedExternalRecordsInputSchema = z.object({
  sources: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export type TreasuryAccountListItem = z.infer<typeof TreasuryAccountSchema>;
export type TreasuryAccountBalanceListItem = z.infer<
  typeof TreasuryAccountBalancesResponseSchema
>["data"][number];
export type TreasuryEndpointListItem = z.infer<typeof TreasuryEndpointSchema>;
export type CounterpartyEndpointListItem = z.infer<
  typeof CounterpartyEndpointSchema
>;
export type TreasuryOperationListItem = z.infer<typeof TreasuryOperationSchema>;
export type TreasuryOperationTimeline = z.infer<typeof OperationTimelineItemSchema>;
export type ExecutionInstructionListItem = z.infer<
  typeof ExecutionInstructionSchema
>;
export type TreasuryPositionListItem = z.infer<typeof TreasuryPositionSchema>;
export type UnmatchedExternalRecordListItem = z.infer<
  typeof UnmatchedExternalRecordSchema
>;

export async function listTreasuryAccounts(
  input: z.input<typeof ListTreasuryAccountsInputSchema> = {},
) {
  const query = ListTreasuryAccountsInputSchema.parse(input);
  const client = await getServerApiClient();

  return readOptionsList({
    request: () =>
      client.v1.treasury.accounts.$get(
        { query },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryAccountsResponseSchema,
    context: "Не удалось загрузить treasury счета",
  }).then((payload) => payload.data);
}

export async function getTreasuryAccountBalances(
  input: z.input<typeof GetTreasuryAccountBalancesInputSchema> = {},
) {
  const query = GetTreasuryAccountBalancesInputSchema.parse(input);
  const client = await getServerApiClient();

  return readOptionsList({
    request: () =>
      client.v1.treasury.accounts.balances.$get(
        { query },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryAccountBalancesResponseSchema,
    context: "Не удалось загрузить остатки treasury счетов",
  }).then((payload) => payload.data);
}

export async function listTreasuryEndpoints(
  input: z.input<typeof ListTreasuryEndpointsInputSchema> = {},
) {
  const query = ListTreasuryEndpointsInputSchema.parse(input);
  const client = await getServerApiClient();

  return readOptionsList({
    request: () =>
      client.v1.treasury.accounts.endpoints.$get(
        { query },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryEndpointsResponseSchema,
    context: "Не удалось загрузить treasury endpoints",
  }).then((payload) => payload.data);
}

export async function listCounterpartyEndpoints(
  input: z.input<typeof ListCounterpartyEndpointsInputSchema> = {},
) {
  const query = ListCounterpartyEndpointsInputSchema.parse(input);
  const client = await getServerApiClient();

  return readOptionsList({
    request: () =>
      client.v1.treasury["counterparty-endpoints"].$get(
        { query },
        { init: { cache: "no-store" } },
      ),
    schema: CounterpartyEndpointsResponseSchema,
    context: "Не удалось загрузить counterparty endpoints",
  }).then((payload) => payload.data);
}

export async function listTreasuryOperations(
  input: z.input<typeof ListTreasuryOperationsInputSchema> = {},
) {
  const query = ListTreasuryOperationsInputSchema.parse(input);
  const client = await getServerApiClient();

  return readOptionsList({
    request: () =>
      client.v1.treasury.operations.$get(
        { query },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryOperationsResponseSchema,
    context: "Не удалось загрузить treasury операции",
  }).then((payload) => payload.data);
}

export async function listExecutionInstructions(
  input: z.input<typeof ListExecutionInstructionsInputSchema> = {},
) {
  const query = ListExecutionInstructionsInputSchema.parse(input);
  const client = await getServerApiClient();

  return readOptionsList({
    request: () =>
      client.v1.treasury["execution-instructions"].$get(
        { query },
        { init: { cache: "no-store" } },
      ),
    schema: ExecutionInstructionsResponseSchema,
    context: "Не удалось загрузить execution instructions",
  }).then((payload) => payload.data);
}

const getTreasuryOperationTimelineUncached = async (operationId: string) => {
  return readEntityById({
    id: operationId,
    resourceName: "операцию treasury",
    request: async (validId) => {
      const client = await getServerApiClient();

      return client.v1.treasury.operations[":operationId"].timeline.$get(
        { param: { operationId: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: OperationTimelineItemSchema,
  });
};

export const getTreasuryOperationTimeline = cache(
  getTreasuryOperationTimelineUncached,
);

export async function listTreasuryPositions(
  input: z.input<typeof ListTreasuryPositionsInputSchema> = {},
) {
  const query = ListTreasuryPositionsInputSchema.parse(input);
  const client = await getServerApiClient();

  return readOptionsList({
    request: () =>
      client.v1.treasury.positions.$get(
        { query },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryPositionsResponseSchema,
    context: "Не удалось загрузить treasury позиции",
  }).then((payload) => payload.data);
}

export async function listUnmatchedExternalRecords(
  input: z.input<typeof ListUnmatchedExternalRecordsInputSchema> = {},
) {
  const query = ListUnmatchedExternalRecordsInputSchema.parse(input);
  const client = await getServerApiClient();

  return readOptionsList({
    request: () =>
      client.v1.treasury["execution-events"].unmatched.$get(
        { query },
        { init: { cache: "no-store" } },
      ),
    schema: UnmatchedExternalRecordsResponseSchema,
    context: "Не удалось загрузить несопоставленные внешние записи",
  }).then((payload) => payload.data);
}

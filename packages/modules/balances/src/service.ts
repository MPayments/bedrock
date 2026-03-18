import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { PersistenceContext, Transaction } from "@bedrock/platform/persistence";

import { createGetBalanceHandler } from "./application/balances/queries";
import {
  createConsumeBalanceHandler,
  createReleaseBalanceHandler,
  createReserveBalanceHandler,
} from "./application/holds/commands";
import { createBalancesContext } from "./application/shared/context";
import type {
  BalancesIdempotencyPort,
  BalancesTransactionsPort,
} from "./application/shared/external-ports";
import type {
  BalanceMutationResult,
  BalanceSnapshot,
  BalanceSubjectInput,
  ConsumeBalanceInput,
  ReleaseBalanceInput,
  ReserveBalanceInput,
} from "./contracts";
import { createDrizzleBalancesStateRepository } from "./infra/drizzle/repos/balance-state-repository";

export interface BalancesService {
  getBalance: (subject: BalanceSubjectInput) => Promise<BalanceSnapshot>;
  reserve: (input: ReserveBalanceInput) => Promise<BalanceMutationResult>;
  release: (input: ReleaseBalanceInput) => Promise<BalanceMutationResult>;
  consume: (input: ConsumeBalanceInput) => Promise<BalanceMutationResult>;
}

export interface BalancesServiceDeps {
  persistence: PersistenceContext;
  idempotency: IdempotencyPort;
  logger?: Logger;
}

function createBalancesTransactions(input: {
  persistence: PersistenceContext;
  idempotency: IdempotencyPort;
}): BalancesTransactionsPort {
  return {
    async withTransaction(run) {
      return input.persistence.runInTransaction(async (tx: Transaction) => {
        const idempotency: BalancesIdempotencyPort = {
          withIdempotency<
            TResult,
            TStoredResult = Record<string, unknown>,
          >(params: {
            scope: string;
            idempotencyKey: string;
            request: unknown;
            actorId?: string | null;
            handler: () => Promise<TResult>;
            serializeResult: (result: TResult) => TStoredResult;
            loadReplayResult: (params: {
              storedResult: TStoredResult | null;
            }) => Promise<TResult>;
            serializeError?: (error: unknown) => Record<string, unknown>;
          }) {
            return input.idempotency.withIdempotencyTx<TResult, TStoredResult>({
              tx,
              scope: params.scope,
              idempotencyKey: params.idempotencyKey,
              request: params.request,
              actorId: params.actorId,
              handler: params.handler,
              serializeResult: params.serializeResult,
              loadReplayResult: ({ storedResult }) =>
                params.loadReplayResult({
                  storedResult: (storedResult as TStoredResult | null) ?? null,
                }),
              serializeError: params.serializeError,
            });
          },
        };

        return run({
          stateRepository: createDrizzleBalancesStateRepository(tx),
          idempotency,
        });
      });
    },
  };
}

export function createBalancesService(
  deps: BalancesServiceDeps,
): BalancesService {
  const context = createBalancesContext({
    logger: deps.logger,
    stateRepository: createDrizzleBalancesStateRepository(deps.persistence.db),
    transactions: createBalancesTransactions({
      persistence: deps.persistence,
      idempotency: deps.idempotency,
    }),
  });

  return {
    getBalance: createGetBalanceHandler(context),
    reserve: createReserveBalanceHandler(context),
    release: createReleaseBalanceHandler(context),
    consume: createConsumeBalanceHandler(context),
  };
}

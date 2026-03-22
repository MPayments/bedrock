import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleBalancesStateRepository } from "../../../balances/adapters/drizzle/balance-state.repository";
import type {
  BalancesCommandTx,
  BalancesCommandUnitOfWork,
} from "../../../balances/application/ports/balances.uow";
import { DrizzleBookAccountStore } from "../../../book-accounts/adapters/drizzle/book-account.store";
import type {
  BookAccountsCommandTx,
  BookAccountsCommandUnitOfWork,
} from "../../../book-accounts/application/ports/book-accounts.uow";
import { DrizzleBooksStore } from "../../../books/adapters/drizzle/book.store";
import type {
  BooksCommandTx,
  BooksCommandUnitOfWork,
} from "../../../books/application/ports/books.uow";
import { DrizzleOperationsRepository } from "../../../operations/adapters/drizzle/operations.repository";
import type {
  OperationsCommandTx,
  OperationsCommandUnitOfWork,
} from "../../../operations/application/ports/operations.uow";

type LedgerTx = BookAccountsCommandTx &
  BalancesCommandTx &
  BooksCommandTx &
  OperationsCommandTx;

function createBalancesIdempotencyPort(
  idempotency: IdempotencyPort,
  tx: Transaction,
): BalancesCommandTx["idempotency"] {
  return {
    withIdempotency<TResult, TStoredResult = Record<string, unknown>>(params: {
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
      return idempotency.withIdempotencyTx<TResult, TStoredResult>({
        tx,
        scope: params.scope,
        idempotencyKey: params.idempotencyKey,
        request: params.request,
        ...(params.actorId === undefined ? {} : { actorId: params.actorId }),
        handler: params.handler,
        serializeResult: params.serializeResult,
        loadReplayResult: ({ storedResult }) =>
          params.loadReplayResult({
            storedResult: (storedResult as TStoredResult | null) ?? null,
          }),
        ...(params.serializeError
          ? { serializeError: params.serializeError }
          : {}),
      });
    },
  };
}

function bindLedgerTx(
  tx: Transaction,
  idempotency: IdempotencyPort,
): LedgerTx {
  return {
    bookAccounts: new DrizzleBookAccountStore(tx),
    books: new DrizzleBooksStore(tx),
    operations: new DrizzleOperationsRepository(tx),
    stateRepository: new DrizzleBalancesStateRepository(tx),
    idempotency: createBalancesIdempotencyPort(idempotency, tx),
  };
}

export class DrizzleLedgerUnitOfWork
  implements
    BookAccountsCommandUnitOfWork,
    BalancesCommandUnitOfWork,
    BooksCommandUnitOfWork,
    OperationsCommandUnitOfWork
{
  private readonly transactional: TransactionalPort<LedgerTx>;

  constructor(input: {
    idempotency: IdempotencyPort;
    persistence: PersistenceContext;
  }) {
    this.transactional = createTransactionalPort(input.persistence, (tx) =>
      bindLedgerTx(tx, input.idempotency),
    );
  }

  run<T>(work: (tx: LedgerTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}

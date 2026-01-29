import {
  createClient,
  id as tbId,
  Account,
  Transfer,
  CreateAccountError,
  CreateTransferError,
} from "tigerbeetle-node";
import type { Logger } from "@repo/kernel";
import { AppError } from "@repo/kernel";

export interface TbAdapterConfig {
  address: string;
  clusterId: bigint;
}

export interface TbAccount {
  id: bigint;
  debitsPosted: bigint;
  creditsPosted: bigint;
  debitsPending: bigint;
  creditsPending: bigint;
  ledger: number;
  code: number;
  flags: number;
}

export interface TbTransferInput {
  id: bigint;
  debitAccountId: bigint;
  creditAccountId: bigint;
  amount: bigint;
  ledger: number;
  code: number;
  flags?: number
}

export type TbAdapter = ReturnType<typeof createTbAdapter>;

/**
 * Creates a TigerBeetle client adapter.
 * Wraps the low-level TB client with error normalization and logging.
 */
export function createTbAdapter(config: TbAdapterConfig, logger: Logger) {
  const log = logger.child({ pkg: "tb-adapter" });
  const client = createClient({
    cluster_id: config.clusterId,
    replica_addresses: [config.address],
  });

  const createAccounts = async (
    accounts: Array<{
      id: bigint;
      ledger: number;
      code: number;
      flags?: number;
    }>
  ): Promise<void> => {
    if (accounts.length === 0) return;

    const tbAccounts: Account[] = accounts.map((a) => ({
      id: a.id,
      debits_pending: 0n,
      debits_posted: 0n,
      credits_pending: 0n,
      credits_posted: 0n,
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      reserved: 0,
      ledger: a.ledger,
      code: a.code,
      flags: a.flags ?? 0,
      timestamp: 0n,
    }));

    const errors = await client.createAccounts(tbAccounts);

    // Accounts are always "ensure" semantics; exists is always OK.
    // This differs from createTransfers which respects allowExists option.
    const realErrors = errors.filter(
      (e) => e.result !== CreateAccountError.exists
    );

    if (realErrors.length > 0) {
      log.error("Failed to create TB accounts", {
        errors: realErrors.map((e) => ({
          index: e.index,
          result: CreateAccountError[e.result],
        })),
      });
      throw new AppError(
        "LEDGER_CREATE_ACCOUNT_FAILED",
        `Failed to create ${realErrors.length} account(s) in TigerBeetle`
      );
    }
  }

  const createTransfers = async (
    transfers: TbTransferInput[],
    options?: { allowExists?: boolean }
  ): Promise<void> => {
    if (transfers.length === 0) return;

    const tbTransfers: Transfer[] = transfers.map((t) => ({
      id: t.id,
      debit_account_id: t.debitAccountId,
      credit_account_id: t.creditAccountId,
      amount: t.amount,
      pending_id: 0n,
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      timeout: 0,
      ledger: t.ledger,
      code: t.code,
      flags: t.flags ?? 0,
      timestamp: 0n,
    }));

    const errors = await client.createTransfers(tbTransfers);

    // Filter errors based on allowExists option
    const realErrors = options?.allowExists
      ? errors.filter((e) => e.result !== CreateTransferError.exists)
      : errors;

    if (realErrors.length > 0) {
      // Map specific error types for better diagnostics
      const errorDetails = realErrors.map((e) => ({
        index: e.index,
        result: CreateTransferError[e.result],
        id: transfers[e.index]?.id.toString(),
      }));

      log.error("Failed to create TB transfers", { errors: errorDetails });

      // Check for specific error types
      const existsError = realErrors.find((e) => e.result === CreateTransferError.exists);
      if (existsError) {
        throw new AppError(
          "LEDGER_TRANSFER_EXISTS",
          `Transfer ID already exists: ${transfers[existsError.index]?.id}`
        );
      }

      throw new AppError(
        "LEDGER_TRANSFER_FAILED",
        `Failed to create ${realErrors.length} transfer(s) in TigerBeetle`
      );
    }

    log.debug("Created TB transfers", { count: transfers.length });
  }

  return {
    id: tbId,
    createAccounts,
    createTransfers,
    async lookupAccounts(ids: bigint[]): Promise<TbAccount[]> {
      if (ids.length === 0) return [];

      const accounts = await client.lookupAccounts(ids);

      return accounts.map((a) => ({
        id: a.id,
        debitsPosted: a.debits_posted,
        creditsPosted: a.credits_posted,
        debitsPending: a.debits_pending,
        creditsPending: a.credits_pending,
        ledger: a.ledger,
        code: a.code,
        flags: a.flags,
      }));
    },

    destroy() {
      client.destroy();
    },
  };
}

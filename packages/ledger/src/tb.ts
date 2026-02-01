import {
    createClient,
    TransferFlags,
    AccountFlags,
    CreateAccountError,
    CreateTransferError,
    type Account,
    type Transfer
} from "tigerbeetle-node";
import { TigerBeetleBatchError } from "./errors";

export type TbClient = ReturnType<typeof createClient>;
export { TransferFlags, AccountFlags, CreateAccountError, CreateTransferError };

export const TB_AMOUNT_MAX = (1n << 128n) - 1n;

export function createTbClient(clusterId: bigint, address: string) {
    return createClient({ cluster_id: clusterId, replica_addresses: [address] });
}

export function makeTbAccount(id: bigint, tbLedger: number, code: number): Account {
    return {
        id,
        ledger: tbLedger,
        code,
        flags: 0,

        debits_pending: 0n,
        debits_posted: 0n,
        credits_pending: 0n,
        credits_posted: 0n,

        user_data_128: 0n,
        user_data_64: 0n,
        user_data_32: 0,

        reserved: 0,
        timestamp: 0n
    };
}

export function makeTbTransfer(args: {
    id: bigint;
    debitAccountId: bigint;
    creditAccountId: bigint;
    amount: bigint;
    tbLedger: number;
    code: number;
    flags?: number;
    pendingId?: bigint;
    timeoutSeconds?: number;
}): Transfer {
    return {
        id: args.id,
        debit_account_id: args.debitAccountId,
        credit_account_id: args.creditAccountId,
        amount: args.amount,
        pending_id: args.pendingId ?? 0n,

        user_data_128: 0n,
        user_data_64: 0n,
        user_data_32: 0,

        timeout: args.timeoutSeconds ?? 0,
        ledger: args.tbLedger,
        code: args.code,
        flags: args.flags ?? 0,
        timestamp: 0n
    };
}

function enumName(e: any, code: number): string {
    return (e as any)[code] ?? `unknown(${code})`;
}

export async function tbCreateAccountsOrThrow(tb: TbClient, accounts: any[]) {
    const errs = await tb.createAccounts(accounts);
    if (!errs || errs.length === 0) return;

    const hard = errs
        .filter((e) => e.result !== CreateAccountError.exists)
        .map((e) => ({ index: e.index, code: e.result, name: enumName(CreateAccountError, e.result) }));

    if (hard.length) {
        throw new TigerBeetleBatchError(
            `TigerBeetle createAccounts failed: ${hard.map((h) => `${h.index}:${h.name}`).join(", ")}`,
            "createAccounts",
            hard
        );
    }
}

export async function tbCreateTransfersOrThrow(tb: TbClient, transfers: any[]) {
    const errs = await tb.createTransfers(transfers);
    if (!errs || errs.length === 0) return;

    const hard = errs
        .filter((e) => e.result !== CreateTransferError.exists)
        .map((e) => ({ index: e.index, code: e.result, name: enumName(CreateTransferError, e.result) }));

    if (hard.length) {
        throw new TigerBeetleBatchError(
            `TigerBeetle createTransfers failed: ${hard.map((h) => `${h.index}:${h.name}`).join(", ")}`,
            "createTransfers",
            hard
        );
    }
}

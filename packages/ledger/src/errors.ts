export class LedgerError extends Error {
    name = "LedgerError";
}

export class PostingError extends LedgerError {
    name = "PostingError";
}

export class IdempotencyConflictError extends LedgerError {
    name = "IdempotencyConflictError";
}

export class AccountMappingConflictError extends LedgerError {
    name = "AccountMappingConflictError";
    constructor(
        msg: string,
        public readonly orgId: string,
        public readonly tbLedger: number,
        public readonly key: string,
        public readonly expected: bigint,
        public readonly actual: bigint
    ) {
        super(msg);
    }
}

export class TigerBeetleBatchError extends LedgerError {
    name = "TigerBeetleBatchError";
    constructor(
        msg: string,
        public readonly operation: "createAccounts" | "createTransfers",
        public readonly details: Array<{ index: number; code: number; name: string }>
    ) {
        super(msg);
    }
}

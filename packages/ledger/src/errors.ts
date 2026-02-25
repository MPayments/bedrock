export class LedgerError extends Error {
    name = "LedgerError";
}

export class PostingError extends LedgerError {
    name = "PostingError";
}

export class IdempotencyConflictError extends LedgerError {
    name = "IdempotencyConflictError";
}

export class AccountPostingValidationError extends LedgerError {
    name = "AccountPostingValidationError";
}

export class MissingRequiredAnalyticsError extends LedgerError {
    name = "MissingRequiredAnalyticsError";

    constructor(accountNo: string, analyticType: string, postingCode: string) {
        super(
            `Missing required analytics "${analyticType}" for account=${accountNo}, postingCode=${postingCode}`
        );
    }
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
        public readonly details: { index: number; code: number; name: string }[]
    ) {
        super(msg);
    }
}

export function isRetryableError(error: unknown): boolean {
    if (!error) return false;

    const err = error as any;
    const message = err?.message?.toLowerCase() || "";
    const code = err?.code?.toUpperCase() || "";
    const name = err?.name || "";

    const retryableCodes = [
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ECONNRESET",
        "EHOSTUNREACH",
        "ENETUNREACH",
        "EAI_AGAIN",
        "ENOTFOUND"
    ];

    if (retryableCodes.includes(code)) {
        return true;
    }

    if (
        message.includes("connection") &&
        (message.includes("refused") || message.includes("timeout") || message.includes("lost"))
    ) {
        return true;
    }

    if (err instanceof IdempotencyConflictError ||
        err instanceof AccountMappingConflictError ||
        err instanceof TigerBeetleBatchError ||
        err instanceof LedgerError) {
        return false;
    }

    if (
        name.includes("Validation") ||
        message.includes("invalid") ||
        message.includes("must be") ||
        message.includes("required") ||
        message.includes("conflict")
    ) {
        return false;
    }

    return true;
}

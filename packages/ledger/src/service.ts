import type { Logger } from "@repo/kernel";
import { AppError } from "@repo/kernel";
import { AccountFlags, TransferFlags } from "tigerbeetle-node";

import type {
  AccountRef,
  AccountBalance,
  PostRequest,
  PostReceipt,
  ResolvedAccount,
  TransferInput,
} from "./contract.js";
import { accountRefKey } from "./contract.js";
import type { TbAdapter } from "./adapter.js";
import type { AccountStore } from "./pg-store.js";
import { tbAccountIdFromKey } from "./ids.js";

export interface LedgerServiceDeps {
  tb: TbAdapter;
  accountStore: AccountStore;
  logger: Logger;

  /** currency -> TB ledger */
  ledgerForCurrency: (currency: string) => number;

  /** default TB account code */
  defaultAccountCode: number;

  /** optional: per-kind default history */
  enableHistoryByDefault?: boolean;
  accountFlags?: Partial<Record<AccountRef["kind"], { history?: boolean }>>;

  /** optional: per-ref account code (like old accountCodeFor) */
  accountCodeFor?: (ref: AccountRef) => number;
}

export type LedgerService = ReturnType<typeof createLedgerService>;

function defaultAccountCodeFor(ref: AccountRef): number {
  switch (ref.kind) {
    case "customer":
      return 10;
    case "internal":
      return 20;
    case "global_ledger":
      return 30;
  }
}

function encodeAccountFlags(input: { history?: boolean }): number {
  let f = 0;
  if (input.history) f |= AccountFlags.history;
  return f;
}

function encodeTransferFlags(input: { linked?: boolean }): number {
  let f = 0;
  if (input.linked) f |= TransferFlags.linked;
  return f;
}

function validatePost(req: PostRequest) {
  if (!req.transfers.length) {
    throw new AppError("LEDGER_INVALID_POST", "No transfers provided");
  }
  for (const t of req.transfers) {
    if (t.amount <= 0n) {
      throw new AppError("LEDGER_INVALID_AMOUNT", "Amount must be > 0", { id: t.id.toString() });
    }
    if (t.debit.currency !== t.credit.currency) {
      throw new AppError(
        "LEDGER_CURRENCY_MISMATCH",
        `Cannot transfer between different currencies: ${t.debit.currency} vs ${t.credit.currency}`,
        { id: t.id.toString() }
      );
    }
  }
}

export function createLedgerService(deps: LedgerServiceDeps) {
  const log = deps.logger.child({ pkg: "ledger" });

  /**
   * Old behavior: strict resolve.
   * Throws if the account isn't present in the mapping store.
   */
  const resolveAccount = async (ref: AccountRef): Promise<ResolvedAccount> => {
    const mapping = await deps.accountStore.get(ref);
    if (!mapping) {
      throw new AppError("ACCOUNT_NOT_FOUND", "Account not found in ledger mapping store", {
        ref,
        refKey: accountRefKey(ref),
      });
    }
    return { ref, tbAccountId: mapping.tbAccountId, tbLedger: mapping.tbLedger };
  };

  /**
   * Ensures TB + mapping exist.
   * Reintroduces history config (old behavior).
   * No extra DB roundtrip: relies on upsert RETURNING.
   */
  const ensureAccount = async (
    ref: AccountRef,
    opts?: { history?: boolean }
  ): Promise<ResolvedAccount> => {
    const key = accountRefKey(ref);
    const tbAccountId = tbAccountIdFromKey(key);
    const tbLedger = deps.ledgerForCurrency(ref.currency);

    const history =
      opts?.history ??
      deps.accountFlags?.[ref.kind]?.history ??
      deps.enableHistoryByDefault ??
      false;

    const flags = encodeAccountFlags({ history });

    // Account code resolution: custom function > kind-based default > global default
    const code =
      deps.accountCodeFor?.(ref) ??
      defaultAccountCodeFor(ref) ??
      deps.defaultAccountCode;

    // 1) Ensure in TB (idempotent)
    await deps.tb.createAccounts([{ id: tbAccountId, ledger: tbLedger, code, flags }]);

    // 2) Ensure mapping in PG (single query returning stored row)
    const { created, mapping } = await deps.accountStore.upsert(ref, { tbAccountId, tbLedger });

    // Detect conflicts without extra select
    if (mapping.tbAccountId !== tbAccountId || mapping.tbLedger !== tbLedger) {
      throw new AppError("LEDGER_MAPPING_CONFLICT", `Mapping conflict for ${key}`, {
        expected: { tbAccountId: tbAccountId.toString(), tbLedger },
        actual: { tbAccountId: mapping.tbAccountId.toString(), tbLedger: mapping.tbLedger },
      });
    }

    if (created) {
      log.info("Created ledger account", { refKey: key, tbAccountId: tbAccountId.toString(), tbLedger, history });
    }

    return { ref, tbAccountId, tbLedger };
  };

  const post = async (req: PostRequest): Promise<PostReceipt> => {
    validatePost(req);

    // 1) batch fetch mappings (single DB query)
    const uniqRefsMap = new Map<string, AccountRef>();
    for (const t of req.transfers) {
      uniqRefsMap.set(accountRefKey(t.debit), t.debit);
      uniqRefsMap.set(accountRefKey(t.credit), t.credit);
    }
    const uniqRefs = [...uniqRefsMap.values()];
    const mappings = await deps.accountStore.getMany(uniqRefs);

    // 2) strict missing detection (old resolveAccount behavior)
    const missing: Array<{ ref: AccountRef; refKey: string }> = [];
    for (const ref of uniqRefs) {
      const k = accountRefKey(ref);
      if (!mappings.has(k)) missing.push({ ref, refKey: k });
    }
    if (missing.length) {
      throw new AppError("ACCOUNT_NOT_FOUND", "Some accounts are not provisioned in mapping store", {
        missing: missing.map((m) => m.refKey),
      });
    }

    // 3) build resolved map
    const resolved = new Map<string, ResolvedAccount>();
    for (const ref of uniqRefs) {
      const k = accountRefKey(ref);
      const m = mappings.get(k)!;
      resolved.set(k, { ref, tbAccountId: m.tbAccountId, tbLedger: m.tbLedger });
    }

    // 4) build TB transfers (with linked flags)
    const tbTransfers = req.transfers.map((t, index) => {
      const debit = resolved.get(accountRefKey(t.debit))!;
      const credit = resolved.get(accountRefKey(t.credit))!;

      if (debit.tbLedger !== credit.tbLedger) {
        throw new AppError(
          "LEDGER_MISMATCH",
          `Debit and credit accounts must be in the same TigerBeetle ledger`,
          { id: t.id.toString(), debitLedger: debit.tbLedger, creditLedger: credit.tbLedger }
        );
      }

      const linked = req.mode === "linked_chain" && index < req.transfers.length - 1;
      const flags = encodeTransferFlags({ linked });

      return {
        id: t.id,
        debitAccountId: debit.tbAccountId,
        creditAccountId: credit.tbAccountId,
        amount: t.amount,
        ledger: debit.tbLedger,
        code: t.code,
        flags,
      };
    });

    // Old semantics: ids are provided, so allowExists is OK (retry-safe)
    await deps.tb.createTransfers(tbTransfers, { allowExists: true });

    const submitted = req.transfers.map((t) => ({
      id: t.id,
      debit: resolved.get(accountRefKey(t.debit))!,
      credit: resolved.get(accountRefKey(t.credit))!,
      amount: t.amount,
      code: t.code,
    }));

    return { submitted, transferIds: submitted.map((s) => s.id) };
  };

  /**
   * Convenience single transfer API.
   * If id not provided, generate TB recommended id() and disallow exists.
   * If id provided, allow exists for idempotent retries.
   */
  const transfer = async (input: TransferInput): Promise<{ id: bigint }> => {
    if (input.amount <= 0n) throw new AppError("LEDGER_INVALID_AMOUNT", "Amount must be > 0");

    if (input.debit.currency !== input.credit.currency) {
      throw new AppError(
        "LEDGER_CURRENCY_MISMATCH",
        `Cannot transfer between different currencies: ${input.debit.currency} vs ${input.credit.currency}`
      );
    }

    const id = input.id ?? deps.tb.id();
    const allowExists = input.id != null;

    // Strict resolve like old:
    const [debit, credit] = await Promise.all([resolveAccount(input.debit), resolveAccount(input.credit)]);

    if (debit.tbLedger !== credit.tbLedger) {
      throw new AppError("LEDGER_MISMATCH", `Ledger mismatch: debit=${debit.tbLedger}, credit=${credit.tbLedger}`);
    }

    await deps.tb.createTransfers(
      [{
        id,
        debitAccountId: debit.tbAccountId,
        creditAccountId: credit.tbAccountId,
        amount: input.amount,
        ledger: debit.tbLedger,
        code: input.code,
        flags: 0,
      }],
      { allowExists }
    );

    return { id };
  };

  const getBalance = async (ref: AccountRef): Promise<AccountBalance> => {
    const account = await resolveAccount(ref);

    const [tbAccount] = await deps.tb.lookupAccounts([account.tbAccountId]);
    if (!tbAccount) {
      throw new AppError("TB_ACCOUNT_MISSING", "TB account missing but mapping exists", {
        refKey: accountRefKey(ref),
        tbAccountId: account.tbAccountId.toString(),
      });
    }

    return {
      ref,
      tbAccountId: account.tbAccountId,
      debitsPosted: tbAccount.debitsPosted,
      creditsPosted: tbAccount.creditsPosted,
      debitsPending: tbAccount.debitsPending,
      creditsPending: tbAccount.creditsPending,
    };
  };

  const getBalances = async (refs: AccountRef[]): Promise<AccountBalance[]> => {
    if (refs.length === 0) return [];

    // Batch fetch mappings (single DB query)
    const mappings = await deps.accountStore.getMany(refs);

    // Strict: throw if any missing
    const resolved = refs.map((ref) => {
      const k = accountRefKey(ref);
      const m = mappings.get(k);
      if (!m) {
        throw new AppError("ACCOUNT_NOT_FOUND", "Account not found in ledger mapping store", {
          ref,
          refKey: k,
        });
      }
      return { ref, tbAccountId: m.tbAccountId, tbLedger: m.tbLedger };
    });

    const tbAccounts = await deps.tb.lookupAccounts(resolved.map((a) => a.tbAccountId));
    const byId = new Map(tbAccounts.map((a) => [a.id, a]));

    return resolved.map((a) => {
      const tb = byId.get(a.tbAccountId);
      if (!tb) {
        throw new AppError("TB_ACCOUNT_MISSING", "TB account missing but mapping exists", {
          refKey: accountRefKey(a.ref),
          tbAccountId: a.tbAccountId.toString(),
        });
      }
      return {
        ref: a.ref,
        tbAccountId: a.tbAccountId,
        debitsPosted: tb.debitsPosted,
        creditsPosted: tb.creditsPosted,
        debitsPending: tb.debitsPending,
        creditsPending: tb.creditsPending,
      };
    });
  };

  return {
    resolveAccount,   // strict (old)
    ensureAccount,    // creates TB + mapping
    post,             // old multi-transfer
    transfer,         // convenience
    getBalance,       // strict
    getBalances,      // strict
  };
}

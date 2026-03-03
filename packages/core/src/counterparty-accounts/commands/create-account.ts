import { and, eq, like, or } from "drizzle-orm";

import { schema } from "@bedrock/core/counterparty-accounts/schema";
import { ensureBookAccountInstanceTx } from "@bedrock/core/ledger";
import type { Transaction } from "@bedrock/kernel/db/types";

import { AccountProviderNotFoundError } from "../errors";
import { ensureCounterpartyDefaultBookIdTx } from "../internal/books";
import type { CounterpartyAccountsServiceContext } from "../internal/context";
import {
  CreateAccountInputSchema,
  validateAccountFieldsForProvider,
  type CreateAccountInput,
} from "../validation";

const MAX_STABLE_KEY_BASE_LENGTH = 240;

function slugifyStableKeyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildStableKeyBase(input: { label: string; currencyCode: string }): string {
  const labelPart = slugifyStableKeyPart(input.label) || "account";
  const currencyPart = slugifyStableKeyPart(input.currencyCode) || "cur";
  return `${labelPart}-${currencyPart}`.slice(0, MAX_STABLE_KEY_BASE_LENGTH);
}

async function generateStableKeyTx(
  tx: Transaction,
  input: {
    counterpartyId: string;
    label: string;
    currencyCode: string;
  },
): Promise<string> {
  const base = buildStableKeyBase({
    label: input.label,
    currencyCode: input.currencyCode,
  });

  const rows = await tx
    .select({ stableKey: schema.counterpartyAccounts.stableKey })
    .from(schema.counterpartyAccounts)
    .where(
      and(
        eq(schema.counterpartyAccounts.counterpartyId, input.counterpartyId),
        or(
          eq(schema.counterpartyAccounts.stableKey, base),
          like(schema.counterpartyAccounts.stableKey, `${base}-%`),
        ),
      ),
    );

  const taken = new Set(rows.map((row: { stableKey: string }) => row.stableKey));
  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;
  while (true) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
    suffix += 1;
  }
}

export function createCreateCounterpartyAccountHandler(
  context: CounterpartyAccountsServiceContext,
) {
  const { db, log } = context;

  return async function createAccount(input: CreateAccountInput) {
    const validated = CreateAccountInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [provider] = await tx
        .select()
        .from(schema.counterpartyAccountProviders)
        .where(
          eq(
            schema.counterpartyAccountProviders.id,
            validated.accountProviderId,
          ),
        )
        .limit(1);

      if (!provider) {
        throw new AccountProviderNotFoundError(validated.accountProviderId);
      }

      validateAccountFieldsForProvider(validated, provider);

      const [currency] = await tx
        .select({ code: schema.currencies.code })
        .from(schema.currencies)
        .where(eq(schema.currencies.id, validated.currencyId))
        .limit(1);

      if (!currency) {
        throw new Error(`Currency not found: ${validated.currencyId}`);
      }

      const stableKey = await generateStableKeyTx(tx, {
        counterpartyId: validated.counterpartyId,
        label: validated.label,
        currencyCode: currency.code,
      });

      const [created] = await tx
        .insert(schema.counterpartyAccounts)
        .values({
          counterpartyId: validated.counterpartyId,
          currencyId: validated.currencyId,
          accountProviderId: validated.accountProviderId,
          label: validated.label,
          description: validated.description ?? null,
          stableKey,
          accountNo: validated.accountNo ?? null,
          corrAccount: validated.corrAccount ?? null,
          address: validated.address ?? null,
          iban: validated.iban ?? null,
        })
        .returning();

      const bookId = await ensureCounterpartyDefaultBookIdTx(
        tx,
        validated.counterpartyId,
      );
      const { id: bookAccountInstanceId } = await ensureBookAccountInstanceTx(
        tx,
        {
          bookId,
          accountNo: validated.postingAccountNo,
          currency: currency.code,
          dimensions: {},
        },
      );

      await tx
        .insert(schema.counterpartyAccountBindings)
        .values({
          counterpartyAccountId: created!.id,
          bookId,
          bookAccountInstanceId,
        })
        .onConflictDoUpdate({
          target: schema.counterpartyAccountBindings.counterpartyAccountId,
          set: {
            bookId,
            bookAccountInstanceId,
          },
        });

      log.info("Account created", { id: created!.id, label: created!.label });

      return {
        id: created!.id,
        counterpartyId: created!.counterpartyId,
        bookId,
        currencyId: created!.currencyId,
        accountProviderId: created!.accountProviderId,
        label: created!.label,
        description: created!.description,
        accountNo: created!.accountNo,
        corrAccount: created!.corrAccount,
        address: created!.address,
        iban: created!.iban,
        postingAccountNo: validated.postingAccountNo,
        createdAt: created!.createdAt,
        updatedAt: created!.updatedAt,
      };
    });
  };
}

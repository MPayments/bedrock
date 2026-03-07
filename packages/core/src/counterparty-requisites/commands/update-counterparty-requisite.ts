import { and, eq, isNull, ne, sql } from "drizzle-orm";

import { isInternalLedgerCounterparty } from "@bedrock/core/counterparties";
import type { Transaction } from "@bedrock/kernel/db/types";

import { schema } from "../schema";
import type { CounterpartyRequisitesServiceContext } from "../internal/context";
import {
  UpdateCounterpartyRequisiteInputSchema,
  validateCounterpartyRequisiteFields,
  type CounterpartyRequisite,
  type UpdateCounterpartyRequisiteInput,
} from "../validation";
import {
  CounterpartyRequisiteNotFoundError,
  CounterpartyRequisiteOwnerInternalError,
} from "../errors";

async function clearOtherDefaultsTx(
  tx: Transaction,
  input: {
    counterpartyId: string;
    currencyId: string;
    currentId: string;
  },
) {
  await tx
    .update(schema.counterpartyRequisites)
    .set({ isDefault: false })
    .where(
      and(
        eq(schema.counterpartyRequisites.counterpartyId, input.counterpartyId),
        eq(schema.counterpartyRequisites.currencyId, input.currencyId),
        isNull(schema.counterpartyRequisites.archivedAt),
        ne(schema.counterpartyRequisites.id, input.currentId),
      ),
    );
}

async function promoteNextDefaultTx(
  tx: Transaction,
  input: {
    counterpartyId: string;
    currencyId: string;
    excludeId: string;
  },
) {
  const [replacement] = await tx
    .select({ id: schema.counterpartyRequisites.id })
    .from(schema.counterpartyRequisites)
    .where(
      and(
        eq(schema.counterpartyRequisites.counterpartyId, input.counterpartyId),
        eq(schema.counterpartyRequisites.currencyId, input.currencyId),
        isNull(schema.counterpartyRequisites.archivedAt),
        ne(schema.counterpartyRequisites.id, input.excludeId),
      ),
    )
    .limit(1);

  if (!replacement) {
    return;
  }

  await tx
    .update(schema.counterpartyRequisites)
    .set({ isDefault: true, updatedAt: sql`now()` })
    .where(eq(schema.counterpartyRequisites.id, replacement.id));
}

export function createUpdateCounterpartyRequisiteHandler(
  context: CounterpartyRequisitesServiceContext,
) {
  const { db, log } = context;

  return async function updateCounterpartyRequisite(
    id: string,
    input: UpdateCounterpartyRequisiteInput,
  ): Promise<CounterpartyRequisite> {
    const validated = UpdateCounterpartyRequisiteInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.counterpartyRequisites)
        .where(
          and(
            eq(schema.counterpartyRequisites.id, id),
            isNull(schema.counterpartyRequisites.archivedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new CounterpartyRequisiteNotFoundError(id);
      }

      if (
        await isInternalLedgerCounterparty({
          db: tx,
          counterpartyId: existing.counterpartyId,
        })
      ) {
        throw new CounterpartyRequisiteOwnerInternalError(
          existing.counterpartyId,
        );
      }

      const nextKind = validated.kind ?? existing.kind;
      const nextCurrencyId = validated.currencyId ?? existing.currencyId;
      const nextIsDefault = validated.isDefault ?? existing.isDefault;

      validateCounterpartyRequisiteFields({
        kind: nextKind,
        beneficiaryName: validated.beneficiaryName ?? existing.beneficiaryName,
        institutionName: validated.institutionName ?? existing.institutionName,
        institutionCountry:
          validated.institutionCountry ?? existing.institutionCountry,
        accountNo: validated.accountNo ?? existing.accountNo,
        corrAccount: validated.corrAccount ?? existing.corrAccount,
        iban: validated.iban ?? existing.iban,
        bic: validated.bic ?? existing.bic,
        swift: validated.swift ?? existing.swift,
        bankAddress: validated.bankAddress ?? existing.bankAddress,
        network: validated.network ?? existing.network,
        assetCode: validated.assetCode ?? existing.assetCode,
        address: validated.address ?? existing.address,
        memoTag: validated.memoTag ?? existing.memoTag,
        accountRef: validated.accountRef ?? existing.accountRef,
        subaccountRef: validated.subaccountRef ?? existing.subaccountRef,
        contact: validated.contact ?? existing.contact,
        notes: validated.notes ?? existing.notes,
      });

      const [updated] = await tx
        .update(schema.counterpartyRequisites)
        .set({
          currencyId: nextCurrencyId,
          kind: nextKind,
          label: validated.label ?? existing.label,
          description:
            validated.description !== undefined
              ? validated.description ?? null
              : existing.description,
          beneficiaryName:
            validated.beneficiaryName !== undefined
              ? validated.beneficiaryName ?? null
              : existing.beneficiaryName,
          institutionName:
            validated.institutionName !== undefined
              ? validated.institutionName ?? null
              : existing.institutionName,
          institutionCountry:
            validated.institutionCountry !== undefined
              ? validated.institutionCountry ?? null
              : existing.institutionCountry,
          accountNo:
            validated.accountNo !== undefined
              ? validated.accountNo ?? null
              : existing.accountNo,
          corrAccount:
            validated.corrAccount !== undefined
              ? validated.corrAccount ?? null
              : existing.corrAccount,
          iban:
            validated.iban !== undefined ? validated.iban ?? null : existing.iban,
          bic: validated.bic !== undefined ? validated.bic ?? null : existing.bic,
          swift:
            validated.swift !== undefined
              ? validated.swift ?? null
              : existing.swift,
          bankAddress:
            validated.bankAddress !== undefined
              ? validated.bankAddress ?? null
              : existing.bankAddress,
          network:
            validated.network !== undefined
              ? validated.network ?? null
              : existing.network,
          assetCode:
            validated.assetCode !== undefined
              ? validated.assetCode ?? null
              : existing.assetCode,
          address:
            validated.address !== undefined
              ? validated.address ?? null
              : existing.address,
          memoTag:
            validated.memoTag !== undefined
              ? validated.memoTag ?? null
              : existing.memoTag,
          accountRef:
            validated.accountRef !== undefined
              ? validated.accountRef ?? null
              : existing.accountRef,
          subaccountRef:
            validated.subaccountRef !== undefined
              ? validated.subaccountRef ?? null
              : existing.subaccountRef,
          contact:
            validated.contact !== undefined
              ? validated.contact ?? null
              : existing.contact,
          notes:
            validated.notes !== undefined
              ? validated.notes ?? null
              : existing.notes,
          isDefault: nextIsDefault,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.counterpartyRequisites.id, id))
        .returning();

      if (!updated) {
        throw new CounterpartyRequisiteNotFoundError(id);
      }

      if (nextIsDefault) {
        await clearOtherDefaultsTx(tx, {
          counterpartyId: updated.counterpartyId,
          currencyId: updated.currencyId,
          currentId: updated.id,
        });
      } else if (
        existing.isDefault &&
        (validated.isDefault === false || existing.currencyId !== updated.currencyId)
      ) {
        await promoteNextDefaultTx(tx, {
          counterpartyId: existing.counterpartyId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      log.info("Counterparty requisite updated", { id });
      return updated;
    });
  };
}

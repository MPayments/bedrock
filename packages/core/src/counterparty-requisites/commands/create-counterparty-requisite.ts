import { and, eq, isNull, ne } from "drizzle-orm";

import { isInternalLedgerCounterparty } from "@bedrock/core/counterparties";
import type { Transaction } from "@bedrock/kernel/db/types";

import { schema } from "../schema";
import type { CounterpartyRequisitesServiceContext } from "../internal/context";
import {
  CreateCounterpartyRequisiteInputSchema,
  validateCounterpartyRequisiteFields,
  type CounterpartyRequisite,
  type CreateCounterpartyRequisiteInput,
} from "../validation";
import { CounterpartyRequisiteOwnerInternalError } from "../errors";

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

  await tx
    .update(schema.counterpartyRequisites)
    .set({ isDefault: true })
    .where(eq(schema.counterpartyRequisites.id, input.currentId));
}

export function createCreateCounterpartyRequisiteHandler(
  context: CounterpartyRequisitesServiceContext,
) {
  const { db, log } = context;

  return async function createCounterpartyRequisite(
    input: CreateCounterpartyRequisiteInput,
  ): Promise<CounterpartyRequisite> {
    const validated = CreateCounterpartyRequisiteInputSchema.parse(input);
    validateCounterpartyRequisiteFields({
      kind: validated.kind,
      beneficiaryName: validated.beneficiaryName ?? null,
      institutionName: validated.institutionName ?? null,
      institutionCountry: validated.institutionCountry ?? null,
      accountNo: validated.accountNo ?? null,
      corrAccount: validated.corrAccount ?? null,
      iban: validated.iban ?? null,
      bic: validated.bic ?? null,
      swift: validated.swift ?? null,
      bankAddress: validated.bankAddress ?? null,
      network: validated.network ?? null,
      assetCode: validated.assetCode ?? null,
      address: validated.address ?? null,
      memoTag: validated.memoTag ?? null,
      accountRef: validated.accountRef ?? null,
      subaccountRef: validated.subaccountRef ?? null,
      contact: validated.contact ?? null,
      notes: validated.notes ?? null,
    });

    return db.transaction(async (tx) => {
      if (
        await isInternalLedgerCounterparty({
          db: tx,
          counterpartyId: validated.counterpartyId,
        })
      ) {
        throw new CounterpartyRequisiteOwnerInternalError(
          validated.counterpartyId,
        );
      }

      const existingDefault = await tx
        .select({ id: schema.counterpartyRequisites.id })
        .from(schema.counterpartyRequisites)
        .where(
          and(
            eq(
              schema.counterpartyRequisites.counterpartyId,
              validated.counterpartyId,
            ),
            eq(schema.counterpartyRequisites.currencyId, validated.currencyId),
            isNull(schema.counterpartyRequisites.archivedAt),
          ),
        );

      const shouldBeDefault =
        validated.isDefault === true || existingDefault.length === 0;

      const [created] = await tx
        .insert(schema.counterpartyRequisites)
        .values({
          counterpartyId: validated.counterpartyId,
          currencyId: validated.currencyId,
          kind: validated.kind,
          label: validated.label,
          description: validated.description ?? null,
          beneficiaryName: validated.beneficiaryName ?? null,
          institutionName: validated.institutionName ?? null,
          institutionCountry: validated.institutionCountry ?? null,
          accountNo: validated.accountNo ?? null,
          corrAccount: validated.corrAccount ?? null,
          iban: validated.iban ?? null,
          bic: validated.bic ?? null,
          swift: validated.swift ?? null,
          bankAddress: validated.bankAddress ?? null,
          network: validated.network ?? null,
          assetCode: validated.assetCode ?? null,
          address: validated.address ?? null,
          memoTag: validated.memoTag ?? null,
          accountRef: validated.accountRef ?? null,
          subaccountRef: validated.subaccountRef ?? null,
          contact: validated.contact ?? null,
          notes: validated.notes ?? null,
          isDefault: shouldBeDefault,
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create counterparty requisite");
      }

      if (shouldBeDefault) {
        await clearOtherDefaultsTx(tx, {
          counterpartyId: created.counterpartyId,
          currencyId: created.currencyId,
          currentId: created.id,
        });
      }

      const [fresh] = await tx
        .select()
        .from(schema.counterpartyRequisites)
        .where(eq(schema.counterpartyRequisites.id, created.id))
        .limit(1);

      log.info("Counterparty requisite created", {
        id: created.id,
        counterpartyId: created.counterpartyId,
      });

      return fresh!;
    });
  };
}

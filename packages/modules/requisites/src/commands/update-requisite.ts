import { and, eq, isNull, ne, sql } from "drizzle-orm";

import type { Transaction } from "@bedrock/persistence";

import { RequisiteNotFoundError, RequisiteProviderNotActiveError } from "../errors";
import { ensureRequisiteAccountingBindingTx } from "../internal/bindings";
import type { RequisitesServiceContext } from "../internal/context";
import { toPublicRequisite } from "../internal/shape";
import { schema } from "../schema";
import {
  UpdateRequisiteInputSchema,
  validateRequisiteFields,
  type Requisite,
  type RequisiteOwnerType,
  type UpdateRequisiteInput,
} from "../validation";

async function clearOtherDefaultsTx(
  tx: Transaction,
  input: {
    ownerType: RequisiteOwnerType;
    ownerId: string;
    currencyId: string;
    currentId: string;
  },
) {
  await tx
    .update(schema.requisites)
    .set({ isDefault: false })
    .where(
      and(
        eq(schema.requisites.ownerType, input.ownerType),
        input.ownerType === "organization"
          ? eq(schema.requisites.organizationId, input.ownerId)
          : eq(schema.requisites.counterpartyId, input.ownerId),
        eq(schema.requisites.currencyId, input.currencyId),
        isNull(schema.requisites.archivedAt),
        ne(schema.requisites.id, input.currentId),
      ),
    );
}

async function promoteNextDefaultTx(
  tx: Transaction,
  input: {
    ownerType: RequisiteOwnerType;
    ownerId: string;
    currencyId: string;
    excludeId: string;
  },
) {
  const [replacement] = await tx
    .select({ id: schema.requisites.id })
    .from(schema.requisites)
    .where(
      and(
        eq(schema.requisites.ownerType, input.ownerType),
        input.ownerType === "organization"
          ? eq(schema.requisites.organizationId, input.ownerId)
          : eq(schema.requisites.counterpartyId, input.ownerId),
        eq(schema.requisites.currencyId, input.currencyId),
        isNull(schema.requisites.archivedAt),
        ne(schema.requisites.id, input.excludeId),
      ),
    )
    .limit(1);

  if (!replacement) {
    return;
  }

  await tx
    .update(schema.requisites)
    .set({ isDefault: true, updatedAt: sql`now()` })
    .where(eq(schema.requisites.id, replacement.id));
}

async function assertProviderActiveTx(tx: Transaction, providerId: string) {
  const [provider] = await tx
    .select({ id: schema.requisiteProviders.id })
    .from(schema.requisiteProviders)
    .where(
      and(
        eq(schema.requisiteProviders.id, providerId),
        isNull(schema.requisiteProviders.archivedAt),
      ),
    )
    .limit(1);

  if (!provider) {
    throw new RequisiteProviderNotActiveError(providerId);
  }
}

export function createUpdateRequisiteHandler(context: RequisitesServiceContext) {
  const { db, log } = context;

  return async function updateRequisite(
    id: string,
    input: UpdateRequisiteInput,
  ): Promise<Requisite> {
    const validated = UpdateRequisiteInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.requisites)
        .where(and(eq(schema.requisites.id, id), isNull(schema.requisites.archivedAt)))
        .limit(1);

      if (!existing) {
        throw new RequisiteNotFoundError(id);
      }

      const nextProviderId = validated.providerId ?? existing.providerId;
      await assertProviderActiveTx(tx, nextProviderId);

      const nextKind = validated.kind ?? existing.kind;
      const nextCurrencyId = validated.currencyId ?? existing.currencyId;
      const nextIsDefault = validated.isDefault ?? existing.isDefault;

      validateRequisiteFields({
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
        .update(schema.requisites)
        .set({
          providerId: nextProviderId,
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
        .where(eq(schema.requisites.id, id))
        .returning();

      if (!updated) {
        throw new RequisiteNotFoundError(id);
      }

      const ownerId =
        updated.ownerType === "organization" ? updated.organizationId! : updated.counterpartyId!;

      if (nextIsDefault) {
        await clearOtherDefaultsTx(tx, {
          ownerType: updated.ownerType,
          ownerId,
          currencyId: updated.currencyId,
          currentId: updated.id,
        });
      } else if (
        existing.isDefault &&
        (validated.isDefault === false || existing.currencyId !== updated.currencyId)
      ) {
        const previousOwnerId =
          existing.ownerType === "organization"
            ? existing.organizationId!
            : existing.counterpartyId!;
        await promoteNextDefaultTx(tx, {
          ownerType: existing.ownerType,
          ownerId: previousOwnerId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      if (updated.ownerType === "organization") {
        const [binding] = await tx
          .select({
            postingAccountNo: schema.requisiteAccountingBindings.postingAccountNo,
          })
          .from(schema.requisiteAccountingBindings)
          .where(
            eq(
              schema.requisiteAccountingBindings.requisiteId,
              updated.id,
            ),
          )
          .limit(1);

        await ensureRequisiteAccountingBindingTx(tx, {
          requisiteId: updated.id,
          postingAccountNo: binding?.postingAccountNo,
        });
      }

      log.info("Requisite updated", { id });
      return toPublicRequisite(updated);
    });
  };
}

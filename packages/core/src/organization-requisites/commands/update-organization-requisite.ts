import { and, eq, isNull, ne, sql } from "drizzle-orm";

import { isInternalLedgerCounterparty } from "@bedrock/core/counterparties";
import type { Transaction } from "@bedrock/kernel/db/types";

import { ensureOrganizationRequisiteBindingTx } from "../internal/bindings";
import type { OrganizationRequisitesServiceContext } from "../internal/context";
import { schema } from "../schema";
import {
  UpdateOrganizationRequisiteInputSchema,
  validateOrganizationRequisiteFields,
  type OrganizationRequisite,
  type UpdateOrganizationRequisiteInput,
} from "../validation";
import {
  OrganizationRequisiteNotFoundError,
  OrganizationRequisiteOwnerNotInternalError,
} from "../errors";

async function clearOtherDefaultsTx(
  tx: Transaction,
  input: {
    organizationId: string;
    currencyId: string;
    currentId: string;
  },
) {
  await tx
    .update(schema.organizationRequisites)
    .set({ isDefault: false })
    .where(
      and(
        eq(schema.organizationRequisites.organizationId, input.organizationId),
        eq(schema.organizationRequisites.currencyId, input.currencyId),
        isNull(schema.organizationRequisites.archivedAt),
        ne(schema.organizationRequisites.id, input.currentId),
      ),
    );
}

async function promoteNextDefaultTx(
  tx: Transaction,
  input: {
    organizationId: string;
    currencyId: string;
    excludeId: string;
  },
) {
  const [replacement] = await tx
    .select({ id: schema.organizationRequisites.id })
    .from(schema.organizationRequisites)
    .where(
      and(
        eq(schema.organizationRequisites.organizationId, input.organizationId),
        eq(schema.organizationRequisites.currencyId, input.currencyId),
        isNull(schema.organizationRequisites.archivedAt),
        ne(schema.organizationRequisites.id, input.excludeId),
      ),
    )
    .limit(1);

  if (!replacement) {
    return;
  }

  await tx
    .update(schema.organizationRequisites)
    .set({ isDefault: true, updatedAt: sql`now()` })
    .where(eq(schema.organizationRequisites.id, replacement.id));
}

export function createUpdateOrganizationRequisiteHandler(
  context: OrganizationRequisitesServiceContext,
) {
  const { db, log } = context;

  return async function updateOrganizationRequisite(
    id: string,
    input: UpdateOrganizationRequisiteInput,
  ): Promise<OrganizationRequisite> {
    const validated = UpdateOrganizationRequisiteInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.organizationRequisites)
        .where(
          and(
            eq(schema.organizationRequisites.id, id),
            isNull(schema.organizationRequisites.archivedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new OrganizationRequisiteNotFoundError(id);
      }

      if (
        !(await isInternalLedgerCounterparty({
          db: tx,
          counterpartyId: existing.organizationId,
        }))
      ) {
        throw new OrganizationRequisiteOwnerNotInternalError(
          existing.organizationId,
        );
      }

      const nextKind = validated.kind ?? existing.kind;
      const nextCurrencyId = validated.currencyId ?? existing.currencyId;
      const nextIsDefault = validated.isDefault ?? existing.isDefault;

      validateOrganizationRequisiteFields({
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
        .update(schema.organizationRequisites)
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
        .where(eq(schema.organizationRequisites.id, id))
        .returning();

      if (!updated) {
        throw new OrganizationRequisiteNotFoundError(id);
      }

      if (nextIsDefault) {
        await clearOtherDefaultsTx(tx, {
          organizationId: updated.organizationId,
          currencyId: updated.currencyId,
          currentId: updated.id,
        });
      } else if (
        existing.isDefault &&
        (validated.isDefault === false || existing.currencyId !== updated.currencyId)
      ) {
        await promoteNextDefaultTx(tx, {
          organizationId: existing.organizationId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      const [existingBinding] = await tx
        .select({ postingAccountNo: schema.organizationRequisiteBindings.postingAccountNo })
        .from(schema.organizationRequisiteBindings)
        .where(eq(schema.organizationRequisiteBindings.requisiteId, updated.id))
        .limit(1);

      await ensureOrganizationRequisiteBindingTx(tx, {
        requisiteId: updated.id,
        postingAccountNo: existingBinding?.postingAccountNo,
      });

      log.info("Organization requisite updated", { id });
      return updated;
    });
  };
}

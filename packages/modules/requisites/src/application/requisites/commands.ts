import type { Transaction } from "@bedrock/platform/persistence";

import {
  CreateRequisiteInputSchema,
  ListRequisiteOptionsQuerySchema,
  ListRequisitesQuerySchema,
  UpdateRequisiteInputSchema,
  buildRequisiteDisplayLabel,
  validateRequisiteFields,
  type CreateRequisiteInput,
  type ListRequisiteOptionsQuery,
  type ListRequisitesQuery,
  type UpdateRequisiteInput,
} from "../../contracts";
import { resolveCreateRequisiteDefaultFlag, shouldPromoteNextDefault } from "../../domain/default-policy";
import {
  RequisiteNotFoundError,
  RequisiteProviderNotActiveError,
} from "../../errors";
import {
  ensureRequisiteAccountingBindingTx,
} from "../bindings/commands";
import type { RequisitesServiceContext } from "../shared/context";

async function assertOwnerExistsTx(
  context: RequisitesServiceContext,
  input: { ownerType: "organization" | "counterparty"; ownerId: string },
) {
  if (input.ownerType === "organization") {
    await context.owners.assertOrganizationExists(input.ownerId);
    return;
  }

  await context.owners.assertCounterpartyExists(input.ownerId);
}

async function assertProviderActiveTx(
  context: RequisitesServiceContext,
  tx: Transaction,
  providerId: string,
) {
  const provider = await context.requisites.findActiveProviderById(providerId, tx);

  if (!provider) {
    throw new RequisiteProviderNotActiveError(providerId);
  }
}

export function createListRequisitesHandler(context: RequisitesServiceContext) {
  const { requisites } = context;

  return async function listRequisites(input?: ListRequisitesQuery) {
    const query = ListRequisitesQuerySchema.parse(input ?? {});
    return requisites.listRequisites(query);
  };
}

export function createFindRequisiteByIdHandler(context: RequisitesServiceContext) {
  const { requisites } = context;

  return async function findRequisiteById(id: string) {
    const row = await requisites.findActiveRequisiteById(id);

    if (!row) {
      throw new RequisiteNotFoundError(id);
    }

    return row;
  };
}

export function createListRequisiteOptionsHandler(
  context: RequisitesServiceContext,
) {
  const { requisites } = context;

  return async function listRequisiteOptions(input?: ListRequisiteOptionsQuery) {
    const query = ListRequisiteOptionsQuerySchema.parse(input ?? {});
    const rows = await requisites.listRequisiteOptions(query);

    return rows.map((row) => ({
      id: row.id,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      currencyId: row.currencyId,
      providerId: row.providerId,
      kind: row.kind,
      label: buildRequisiteDisplayLabel({
        kind: row.kind,
        label: row.label,
        beneficiaryName: row.beneficiaryName,
        institutionName: row.institutionName,
        institutionCountry: row.institutionCountry,
        accountNo: row.accountNo,
        corrAccount: row.corrAccount,
        iban: row.iban,
        bic: row.bic,
        swift: row.swift,
        bankAddress: row.bankAddress,
        network: row.network,
        assetCode: row.assetCode,
        address: row.address,
        memoTag: row.memoTag,
        accountRef: row.accountRef,
        subaccountRef: row.subaccountRef,
        contact: row.contact,
        notes: row.notes,
        currencyCode: row.currencyCode,
      }),
    }));
  };
}

export function createCreateRequisiteHandler(context: RequisitesServiceContext) {
  const { currencies, db, log, requisites } = context;

  return async function createRequisite(input: CreateRequisiteInput) {
    const validated = CreateRequisiteInputSchema.parse(input);

    validateRequisiteFields({
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

    await currencies.assertCurrencyExists(validated.currencyId);

    return db.transaction(async (tx) => {
      await assertOwnerExistsTx(context, {
        ownerType: validated.ownerType,
        ownerId: validated.ownerId,
      });
      await assertProviderActiveTx(context, tx, validated.providerId);

      const existingActiveCount = await requisites.countActiveRequisitesByOwnerCurrency(
        {
          ownerType: validated.ownerType,
          ownerId: validated.ownerId,
          currencyId: validated.currencyId,
        },
        tx,
      );
      const shouldBeDefault = resolveCreateRequisiteDefaultFlag({
        requestedIsDefault: validated.isDefault,
        existingActiveCount,
      });

      const created = await requisites.insertRequisiteTx(tx, {
        ...validated,
        isDefault: shouldBeDefault,
      });

      if (shouldBeDefault) {
        await requisites.clearOtherDefaultsTx(tx, {
          ownerType: validated.ownerType,
          ownerId: validated.ownerId,
          currencyId: validated.currencyId,
          currentId: created.id,
        });
      }

      if (validated.ownerType === "organization") {
        await ensureRequisiteAccountingBindingTx(
          context,
          tx,
          {
            requisiteId: created.id,
            organizationId: validated.ownerId,
            currencyId: validated.currencyId,
          },
        );
      }

      log.info("Requisite created", {
        id: created.id,
        ownerType: created.ownerType,
      });

      return created;
    });
  };
}

export function createUpdateRequisiteHandler(context: RequisitesServiceContext) {
  const { currencies, db, log, requisites } = context;

  return async function updateRequisite(id: string, input: UpdateRequisiteInput) {
    const validated = UpdateRequisiteInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const existing = await requisites.findActiveRequisiteById(id, tx);

      if (!existing) {
        throw new RequisiteNotFoundError(id);
      }

      const nextProviderId = validated.providerId ?? existing.providerId;
      const nextCurrencyId = validated.currencyId ?? existing.currencyId;
      const nextKind = validated.kind ?? existing.kind;
      const nextIsDefault = validated.isDefault ?? existing.isDefault;

      await currencies.assertCurrencyExists(nextCurrencyId);
      await assertProviderActiveTx(context, tx, nextProviderId);

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

      const updated = await requisites.updateRequisiteTx(tx, id, {
        ...validated,
        providerId: nextProviderId,
        currencyId: nextCurrencyId,
        kind: nextKind,
        isDefault: nextIsDefault,
      });

      if (!updated) {
        throw new RequisiteNotFoundError(id);
      }

      if (nextIsDefault) {
        await requisites.clearOtherDefaultsTx(tx, {
          ownerType: updated.ownerType,
          ownerId: updated.ownerId,
          currencyId: updated.currencyId,
          currentId: updated.id,
        });
      } else if (
        shouldPromoteNextDefault({
          wasDefault: existing.isDefault,
          nextIsDefault,
          currencyChanged: existing.currencyId !== updated.currencyId,
        })
      ) {
        await requisites.promoteNextDefaultTx(tx, {
          ownerType: existing.ownerType,
          ownerId: existing.ownerId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      if (updated.ownerType === "organization") {
        const binding = await requisites.findBindingByRequisiteId(updated.id, tx);
        await ensureRequisiteAccountingBindingTx(
          context,
          tx,
          {
            requisiteId: updated.id,
            organizationId: updated.ownerId,
            currencyId: updated.currencyId,
            postingAccountNo: binding?.postingAccountNo,
          },
        );
      }

      log.info("Requisite updated", { id });
      return updated;
    });
  };
}

export function createRemoveRequisiteHandler(context: RequisitesServiceContext) {
  const { db, log, requisites } = context;

  return async function removeRequisite(id: string) {
    return db.transaction(async (tx) => {
      const existing = await requisites.findActiveRequisiteById(id, tx);

      if (!existing) {
        throw new RequisiteNotFoundError(id);
      }

      await requisites.archiveRequisiteTx(tx, id);

      if (existing.isDefault) {
        await requisites.promoteNextDefaultTx(tx, {
          ownerType: existing.ownerType,
          ownerId: existing.ownerId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      log.info("Requisite archived", { id });
      return { ok: true as const };
    });
  };
}

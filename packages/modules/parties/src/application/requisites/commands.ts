import {
  buildRequisiteDisplayLabel,
  resolveCreateRequisiteDefaultFlag,
  shouldPromoteNextDefault,
  validateRequisiteFields,
} from "@bedrock/shared/requisites";

import {
  CreateCounterpartyRequisiteInputSchema,
  ListCounterpartyRequisiteOptionsQuerySchema,
  ListCounterpartyRequisitesQuerySchema,
  UpdateCounterpartyRequisiteInputSchema,
  type CreateCounterpartyRequisiteInput,
  type ListCounterpartyRequisiteOptionsQuery,
  type ListCounterpartyRequisitesQuery,
  type UpdateCounterpartyRequisiteInput,
} from "../../contracts";
import {
  CounterpartyNotFoundError,
  CounterpartyRequisiteNotFoundError,
} from "../../errors";
import type { PartiesServiceContext } from "../shared/context";

async function assertCounterpartyExists(
  context: PartiesServiceContext,
  counterpartyId: string,
) {
  const counterparty = await context.parties.findCounterpartyById(counterpartyId);

  if (!counterparty) {
    throw new CounterpartyNotFoundError(counterpartyId);
  }
}

export function createListCounterpartyRequisitesHandler(
  context: PartiesServiceContext,
) {
  const { requisites } = context;

  return async function listCounterpartyRequisites(
    input?: ListCounterpartyRequisitesQuery,
  ) {
    const query = ListCounterpartyRequisitesQuerySchema.parse(input ?? {});
    return requisites.listRequisites(query);
  };
}

export function createFindCounterpartyRequisiteByIdHandler(
  context: PartiesServiceContext,
) {
  const { requisites } = context;

  return async function findCounterpartyRequisiteById(id: string) {
    const row = await requisites.findActiveRequisiteById(id);

    if (!row) {
      throw new CounterpartyRequisiteNotFoundError(id);
    }

    return row;
  };
}

export function createListCounterpartyRequisiteOptionsHandler(
  context: PartiesServiceContext,
) {
  const { requisites } = context;

  return async function listCounterpartyRequisiteOptions(
    input?: ListCounterpartyRequisiteOptionsQuery,
  ) {
    const query = ListCounterpartyRequisiteOptionsQuerySchema.parse(input ?? {});
    const rows = await requisites.listRequisiteOptions(query);

    return rows.map((row) => ({
      id: row.id,
      ownerType: "counterparty" as const,
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

export function createCreateCounterpartyRequisiteHandler(
  context: PartiesServiceContext,
) {
  const { currencies, db, log, requisites, requisiteProviders } = context;

  return async function createCounterpartyRequisite(
    input: CreateCounterpartyRequisiteInput,
  ) {
    const validated = CreateCounterpartyRequisiteInputSchema.parse(input);

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

    await Promise.all([
      assertCounterpartyExists(context, validated.counterpartyId),
      currencies.assertCurrencyExists(validated.currencyId),
      requisiteProviders.assertProviderActive(validated.providerId),
    ]);

    return db.transaction(async (tx) => {
      const existingActiveCount =
        await requisites.countActiveRequisitesByCounterpartyCurrency(
          {
            counterpartyId: validated.counterpartyId,
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
          counterpartyId: validated.counterpartyId,
          currencyId: validated.currencyId,
          currentId: created.id,
        });
      }

      log.info("Counterparty requisite created", {
        id: created.id,
        counterpartyId: created.ownerId,
      });

      return created;
    });
  };
}

export function createUpdateCounterpartyRequisiteHandler(
  context: PartiesServiceContext,
) {
  const { currencies, db, log, requisites, requisiteProviders } = context;

  return async function updateCounterpartyRequisite(
    id: string,
    input: UpdateCounterpartyRequisiteInput,
  ) {
    const validated = UpdateCounterpartyRequisiteInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const existing = await requisites.findActiveRequisiteById(id, tx);

      if (!existing) {
        throw new CounterpartyRequisiteNotFoundError(id);
      }

      const nextProviderId = validated.providerId ?? existing.providerId;
      const nextCurrencyId = validated.currencyId ?? existing.currencyId;
      const nextKind = validated.kind ?? existing.kind;
      const nextIsDefault = validated.isDefault ?? existing.isDefault;

      await Promise.all([
        currencies.assertCurrencyExists(nextCurrencyId),
        requisiteProviders.assertProviderActive(nextProviderId),
      ]);

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
        throw new CounterpartyRequisiteNotFoundError(id);
      }

      if (nextIsDefault) {
        await requisites.clearOtherDefaultsTx(tx, {
          counterpartyId: updated.ownerId,
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
          counterpartyId: existing.ownerId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      log.info("Counterparty requisite updated", { id });
      return updated;
    });
  };
}

export function createRemoveCounterpartyRequisiteHandler(
  context: PartiesServiceContext,
) {
  const { db, log, requisites } = context;

  return async function removeCounterpartyRequisite(id: string) {
    return db.transaction(async (tx) => {
      const existing = await requisites.findActiveRequisiteById(id, tx);

      if (!existing) {
        throw new CounterpartyRequisiteNotFoundError(id);
      }

      await requisites.archiveRequisiteTx(tx, id);

      if (existing.isDefault) {
        await requisites.promoteNextDefaultTx(tx, {
          counterpartyId: existing.ownerId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      log.info("Counterparty requisite archived", { id });
      return { ok: true as const };
    });
  };
}

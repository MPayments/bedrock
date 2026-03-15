import {
  buildRequisiteDisplayLabel,
  resolveCreateRequisiteDefaultFlag,
  shouldPromoteNextDefault,
  validateRequisiteFields,
} from "@bedrock/shared/requisites";

import {
  CreateOrganizationRequisiteInputSchema,
  ListOrganizationRequisiteOptionsQuerySchema,
  ListOrganizationRequisitesQuerySchema,
  UpdateOrganizationRequisiteInputSchema,
  type CreateOrganizationRequisiteInput,
  type ListOrganizationRequisiteOptionsQuery,
  type ListOrganizationRequisitesQuery,
  type UpdateOrganizationRequisiteInput,
} from "../../contracts";
import {
  OrganizationNotFoundError,
  OrganizationRequisiteNotFoundError,
} from "../../errors";
import {
  ensureOrganizationRequisiteAccountingBindingTx,
} from "./bindings";
import type { OrganizationsServiceContext } from "../shared/context";

async function assertOrganizationExists(
  context: OrganizationsServiceContext,
  organizationId: string,
) {
  const organization = await context.organizations.findOrganizationById(organizationId);

  if (!organization) {
    throw new OrganizationNotFoundError(organizationId);
  }
}

export function createListOrganizationRequisitesHandler(
  context: OrganizationsServiceContext,
) {
  const { requisites } = context;

  return async function listOrganizationRequisites(
    input?: ListOrganizationRequisitesQuery,
  ) {
    const query = ListOrganizationRequisitesQuerySchema.parse(input ?? {});
    return requisites.listRequisites(query);
  };
}

export function createFindOrganizationRequisiteByIdHandler(
  context: OrganizationsServiceContext,
) {
  const { requisites } = context;

  return async function findOrganizationRequisiteById(id: string) {
    const row = await requisites.findActiveRequisiteById(id);

    if (!row) {
      throw new OrganizationRequisiteNotFoundError(id);
    }

    return row;
  };
}

export function createListOrganizationRequisiteOptionsHandler(
  context: OrganizationsServiceContext,
) {
  const { requisites } = context;

  return async function listOrganizationRequisiteOptions(
    input?: ListOrganizationRequisiteOptionsQuery,
  ) {
    const query = ListOrganizationRequisiteOptionsQuerySchema.parse(input ?? {});
    const rows = await requisites.listRequisiteOptions(query);

    return rows.map((row) => ({
      id: row.id,
      ownerType: "organization" as const,
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

export function createCreateOrganizationRequisiteHandler(
  context: OrganizationsServiceContext,
) {
  const { currencies, db, log, requisites, requisiteProviders } = context;

  return async function createOrganizationRequisite(
    input: CreateOrganizationRequisiteInput,
  ) {
    const validated = CreateOrganizationRequisiteInputSchema.parse(input);

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
      assertOrganizationExists(context, validated.organizationId),
      currencies.assertCurrencyExists(validated.currencyId),
      requisiteProviders.assertProviderActive(validated.providerId),
    ]);

    return db.transaction(async (tx) => {
      const existingActiveCount =
        await requisites.countActiveRequisitesByOrganizationCurrency(
          {
            organizationId: validated.organizationId,
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
          organizationId: validated.organizationId,
          currencyId: validated.currencyId,
          currentId: created.id,
        });
      }

      await ensureOrganizationRequisiteAccountingBindingTx(context, tx, {
        requisiteId: created.id,
        organizationId: validated.organizationId,
        currencyId: validated.currencyId,
      });

      log.info("Organization requisite created", {
        id: created.id,
        organizationId: created.ownerId,
      });

      return created;
    });
  };
}

export function createUpdateOrganizationRequisiteHandler(
  context: OrganizationsServiceContext,
) {
  const { currencies, db, log, requisites, requisiteProviders } = context;

  return async function updateOrganizationRequisite(
    id: string,
    input: UpdateOrganizationRequisiteInput,
  ) {
    const validated = UpdateOrganizationRequisiteInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const existing = await requisites.findActiveRequisiteById(id, tx);

      if (!existing) {
        throw new OrganizationRequisiteNotFoundError(id);
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
        throw new OrganizationRequisiteNotFoundError(id);
      }

      if (nextIsDefault) {
        await requisites.clearOtherDefaultsTx(tx, {
          organizationId: updated.ownerId,
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
          organizationId: existing.ownerId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      const binding = await requisites.findBindingByRequisiteId(updated.id, tx);
      await ensureOrganizationRequisiteAccountingBindingTx(context, tx, {
        requisiteId: updated.id,
        organizationId: updated.ownerId,
        currencyId: updated.currencyId,
        postingAccountNo: binding?.postingAccountNo,
      });

      log.info("Organization requisite updated", { id });
      return updated;
    });
  };
}

export function createRemoveOrganizationRequisiteHandler(
  context: OrganizationsServiceContext,
) {
  const { db, log, requisites } = context;

  return async function removeOrganizationRequisite(id: string) {
    return db.transaction(async (tx) => {
      const existing = await requisites.findActiveRequisiteById(id, tx);

      if (!existing) {
        throw new OrganizationRequisiteNotFoundError(id);
      }

      await requisites.archiveRequisiteTx(tx, id);

      if (existing.isDefault) {
        await requisites.promoteNextDefaultTx(tx, {
          organizationId: existing.ownerId,
          currencyId: existing.currencyId,
          excludeId: existing.id,
        });
      }

      log.info("Organization requisite archived", { id });
      return { ok: true as const };
    });
  };
}

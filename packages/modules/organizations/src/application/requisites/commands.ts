import { randomUUID } from "node:crypto";

import { ensureOrganizationRequisiteAccountingBindingTx } from "./bindings";
import { resolveOrganizationRequisiteUpdateInput } from "./inputs";
import type {
  CreateOrganizationRequisiteInput,
  OrganizationRequisite as OrganizationRequisiteDto,
  UpdateOrganizationRequisiteInput,
} from "../../contracts";
import {
  CreateOrganizationRequisiteInputSchema,
  UpdateOrganizationRequisiteInputSchema,
} from "../../contracts";
import { OrganizationRequisite } from "../../domain/organization-requisite";
import { OrganizationRequisiteSet } from "../../domain/organization-requisite-set";
import {
  OrganizationNotFoundError,
  OrganizationRequisiteNotFoundError,
} from "../../errors";
import type { OrganizationsServiceContext } from "../shared/context";
import { rethrowOrganizationRequisiteDomainError } from "../shared/map-domain-error";

async function assertOrganizationExists(
  context: OrganizationsServiceContext,
  organizationId: string,
) {
  const organization =
    await context.organizationQueries.findOrganizationById(organizationId);

  if (!organization) {
    throw new OrganizationNotFoundError(organizationId);
  }
}

function toPublicRequisite(
  requisite: OrganizationRequisite,
): OrganizationRequisiteDto {
  const snapshot = requisite.toSnapshot();

  return {
    id: snapshot.id,
    ownerType: "organization",
    ownerId: snapshot.organizationId,
    providerId: snapshot.providerId,
    currencyId: snapshot.currencyId,
    kind: snapshot.kind,
    label: snapshot.label,
    description: snapshot.description,
    beneficiaryName: snapshot.beneficiaryName,
    institutionName: snapshot.institutionName,
    institutionCountry: snapshot.institutionCountry,
    accountNo: snapshot.accountNo,
    corrAccount: snapshot.corrAccount,
    iban: snapshot.iban,
    bic: snapshot.bic,
    swift: snapshot.swift,
    bankAddress: snapshot.bankAddress,
    network: snapshot.network,
    assetCode: snapshot.assetCode,
    address: snapshot.address,
    memoTag: snapshot.memoTag,
    accountRef: snapshot.accountRef,
    subaccountRef: snapshot.subaccountRef,
    contact: snapshot.contact,
    notes: snapshot.notes,
    isDefault: snapshot.isDefault,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    archivedAt: snapshot.archivedAt,
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

    await Promise.all([
      assertOrganizationExists(context, validated.organizationId),
      currencies.assertCurrencyExists(validated.currencyId),
      requisiteProviders.assertProviderActive(validated.providerId),
    ]);

    try {
      return await db.transaction(async (tx) => {
        const requisiteId = randomUUID();
        const activeSnapshots =
          await requisites.listActiveRequisitesByOrganizationCurrency(
            {
              organizationId: validated.organizationId,
              currencyId: validated.currencyId,
            },
            tx,
          );
        const activeSet = OrganizationRequisiteSet.reconstitute({
          organizationId: validated.organizationId,
          currencyId: validated.currencyId,
          requisites: activeSnapshots,
        });
        const createPlan = activeSet.planCreate(
          requisiteId,
          validated.isDefault,
        );

        if (createPlan.candidateIsDefault && createPlan.demotedIds.length > 0) {
          await requisites.setDefaultStateTx(tx, {
            organizationId: validated.organizationId,
            currencyId: validated.currencyId,
            defaultId: null,
            demotedIds: createPlan.demotedIds,
          });
        }

        const created = OrganizationRequisite.reconstitute(
          await requisites.insertRequisiteTx(
            tx,
            OrganizationRequisite.create(
              {
                id: requisiteId,
                organizationId: validated.organizationId,
                providerId: validated.providerId,
                currencyId: validated.currencyId,
                label: validated.label,
                kind: validated.kind,
                description: validated.description,
                beneficiaryName: validated.beneficiaryName,
                institutionName: validated.institutionName,
                institutionCountry: validated.institutionCountry,
                accountNo: validated.accountNo,
                corrAccount: validated.corrAccount,
                iban: validated.iban,
                bic: validated.bic,
                swift: validated.swift,
                bankAddress: validated.bankAddress,
                network: validated.network,
                assetCode: validated.assetCode,
                address: validated.address,
                memoTag: validated.memoTag,
                accountRef: validated.accountRef,
                subaccountRef: validated.subaccountRef,
                contact: validated.contact,
                notes: validated.notes,
                isDefault: createPlan.candidateIsDefault,
              },
              context.now(),
            ).toSnapshot(),
          ),
        );

        await ensureOrganizationRequisiteAccountingBindingTx(context, tx, {
          requisiteId: created.id,
          organizationId: validated.organizationId,
          currencyId: validated.currencyId,
        });

        log.info("Organization requisite created", {
          id: created.id,
          organizationId: created.toSnapshot().organizationId,
        });

        return toPublicRequisite(created);
      });
    } catch (error) {
      rethrowOrganizationRequisiteDomainError(error);
    }
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

    try {
      return await db.transaction(async (tx) => {
        const existingSnapshot =
          await requisites.findActiveRequisiteSnapshotById(id, tx);

        if (!existingSnapshot) {
          throw new OrganizationRequisiteNotFoundError(id);
        }

        const existing = OrganizationRequisite.reconstitute(existingSnapshot);
        const current = existing.toSnapshot();
        const resolvedInput = resolveOrganizationRequisiteUpdateInput(
          current,
          validated,
        );
        const nextProviderId = resolvedInput.providerId;
        const nextCurrencyId = resolvedInput.currencyId;
        const nextIsDefault = resolvedInput.isDefault;
        const currencyChanged = nextCurrencyId !== current.currencyId;

        await Promise.all([
          currencies.assertCurrencyExists(nextCurrencyId),
          requisiteProviders.assertProviderActive(nextProviderId),
        ]);

        const sourceSet = OrganizationRequisiteSet.reconstitute({
          organizationId: current.organizationId,
          currencyId: current.currencyId,
          requisites:
            await requisites.listActiveRequisitesByOrganizationCurrency(
              {
                organizationId: current.organizationId,
                currencyId: current.currencyId,
              },
              tx,
            ),
        });
        const targetSet = currencyChanged
          ? OrganizationRequisiteSet.reconstitute({
              organizationId: current.organizationId,
              currencyId: nextCurrencyId,
              requisites:
                await requisites.listActiveRequisitesByOrganizationCurrency(
                  {
                    organizationId: current.organizationId,
                    currencyId: nextCurrencyId,
                  },
                  tx,
                ),
            })
          : sourceSet;

        if (currencyChanged && nextIsDefault) {
          const transferPlan = targetSet.planTransferIn({ nextIsDefault });

          if (transferPlan.demotedIds.length > 0) {
            await requisites.setDefaultStateTx(tx, {
              organizationId: current.organizationId,
              currencyId: nextCurrencyId,
              defaultId: null,
              demotedIds: transferPlan.demotedIds,
            });
          }
        }

        if (!currencyChanged && nextIsDefault) {
          const updatePlan = sourceSet.planUpdate({
            requisiteId: id,
            nextIsDefault,
          });

          if (updatePlan.demotedIds.length > 0) {
            await requisites.setDefaultStateTx(tx, {
              organizationId: current.organizationId,
              currencyId: current.currencyId,
              defaultId: null,
              demotedIds: updatePlan.demotedIds,
            });
          }
        }

        const next = existing.update(resolvedInput, context.now());

        const persistedSnapshot = existing.sameState(next)
          ? existingSnapshot
          : await requisites.updateRequisiteTx(tx, next.toSnapshot());

        if (!persistedSnapshot) {
          throw new OrganizationRequisiteNotFoundError(id);
        }

        if (currencyChanged) {
          const sourcePlan = sourceSet.planTransferOut(id);

          if (sourcePlan.promotedId) {
            await requisites.setDefaultStateTx(tx, {
              organizationId: current.organizationId,
              currencyId: current.currencyId,
              defaultId: sourcePlan.promotedId,
              demotedIds: [],
            });
          }
        } else if (!nextIsDefault) {
          const updatePlan = sourceSet.planUpdate({
            requisiteId: id,
            nextIsDefault,
          });

          if (updatePlan.promotedId) {
            await requisites.setDefaultStateTx(tx, {
              organizationId: current.organizationId,
              currencyId: current.currencyId,
              defaultId: updatePlan.promotedId,
              demotedIds: [],
            });
          }
        }

        const persisted = OrganizationRequisite.reconstitute(persistedSnapshot);
        const binding = await requisites.findBindingByRequisiteId(id, tx);

        await ensureOrganizationRequisiteAccountingBindingTx(context, tx, {
          requisiteId: persisted.id,
          organizationId: persisted.toSnapshot().organizationId,
          currencyId: persisted.toSnapshot().currencyId,
          ...(binding?.postingAccountNo !== undefined && {
            postingAccountNo: binding.postingAccountNo,
          }),
        });

        log.info("Organization requisite updated", { id });
        return toPublicRequisite(persisted);
      });
    } catch (error) {
      rethrowOrganizationRequisiteDomainError(error);
    }
  };
}

export function createRemoveOrganizationRequisiteHandler(
  context: OrganizationsServiceContext,
) {
  const { db, log, requisites } = context;

  return async function removeOrganizationRequisite(id: string) {
    try {
      return await db.transaction(async (tx) => {
        const existingSnapshot =
          await requisites.findActiveRequisiteSnapshotById(id, tx);

        if (!existingSnapshot) {
          throw new OrganizationRequisiteNotFoundError(id);
        }

        const existing = OrganizationRequisite.reconstitute(existingSnapshot);
        const snapshot = existing.toSnapshot();
        const activeSet = OrganizationRequisiteSet.reconstitute({
          organizationId: snapshot.organizationId,
          currencyId: snapshot.currencyId,
          requisites:
            await requisites.listActiveRequisitesByOrganizationCurrency(
              {
                organizationId: snapshot.organizationId,
                currencyId: snapshot.currencyId,
              },
              tx,
            ),
        });
        const archivePlan = activeSet.planArchive(id);
        const archived = existing.archive(context.now());

        await requisites.archiveRequisiteTx(tx, {
          requisiteId: id,
          archivedAt: archived.toSnapshot().archivedAt!,
        });

        if (archivePlan.promotedId) {
          await requisites.setDefaultStateTx(tx, {
            organizationId: snapshot.organizationId,
            currencyId: snapshot.currencyId,
            defaultId: archivePlan.promotedId,
            demotedIds: [],
          });
        }

        log.info("Organization requisite archived", { id });
        return { ok: true as const };
      });
    } catch (error) {
      rethrowOrganizationRequisiteDomainError(error);
    }
  };
}

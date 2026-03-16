import { randomUUID } from "node:crypto";

import {
  resolveCreateRequisiteProps,
  resolveRequisiteUpdateInput,
} from "./inputs";
import type {
  CreateRequisiteInput,
  Requisite as RequisiteDto,
  UpdateRequisiteInput,
} from "../../contracts";
import {
  CreateRequisiteInputSchema,
  UpdateRequisiteInputSchema,
} from "../../contracts";
import { RequisiteOwner } from "../../domain/owner";
import { Requisite } from "../../domain/requisite";
import { RequisiteSet } from "../../domain/requisite-set";
import {
  RequisiteNotFoundError,
  RequisiteProviderNotActiveError,
} from "../../errors";
import type { RequisitesServiceContext } from "../shared/context";

async function assertOwnerExists(
  context: RequisitesServiceContext,
  owner: RequisiteOwner,
) {
  if (owner.isOrganization()) {
    await context.owners.assertOrganizationExists(owner.id);
    return;
  }

  await context.owners.assertCounterpartyExists(owner.id);
}

async function assertProviderActive(
  context: RequisitesServiceContext,
  providerId: string,
) {
  const provider =
    await context.providerQueries.findActiveProviderById(providerId);

  if (!provider) {
    throw new RequisiteProviderNotActiveError(providerId);
  }
}

function toPublicRequisite(requisite: Requisite): RequisiteDto {
  const snapshot = requisite.toSnapshot();

  return {
    id: snapshot.id,
    ownerType: snapshot.ownerType,
    ownerId: snapshot.ownerId,
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

export function createCreateRequisiteHandler(
  context: RequisitesServiceContext,
) {
  const { currencies, log, requisiteCommands, runInTransaction } = context;

  return async function createRequisite(input: CreateRequisiteInput) {
    const validated = CreateRequisiteInputSchema.parse(input);
    const owner = RequisiteOwner.create({
      type: validated.ownerType,
      id: validated.ownerId,
    });

    await Promise.all([
      assertOwnerExists(context, owner),
      currencies.assertCurrencyExists(validated.currencyId),
      assertProviderActive(context, validated.providerId),
    ]);

    return runInTransaction(async (tx) => {
      const requisiteId = randomUUID();
      const activeSnapshots =
        await requisiteCommands.listActiveRequisitesByOwnerCurrency(
          {
            ownerType: owner.type,
            ownerId: owner.id,
            currencyId: validated.currencyId,
          },
          tx,
        );
      const activeSet = RequisiteSet.fromSnapshot({
        ownerType: owner.type,
        ownerId: owner.id,
        currencyId: validated.currencyId,
        requisites: activeSnapshots,
      });
      const createPlan = activeSet.planCreate(requisiteId, validated.isDefault);

      if (createPlan.candidateIsDefault && createPlan.demotedIds.length > 0) {
        await requisiteCommands.setDefaultState(
          {
            ownerType: owner.type,
            ownerId: owner.id,
            currencyId: validated.currencyId,
            defaultId: null,
            demotedIds: createPlan.demotedIds,
          },
          tx,
        );
      }

      const created = Requisite.fromSnapshot(
        await requisiteCommands.insertRequisite(
          Requisite.create(
            resolveCreateRequisiteProps({
              id: requisiteId,
              ownerType: owner.type,
              ownerId: owner.id,
              values: validated,
              isDefault: createPlan.candidateIsDefault,
            }),
            context.now(),
          ).toSnapshot(),
          tx,
        ),
      );

      log.info("Requisite created", {
        id: created.id,
        ownerType: owner.type,
        ownerId: owner.id,
      });

      return toPublicRequisite(created);
    });
  };
}

export function createUpdateRequisiteHandler(
  context: RequisitesServiceContext,
) {
  const { currencies, log, requisiteCommands, runInTransaction } = context;

  return async function updateRequisite(
    id: string,
    input: UpdateRequisiteInput,
  ) {
    const validated = UpdateRequisiteInputSchema.parse(input);

    return runInTransaction(async (tx) => {
      const existingSnapshot =
        await requisiteCommands.findActiveRequisiteSnapshotById(id, tx);

      if (!existingSnapshot) {
        throw new RequisiteNotFoundError(id);
      }

      const existing = Requisite.fromSnapshot(existingSnapshot);
      const current = existing.toSnapshot();
      const nextInput = resolveRequisiteUpdateInput(current, validated);
      const currencyChanged = nextInput.currencyId !== current.currencyId;

      await Promise.all([
        currencies.assertCurrencyExists(nextInput.currencyId),
        assertProviderActive(context, nextInput.providerId),
      ]);

      const sourceSet = RequisiteSet.fromSnapshot({
        ownerType: current.ownerType,
        ownerId: current.ownerId,
        currencyId: current.currencyId,
        requisites: await requisiteCommands.listActiveRequisitesByOwnerCurrency(
          {
            ownerType: current.ownerType,
            ownerId: current.ownerId,
            currencyId: current.currencyId,
          },
          tx,
        ),
      });
      const targetSet = currencyChanged
        ? RequisiteSet.fromSnapshot({
            ownerType: current.ownerType,
            ownerId: current.ownerId,
            currencyId: nextInput.currencyId,
            requisites:
              await requisiteCommands.listActiveRequisitesByOwnerCurrency(
                {
                  ownerType: current.ownerType,
                  ownerId: current.ownerId,
                  currencyId: nextInput.currencyId,
                },
                tx,
              ),
          })
        : sourceSet;

      if (currencyChanged && nextInput.isDefault) {
        const transferPlan = targetSet.planTransferIn({
          nextIsDefault: nextInput.isDefault,
        });

        if (transferPlan.demotedIds.length > 0) {
          await requisiteCommands.setDefaultState(
            {
              ownerType: current.ownerType,
              ownerId: current.ownerId,
              currencyId: nextInput.currencyId,
              defaultId: null,
              demotedIds: transferPlan.demotedIds,
            },
            tx,
          );
        }
      }

      if (!currencyChanged && nextInput.isDefault) {
        const updatePlan = sourceSet.planUpdate({
          requisiteId: id,
          nextIsDefault: nextInput.isDefault,
        });

        if (updatePlan.demotedIds.length > 0) {
          await requisiteCommands.setDefaultState(
            {
              ownerType: current.ownerType,
              ownerId: current.ownerId,
              currencyId: current.currencyId,
              defaultId: null,
              demotedIds: updatePlan.demotedIds,
            },
            tx,
          );
        }
      }

      const next = existing.update(nextInput, context.now());
      const persistedSnapshot = existing.sameState(next)
        ? existingSnapshot
        : await requisiteCommands.updateRequisite(next.toSnapshot(), tx);

      if (!persistedSnapshot) {
        throw new RequisiteNotFoundError(id);
      }

      if (currencyChanged) {
        const sourcePlan = sourceSet.planTransferOut(id);

        if (sourcePlan.promotedId) {
          await requisiteCommands.setDefaultState(
            {
              ownerType: current.ownerType,
              ownerId: current.ownerId,
              currencyId: current.currencyId,
              defaultId: sourcePlan.promotedId,
              demotedIds: [],
            },
            tx,
          );
        }
      } else if (!nextInput.isDefault) {
        const updatePlan = sourceSet.planUpdate({
          requisiteId: id,
          nextIsDefault: nextInput.isDefault,
        });

        if (updatePlan.promotedId) {
          await requisiteCommands.setDefaultState(
            {
              ownerType: current.ownerType,
              ownerId: current.ownerId,
              currencyId: current.currencyId,
              defaultId: updatePlan.promotedId,
              demotedIds: [],
            },
            tx,
          );
        }
      }

      const updated = Requisite.fromSnapshot(persistedSnapshot);

      log.info("Requisite updated", {
        id,
        ownerType: current.ownerType,
        ownerId: current.ownerId,
      });

      return toPublicRequisite(updated);
    });
  };
}

export function createRemoveRequisiteHandler(
  context: RequisitesServiceContext,
) {
  const { log, requisiteCommands, runInTransaction } = context;

  return async function removeRequisite(id: string) {
    return runInTransaction(async (tx) => {
      const existingSnapshot =
        await requisiteCommands.findActiveRequisiteSnapshotById(id, tx);

      if (!existingSnapshot) {
        throw new RequisiteNotFoundError(id);
      }

      const current = Requisite.fromSnapshot(existingSnapshot).toSnapshot();
      const sourceSet = RequisiteSet.fromSnapshot({
        ownerType: current.ownerType,
        ownerId: current.ownerId,
        currencyId: current.currencyId,
        requisites: await requisiteCommands.listActiveRequisitesByOwnerCurrency(
          {
            ownerType: current.ownerType,
            ownerId: current.ownerId,
            currencyId: current.currencyId,
          },
          tx,
        ),
      });
      const archivePlan = sourceSet.planArchive(id);

      await requisiteCommands.archiveRequisite(
        {
          requisiteId: id,
          archivedAt: context.now(),
        },
        tx,
      );

      if (archivePlan.promotedId) {
        await requisiteCommands.setDefaultState(
          {
            ownerType: current.ownerType,
            ownerId: current.ownerId,
            currencyId: current.currencyId,
            defaultId: archivePlan.promotedId,
            demotedIds: [],
          },
          tx,
        );
      }

      log.info("Requisite archived", {
        id,
        ownerType: current.ownerType,
        ownerId: current.ownerId,
      });

      return { ok: true as const };
    });
  };
}

import { randomUUID } from "node:crypto";

import type {
  CreateCounterpartyRequisiteInput,
  CounterpartyRequisite as CounterpartyRequisiteDto,
  UpdateCounterpartyRequisiteInput,
} from "../../contracts";
import {
  CreateCounterpartyRequisiteInputSchema,
  UpdateCounterpartyRequisiteInputSchema,
} from "../../contracts";
import { CounterpartyRequisite } from "../../domain/counterparty-requisite";
import { CounterpartyRequisiteSet } from "../../domain/counterparty-requisite-set";
import {
  CounterpartyNotFoundError,
  CounterpartyRequisiteNotFoundError,
} from "../../errors";
import {
  resolveCreateCounterpartyRequisiteProps,
  resolveUpdateCounterpartyRequisiteProps,
} from "./inputs";
import type { PartiesServiceContext } from "../shared/context";

async function assertCounterpartyExists(
  context: PartiesServiceContext,
  counterpartyId: string,
) {
  const counterparty =
    await context.counterpartyQueries.findCounterpartyById(counterpartyId);

  if (!counterparty) {
    throw new CounterpartyNotFoundError(counterpartyId);
  }
}

function toPublicRequisite(
  requisite: CounterpartyRequisite,
): CounterpartyRequisiteDto {
  const snapshot = requisite.toSnapshot();

  return {
    id: snapshot.id,
    ownerType: "counterparty",
    ownerId: snapshot.counterpartyId,
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

export function createCreateCounterpartyRequisiteHandler(
  context: PartiesServiceContext,
) {
  const { currencies, db, log, requisites, requisiteProviders } = context;

  return async function createCounterpartyRequisite(
    input: CreateCounterpartyRequisiteInput,
  ) {
    const validated = CreateCounterpartyRequisiteInputSchema.parse(input);

    await Promise.all([
      assertCounterpartyExists(context, validated.counterpartyId),
      currencies.assertCurrencyExists(validated.currencyId),
      requisiteProviders.assertProviderActive(validated.providerId),
    ]);

    return db.transaction(async (tx) => {
      const requisiteId = randomUUID();
      const activeSnapshots =
        await requisites.listActiveRequisitesByCounterpartyCurrency(
          {
            counterpartyId: validated.counterpartyId,
            currencyId: validated.currencyId,
          },
          tx,
        );
      const activeSet = CounterpartyRequisiteSet.reconstitute({
        counterpartyId: validated.counterpartyId,
        currencyId: validated.currencyId,
        requisites: activeSnapshots,
      });
      const createPlan = activeSet.planCreate(requisiteId, validated.isDefault);

      if (createPlan.candidateIsDefault && createPlan.demotedIds.length > 0) {
        await requisites.setDefaultStateTx(tx, {
          counterpartyId: validated.counterpartyId,
          currencyId: validated.currencyId,
          defaultId: null,
          demotedIds: createPlan.demotedIds,
        });
      }

      const created = CounterpartyRequisite.reconstitute(
        await requisites.insertRequisiteTx(
          tx,
          CounterpartyRequisite.create(
            resolveCreateCounterpartyRequisiteProps({
              id: requisiteId,
              values: validated,
              isDefault: createPlan.candidateIsDefault,
            }),
            context.now(),
          ).toSnapshot(),
        ),
      );

      log.info("Counterparty requisite created", {
        id: created.id,
        counterpartyId: created.toSnapshot().counterpartyId,
      });

      return toPublicRequisite(created);
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
      const existingSnapshot = await requisites.findActiveRequisiteSnapshotById(
        id,
        tx,
      );

      if (!existingSnapshot) {
        throw new CounterpartyRequisiteNotFoundError(id);
      }

      const existing = CounterpartyRequisite.reconstitute(existingSnapshot);
      const current = existing.toSnapshot();
      const nextInput = resolveUpdateCounterpartyRequisiteProps(
        current,
        validated,
      );
      const currencyChanged = nextInput.currencyId !== current.currencyId;

      await Promise.all([
        currencies.assertCurrencyExists(nextInput.currencyId),
        requisiteProviders.assertProviderActive(nextInput.providerId),
      ]);

      const sourceSet = CounterpartyRequisiteSet.reconstitute({
        counterpartyId: current.counterpartyId,
        currencyId: current.currencyId,
        requisites: await requisites.listActiveRequisitesByCounterpartyCurrency(
          {
            counterpartyId: current.counterpartyId,
            currencyId: current.currencyId,
          },
          tx,
        ),
      });
      const targetSet = currencyChanged
        ? CounterpartyRequisiteSet.reconstitute({
            counterpartyId: current.counterpartyId,
            currencyId: nextInput.currencyId,
            requisites:
              await requisites.listActiveRequisitesByCounterpartyCurrency(
                {
                  counterpartyId: current.counterpartyId,
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
          await requisites.setDefaultStateTx(tx, {
            counterpartyId: current.counterpartyId,
            currencyId: nextInput.currencyId,
            defaultId: null,
            demotedIds: transferPlan.demotedIds,
          });
        }
      }

      if (!currencyChanged && nextInput.isDefault) {
        const updatePlan = sourceSet.planUpdate({
          requisiteId: id,
          nextIsDefault: nextInput.isDefault,
        });
        if (updatePlan.demotedIds.length > 0) {
          await requisites.setDefaultStateTx(tx, {
            counterpartyId: current.counterpartyId,
            currencyId: current.currencyId,
            defaultId: null,
            demotedIds: updatePlan.demotedIds,
          });
        }
      }

      const next = existing.update(nextInput, context.now());

      const persistedSnapshot = existing.sameState(next)
        ? existingSnapshot
        : await requisites.updateRequisiteTx(tx, next.toSnapshot());

      if (!persistedSnapshot) {
        throw new CounterpartyRequisiteNotFoundError(id);
      }

      if (currencyChanged) {
        const sourcePlan = sourceSet.planTransferOut(id);
        if (sourcePlan.promotedId) {
          await requisites.setDefaultStateTx(tx, {
            counterpartyId: current.counterpartyId,
            currencyId: current.currencyId,
            defaultId: sourcePlan.promotedId,
            demotedIds: [],
          });
        }
      } else if (!nextInput.isDefault) {
        const updatePlan = sourceSet.planUpdate({
          requisiteId: id,
          nextIsDefault: nextInput.isDefault,
        });
        if (updatePlan.promotedId) {
          await requisites.setDefaultStateTx(tx, {
            counterpartyId: current.counterpartyId,
            currencyId: current.currencyId,
            defaultId: updatePlan.promotedId,
            demotedIds: [],
          });
        }
      }

      const updated = CounterpartyRequisite.reconstitute(persistedSnapshot);

      log.info("Counterparty requisite updated", { id });
      return toPublicRequisite(updated);
    });
  };
}

export function createRemoveCounterpartyRequisiteHandler(
  context: PartiesServiceContext,
) {
  const { db, log, requisites } = context;

  return async function removeCounterpartyRequisite(id: string) {
    return db.transaction(async (tx) => {
      const existingSnapshot = await requisites.findActiveRequisiteSnapshotById(
        id,
        tx,
      );

      if (!existingSnapshot) {
        throw new CounterpartyRequisiteNotFoundError(id);
      }

      const existing = CounterpartyRequisite.reconstitute(existingSnapshot);
      const snapshot = existing.toSnapshot();
      const activeSet = CounterpartyRequisiteSet.reconstitute({
        counterpartyId: snapshot.counterpartyId,
        currencyId: snapshot.currencyId,
        requisites: await requisites.listActiveRequisitesByCounterpartyCurrency(
          {
            counterpartyId: snapshot.counterpartyId,
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
          counterpartyId: snapshot.counterpartyId,
          currencyId: snapshot.currencyId,
          defaultId: archivePlan.promotedId,
          demotedIds: [],
        });
      }

      log.info("Counterparty requisite archived", { id });
      return { ok: true as const };
    });
  };
}

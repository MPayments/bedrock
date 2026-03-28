import { and, eq, isNull } from "drizzle-orm";

import type { Requisite } from "@bedrock/parties/contracts";
import { schema as partiesSchema } from "@bedrock/parties/schema";
import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import { InvalidStateError } from "@bedrock/shared/core/errors";
import { schema as treasurySchema } from "@bedrock/treasury/schema";

interface RequisiteTreasurySyncServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface RequisiteTreasurySyncService {
  sync(requisite: Requisite): Promise<void>;
  archive(requisite: Requisite): Promise<void>;
  backfillActiveRequisites(input?: {
    ownerType?: Requisite["ownerType"];
    ownerId?: string;
  }): Promise<number>;
}

function resolveTreasuryAccountKind(requisite: Requisite) {
  switch (requisite.kind) {
    case "bank":
      return "bank" as const;
    case "exchange":
      return "exchange" as const;
    case "blockchain":
      return "wallet" as const;
    case "custodian":
      return "custodial" as const;
  }
}

function resolveEndpointDescriptor(requisite: Requisite) {
  if (requisite.kind === "blockchain") {
    const value = requisite.address ?? requisite.accountRef;
    if (!value) {
      return null;
    }

    return {
      endpointType: "wallet_address",
      value,
    };
  }

  const value =
    requisite.iban ??
    requisite.accountNo ??
    requisite.accountRef ??
    requisite.subaccountRef;

  if (!value) {
    return null;
  }

  return {
    endpointType: requisite.iban
      ? "iban"
      : requisite.accountNo
        ? "account_no"
        : requisite.accountRef
          ? "account_ref"
          : "subaccount_ref",
    value,
  };
}

function mapRowToRequisite(
  row: typeof partiesSchema.requisites.$inferSelect,
): Requisite {
  const ownerId =
    row.ownerType === "organization" ? row.organizationId : row.counterpartyId;

  if (!ownerId) {
    throw new InvalidStateError(`Missing owner id for requisite ${row.id}`);
  }

  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId,
    providerId: row.providerId,
    currencyId: row.currencyId,
    kind: row.kind,
    label: row.label,
    description: row.description,
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
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

async function syncRequisiteTx(tx: Transaction, requisite: Requisite) {
  const endpoint = resolveEndpointDescriptor(requisite);

  if (requisite.ownerType === "organization") {
    await tx
      .insert(treasurySchema.treasuryAccounts)
      .values({
        id: requisite.id,
        kind: resolveTreasuryAccountKind(requisite),
        ownerEntityId: requisite.ownerId,
        operatorEntityId: requisite.ownerId,
        assetId: requisite.currencyId,
        provider: requisite.providerId,
        networkOrRail: requisite.network,
        accountReference: `requisite:${requisite.id}`,
        reconciliationMode: null,
        finalityModel: null,
        segregationModel: null,
        canReceive: true,
        canSend: true,
        metadata: {
          label: requisite.label,
          institutionName: requisite.institutionName,
          beneficiaryName: requisite.beneficiaryName,
          accountNo: requisite.accountNo,
          iban: requisite.iban,
          swift: requisite.swift,
          address: requisite.address,
          accountRef: requisite.accountRef,
          subaccountRef: requisite.subaccountRef,
        },
        archivedAt: null,
      })
      .onConflictDoUpdate({
        target: treasurySchema.treasuryAccounts.id,
        set: {
          kind: resolveTreasuryAccountKind(requisite),
          ownerEntityId: requisite.ownerId,
          operatorEntityId: requisite.ownerId,
          assetId: requisite.currencyId,
          provider: requisite.providerId,
          networkOrRail: requisite.network,
          accountReference: `requisite:${requisite.id}`,
          reconciliationMode: null,
          finalityModel: null,
          segregationModel: null,
          canReceive: true,
          canSend: true,
          metadata: {
            label: requisite.label,
            institutionName: requisite.institutionName,
            beneficiaryName: requisite.beneficiaryName,
            accountNo: requisite.accountNo,
            iban: requisite.iban,
            swift: requisite.swift,
            address: requisite.address,
            accountRef: requisite.accountRef,
            subaccountRef: requisite.subaccountRef,
          },
          archivedAt: null,
        },
      });

    if (!endpoint) {
      await tx
        .update(treasurySchema.treasuryEndpoints)
        .set({
          archivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(treasurySchema.treasuryEndpoints.id, requisite.id));

      return;
    }

    await tx
      .insert(treasurySchema.treasuryEndpoints)
      .values({
        id: requisite.id,
        accountId: requisite.id,
        endpointType: endpoint.endpointType,
        value: endpoint.value,
        label: requisite.label,
        memoTag: requisite.memoTag,
        metadata: {
          providerId: requisite.providerId,
          kind: requisite.kind,
        },
        archivedAt: null,
      })
      .onConflictDoUpdate({
        target: treasurySchema.treasuryEndpoints.id,
        set: {
          accountId: requisite.id,
          endpointType: endpoint.endpointType,
          value: endpoint.value,
          label: requisite.label,
          memoTag: requisite.memoTag,
          metadata: {
            providerId: requisite.providerId,
            kind: requisite.kind,
          },
          archivedAt: null,
        },
      });

    return;
  }

  if (!endpoint) {
    await tx
      .update(treasurySchema.counterpartyEndpoints)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(treasurySchema.counterpartyEndpoints.id, requisite.id));

    return;
  }

  await tx
    .insert(treasurySchema.counterpartyEndpoints)
    .values({
      id: requisite.id,
      counterpartyId: requisite.ownerId,
      assetId: requisite.currencyId,
      endpointType: endpoint.endpointType,
      value: endpoint.value,
      label: requisite.label,
      memoTag: requisite.memoTag,
      metadata: {
        providerId: requisite.providerId,
        kind: requisite.kind,
      },
      archivedAt: null,
    })
    .onConflictDoUpdate({
      target: treasurySchema.counterpartyEndpoints.id,
      set: {
        counterpartyId: requisite.ownerId,
        assetId: requisite.currencyId,
        endpointType: endpoint.endpointType,
        value: endpoint.value,
        label: requisite.label,
        memoTag: requisite.memoTag,
        metadata: {
          providerId: requisite.providerId,
          kind: requisite.kind,
        },
        archivedAt: null,
      },
    });
}

async function archiveRequisiteTx(tx: Transaction, requisite: Requisite) {
  const archivedAt = requisite.archivedAt ?? new Date();

  if (requisite.ownerType === "organization") {
    await tx
      .update(treasurySchema.treasuryAccounts)
      .set({
        archivedAt,
        updatedAt: archivedAt,
      })
      .where(eq(treasurySchema.treasuryAccounts.id, requisite.id));

    await tx
      .update(treasurySchema.treasuryEndpoints)
      .set({
        archivedAt,
        updatedAt: archivedAt,
      })
      .where(eq(treasurySchema.treasuryEndpoints.id, requisite.id));

    return;
  }

  await tx
    .update(treasurySchema.counterpartyEndpoints)
    .set({
      archivedAt,
      updatedAt: archivedAt,
    })
    .where(eq(treasurySchema.counterpartyEndpoints.id, requisite.id));
}

export function createRequisiteTreasurySyncService(
  deps: RequisiteTreasurySyncServiceDeps,
): RequisiteTreasurySyncService {
  const log = deps.logger?.child({ svc: "requisite-treasury-sync" }) ?? noopLogger;

  return {
    async sync(requisite) {
      await deps.db.transaction(async (tx) => {
        await syncRequisiteTx(tx, requisite);
      });
    },
    async archive(requisite) {
      await deps.db.transaction(async (tx) => {
        await archiveRequisiteTx(tx, requisite);
      });
    },
    async backfillActiveRequisites(input) {
      return deps.db.transaction(async (tx) => {
        const conditions = [isNull(partiesSchema.requisites.archivedAt)];

        if (input?.ownerType) {
          conditions.push(eq(partiesSchema.requisites.ownerType, input.ownerType));
        }

        if (input?.ownerId) {
          if (input.ownerType === "counterparty") {
            conditions.push(
              eq(partiesSchema.requisites.counterpartyId, input.ownerId),
            );
          } else {
            conditions.push(
              eq(partiesSchema.requisites.organizationId, input.ownerId),
            );
          }
        }

        const rows = await tx
          .select()
          .from(partiesSchema.requisites)
          .where(and(...conditions));

        for (const row of rows) {
          await syncRequisiteTx(tx, mapRowToRequisite(row));
        }

        log.info("Backfilled treasury resources for requisites", {
          count: rows.length,
          ownerId: input?.ownerId,
          ownerType: input?.ownerType,
        });

        return rows.length;
      });
    },
  };
}

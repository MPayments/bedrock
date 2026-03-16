import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";

import { currencies } from "@bedrock/currencies/schema";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  CounterpartyRequisiteOptionRecord,
  CounterpartyRequisitesCommandRepository,
  CounterpartyRequisitesQueryRepository,
} from "../../../application/requisites/ports";
import type { CounterpartyRequisite } from "../../../contracts";
import type { CounterpartyRequisiteSnapshot } from "../../../domain/counterparty-requisite";
import {
  counterpartyRequisites,
  type CounterpartyRequisiteRow,
} from "../schema";

const REQUISITES_SORT_COLUMN_MAP = {
  label: counterpartyRequisites.label,
  kind: counterpartyRequisites.kind,
  createdAt: counterpartyRequisites.createdAt,
  updatedAt: counterpartyRequisites.updatedAt,
} as const;

function toSnapshot(
  row: CounterpartyRequisiteRow,
): CounterpartyRequisiteSnapshot {
  return {
    id: row.id,
    counterpartyId: row.counterpartyId!,
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

function toPublicRequisite(
  snapshot: CounterpartyRequisiteSnapshot,
): CounterpartyRequisite {
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

async function findActiveRequisiteSnapshot(
  db: Database,
  id: string,
  tx?: Transaction,
): Promise<CounterpartyRequisiteSnapshot | null> {
  const database = tx ?? db;
  const [row] = await database
    .select()
    .from(counterpartyRequisites)
    .where(
      and(
        eq(counterpartyRequisites.id, id),
        eq(counterpartyRequisites.ownerType, "counterparty"),
        isNull(counterpartyRequisites.archivedAt),
      ),
    )
    .limit(1);

  return row ? toSnapshot(row) : null;
}

export function createDrizzleCounterpartyRequisitesQueryRepository(
  db: Database,
): CounterpartyRequisitesQueryRepository {
  return {
    async findActiveRequisiteById(id) {
      const snapshot = await findActiveRequisiteSnapshot(db, id);
      return snapshot ? toPublicRequisite(snapshot) : null;
    },
    async listRequisites(input) {
      const database = db;
      const conditions: SQL[] = [
        eq(counterpartyRequisites.ownerType, "counterparty"),
        isNull(counterpartyRequisites.archivedAt),
      ];

      if (input.label) {
        conditions.push(
          ilike(counterpartyRequisites.label, `%${input.label}%`),
        );
      }

      if (input.counterpartyId) {
        conditions.push(
          eq(counterpartyRequisites.counterpartyId, input.counterpartyId),
        );
      }

      if (input.currencyId?.length) {
        conditions.push(
          inArray(counterpartyRequisites.currencyId, input.currencyId),
        );
      }

      if (input.kind?.length) {
        conditions.push(
          inArray(
            counterpartyRequisites.kind,
            input.kind as CounterpartyRequisite["kind"][],
          ),
        );
      }

      if (input.providerId?.length) {
        conditions.push(
          inArray(counterpartyRequisites.providerId, input.providerId),
        );
      }

      const where = and(...conditions);
      const orderByFn =
        resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
      const orderByCol = resolveSortValue(
        input.sortBy,
        REQUISITES_SORT_COLUMN_MAP,
        counterpartyRequisites.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        database
          .select()
          .from(counterpartyRequisites)
          .where(where)
          .orderBy(orderByFn(orderByCol))
          .limit(input.limit)
          .offset(input.offset),
        database
          .select({ total: sql<number>`count(*)::int` })
          .from(counterpartyRequisites)
          .where(where),
      ]);

      return {
        data: rows.map((row) => toPublicRequisite(toSnapshot(row))),
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<CounterpartyRequisite>;
    },
    async listRequisiteOptions(input) {
      const database = db;
      const conditions: SQL[] = [
        eq(counterpartyRequisites.ownerType, "counterparty"),
        isNull(counterpartyRequisites.archivedAt),
      ];

      if (input.counterpartyId) {
        conditions.push(
          eq(counterpartyRequisites.counterpartyId, input.counterpartyId),
        );
      }

      const rows = await database
        .select({
          id: counterpartyRequisites.id,
          ownerId: counterpartyRequisites.counterpartyId,
          providerId: counterpartyRequisites.providerId,
          currencyId: counterpartyRequisites.currencyId,
          kind: counterpartyRequisites.kind,
          label: counterpartyRequisites.label,
          beneficiaryName: counterpartyRequisites.beneficiaryName,
          institutionName: counterpartyRequisites.institutionName,
          institutionCountry: counterpartyRequisites.institutionCountry,
          accountNo: counterpartyRequisites.accountNo,
          corrAccount: counterpartyRequisites.corrAccount,
          iban: counterpartyRequisites.iban,
          bic: counterpartyRequisites.bic,
          swift: counterpartyRequisites.swift,
          bankAddress: counterpartyRequisites.bankAddress,
          network: counterpartyRequisites.network,
          assetCode: counterpartyRequisites.assetCode,
          address: counterpartyRequisites.address,
          memoTag: counterpartyRequisites.memoTag,
          accountRef: counterpartyRequisites.accountRef,
          subaccountRef: counterpartyRequisites.subaccountRef,
          contact: counterpartyRequisites.contact,
          notes: counterpartyRequisites.notes,
          currencyCode: currencies.code,
        })
        .from(counterpartyRequisites)
        .innerJoin(
          currencies,
          eq(currencies.id, counterpartyRequisites.currencyId),
        )
        .where(and(...conditions))
        .orderBy(
          asc(counterpartyRequisites.label),
          asc(counterpartyRequisites.createdAt),
        );

      return rows.map((row) => ({
        id: row.id,
        ownerId: row.ownerId!,
        currencyId: row.currencyId,
        providerId: row.providerId,
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
      })) satisfies CounterpartyRequisiteOptionRecord[];
    },
    async listLabelsById(ids) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const database = db;
      const rows = await database
        .select({
          id: counterpartyRequisites.id,
          label: counterpartyRequisites.label,
        })
        .from(counterpartyRequisites)
        .where(
          and(
            eq(counterpartyRequisites.ownerType, "counterparty"),
            inArray(counterpartyRequisites.id, uniqueIds),
          ),
        );

      return new Map(rows.map((row) => [row.id, row.label]));
    },
  };
}

export function createDrizzleCounterpartyRequisitesCommandRepository(
  db: Database,
): CounterpartyRequisitesCommandRepository {
  return {
    async findActiveRequisiteSnapshotById(id, tx) {
      return findActiveRequisiteSnapshot(db, id, tx);
    },
    async listActiveRequisitesByCounterpartyCurrency(input, tx) {
      const database = tx ?? db;
      const rows = await database
        .select()
        .from(counterpartyRequisites)
        .where(
          and(
            eq(counterpartyRequisites.ownerType, "counterparty"),
            eq(counterpartyRequisites.counterpartyId, input.counterpartyId),
            eq(counterpartyRequisites.currencyId, input.currencyId),
            isNull(counterpartyRequisites.archivedAt),
          ),
        )
        .orderBy(
          asc(counterpartyRequisites.createdAt),
          asc(counterpartyRequisites.id),
        );

      return rows.map(toSnapshot);
    },
    async insertRequisiteTx(tx, requisite) {
      const [created] = await tx
        .insert(counterpartyRequisites)
        .values({
          id: requisite.id,
          ownerType: "counterparty",
          organizationId: null,
          counterpartyId: requisite.counterpartyId,
          providerId: requisite.providerId,
          currencyId: requisite.currencyId,
          kind: requisite.kind,
          label: requisite.label,
          description: requisite.description,
          beneficiaryName: requisite.beneficiaryName,
          institutionName: requisite.institutionName,
          institutionCountry: requisite.institutionCountry,
          accountNo: requisite.accountNo,
          corrAccount: requisite.corrAccount,
          iban: requisite.iban,
          bic: requisite.bic,
          swift: requisite.swift,
          bankAddress: requisite.bankAddress,
          network: requisite.network,
          assetCode: requisite.assetCode,
          address: requisite.address,
          memoTag: requisite.memoTag,
          accountRef: requisite.accountRef,
          subaccountRef: requisite.subaccountRef,
          contact: requisite.contact,
          notes: requisite.notes,
          isDefault: requisite.isDefault,
          archivedAt: requisite.archivedAt,
        })
        .returning();

      return toSnapshot(created!);
    },
    async updateRequisiteTx(tx, requisite) {
      const [updated] = await tx
        .update(counterpartyRequisites)
        .set({
          providerId: requisite.providerId,
          currencyId: requisite.currencyId,
          kind: requisite.kind,
          label: requisite.label,
          description: requisite.description,
          beneficiaryName: requisite.beneficiaryName,
          institutionName: requisite.institutionName,
          institutionCountry: requisite.institutionCountry,
          accountNo: requisite.accountNo,
          corrAccount: requisite.corrAccount,
          iban: requisite.iban,
          bic: requisite.bic,
          swift: requisite.swift,
          bankAddress: requisite.bankAddress,
          network: requisite.network,
          assetCode: requisite.assetCode,
          address: requisite.address,
          memoTag: requisite.memoTag,
          accountRef: requisite.accountRef,
          subaccountRef: requisite.subaccountRef,
          contact: requisite.contact,
          notes: requisite.notes,
          isDefault: requisite.isDefault,
          archivedAt: requisite.archivedAt,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(counterpartyRequisites.id, requisite.id),
            eq(counterpartyRequisites.ownerType, "counterparty"),
          ),
        )
        .returning();

      return updated ? toSnapshot(updated) : null;
    },
    async setDefaultStateTx(tx, input) {
      const demotedIds = input.demotedIds.filter(
        (id) => id !== input.defaultId,
      );

      if (demotedIds.length > 0) {
        await tx
          .update(counterpartyRequisites)
          .set({
            isDefault: false,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(counterpartyRequisites.ownerType, "counterparty"),
              eq(counterpartyRequisites.counterpartyId, input.counterpartyId),
              eq(counterpartyRequisites.currencyId, input.currencyId),
              isNull(counterpartyRequisites.archivedAt),
              inArray(counterpartyRequisites.id, demotedIds),
            ),
          );
      }

      if (input.defaultId) {
        await tx
          .update(counterpartyRequisites)
          .set({
            isDefault: true,
            updatedAt: sql`now()`,
          })
          .where(eq(counterpartyRequisites.id, input.defaultId));
      }
    },
    async archiveRequisiteTx(tx, input) {
      const [updated] = await tx
        .update(counterpartyRequisites)
        .set({
          archivedAt: input.archivedAt,
          isDefault: false,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(counterpartyRequisites.id, input.requisiteId),
            eq(counterpartyRequisites.ownerType, "counterparty"),
          ),
        )
        .returning({ id: counterpartyRequisites.id });

      return Boolean(updated);
    },
  };
}

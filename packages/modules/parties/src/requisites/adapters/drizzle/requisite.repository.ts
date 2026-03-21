import { and, asc, eq, isNull, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { requisites, type RequisiteRow } from "./schema";
import type { RequisiteRepository } from "../../application/ports/requisite.repository";
import type { RequisiteOwnerType } from "../../domain/owner";
import { Requisite, type RequisiteSnapshot } from "../../domain/requisite";
import { RequisiteSet } from "../../domain/requisite-set";

function mapRowToSnapshot(row: RequisiteRow): RequisiteSnapshot {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId:
      row.ownerType === "organization"
        ? row.organizationId!
        : row.counterpartyId!,
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

function ownerIdColumn(ownerType: RequisiteOwnerType) {
  return ownerType === "organization"
    ? requisites.organizationId
    : requisites.counterpartyId;
}

export class DrizzleRequisiteRepository implements RequisiteRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Requisite | null> {
    const [row] = await this.db
      .select()
      .from(requisites)
      .where(and(eq(requisites.id, id), isNull(requisites.archivedAt)))
      .limit(1);

    if (!row) return null;

    return Requisite.fromSnapshot(mapRowToSnapshot(row));
  }

  async findSetByOwnerCurrency(input: {
    ownerType: RequisiteOwnerType;
    ownerId: string;
    currencyId: string;
  }): Promise<RequisiteSet> {
    const rows = await this.db
      .select()
      .from(requisites)
      .where(
        and(
          eq(requisites.ownerType, input.ownerType),
          eq(ownerIdColumn(input.ownerType), input.ownerId),
          eq(requisites.currencyId, input.currencyId),
        ),
      )
      .orderBy(asc(requisites.createdAt), asc(requisites.id));

    return RequisiteSet.fromSnapshot({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      currencyId: input.currencyId,
      requisites: rows.map((row) => mapRowToSnapshot(row)),
    });
  }

  async saveSet(set: RequisiteSet): Promise<void> {
    for (const snapshot of set.toSnapshots()) {
      const existing = await this.findExistingRow(snapshot.id);

      if (existing) {
        await this.updateRow(snapshot);
      } else {
        await this.insertRow(snapshot);
      }
    }
  }

  private async findExistingRow(id: string) {
    const [row] = await this.db
      .select({ id: requisites.id })
      .from(requisites)
      .where(eq(requisites.id, id))
      .limit(1);

    return row ?? null;
  }

  private async insertRow(snapshot: RequisiteSnapshot) {
    const [created] = await this.db
      .insert(requisites)
      .values({
        id: snapshot.id,
        ownerType: snapshot.ownerType,
        organizationId:
          snapshot.ownerType === "organization" ? snapshot.ownerId : null,
        counterpartyId:
          snapshot.ownerType === "counterparty" ? snapshot.ownerId : null,
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
        archivedAt: snapshot.archivedAt,
      })
      .returning();

    return created!;
  }

  private async updateRow(snapshot: RequisiteSnapshot) {
    const [updated] = await this.db
      .update(requisites)
      .set({
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
        archivedAt: snapshot.archivedAt,
        updatedAt: sql`now()`,
      })
      .where(eq(requisites.id, snapshot.id))
      .returning();

    return updated!;
  }
}

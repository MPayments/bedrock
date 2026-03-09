import { and, asc, eq, isNull } from "drizzle-orm";

import type { RequisitesServiceContext } from "../internal/context";
import { schema } from "../schema";
import { buildRequisiteOptionLabel } from "../shared";
import {
  ListRequisiteOptionsQuerySchema,
  type ListRequisiteOptionsQuery,
} from "../validation";

export function createListRequisiteOptionsHandler(
  context: RequisitesServiceContext,
) {
  const { db } = context;

  return async function listRequisiteOptions(input?: ListRequisiteOptionsQuery) {
    const query = ListRequisiteOptionsQuerySchema.parse(input ?? {});
    const conditions = [isNull(schema.requisites.archivedAt)];

    if (query.ownerType === "organization" && query.ownerId) {
      conditions.push(eq(schema.requisites.organizationId, query.ownerId));
    }
    if (query.ownerType === "counterparty" && query.ownerId) {
      conditions.push(eq(schema.requisites.counterpartyId, query.ownerId));
    }
    if (query.ownerType) {
      conditions.push(eq(schema.requisites.ownerType, query.ownerType));
    }

    const rows = await db
      .select({
        id: schema.requisites.id,
        ownerType: schema.requisites.ownerType,
        organizationId: schema.requisites.organizationId,
        counterpartyId: schema.requisites.counterpartyId,
        providerId: schema.requisites.providerId,
        currencyId: schema.requisites.currencyId,
        kind: schema.requisites.kind,
        label: schema.requisites.label,
        beneficiaryName: schema.requisites.beneficiaryName,
        institutionName: schema.requisites.institutionName,
        institutionCountry: schema.requisites.institutionCountry,
        accountNo: schema.requisites.accountNo,
        corrAccount: schema.requisites.corrAccount,
        iban: schema.requisites.iban,
        bic: schema.requisites.bic,
        swift: schema.requisites.swift,
        bankAddress: schema.requisites.bankAddress,
        network: schema.requisites.network,
        assetCode: schema.requisites.assetCode,
        address: schema.requisites.address,
        memoTag: schema.requisites.memoTag,
        accountRef: schema.requisites.accountRef,
        subaccountRef: schema.requisites.subaccountRef,
        contact: schema.requisites.contact,
        notes: schema.requisites.notes,
        currencyCode: schema.currencies.code,
      })
      .from(schema.requisites)
      .innerJoin(
        schema.currencies,
        eq(schema.currencies.id, schema.requisites.currencyId),
      )
      .where(and(...conditions))
      .orderBy(asc(schema.requisites.label), asc(schema.requisites.createdAt));

    return rows.map((row) => ({
      id: row.id,
      ownerType: row.ownerType,
      ownerId:
        row.ownerType === "organization" ? row.organizationId! : row.counterpartyId!,
      currencyId: row.currencyId,
      providerId: row.providerId,
      kind: row.kind,
      label: buildRequisiteOptionLabel({
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

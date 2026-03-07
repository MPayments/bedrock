import { and, asc, eq, isNull } from "drizzle-orm";

import type { OrganizationRequisitesServiceContext } from "../internal/context";
import { schema } from "../schema";
import {
  buildOrganizationRequisiteOptionLabel,
  ListOrganizationRequisiteOptionsQuerySchema,
  type ListOrganizationRequisiteOptionsQuery,
} from "../validation";

export function createListOrganizationRequisiteOptionsHandler(
  context: OrganizationRequisitesServiceContext,
) {
  const { db } = context;

  return async function listOrganizationRequisiteOptions(
    input?: ListOrganizationRequisiteOptionsQuery,
  ) {
    const query = ListOrganizationRequisiteOptionsQuerySchema.parse(input ?? {});
    const conditions = [isNull(schema.organizationRequisites.archivedAt)];

    if (query.organizationId) {
      conditions.push(
        eq(schema.organizationRequisites.organizationId, query.organizationId),
      );
    }

    const rows = await db
      .select({
        id: schema.organizationRequisites.id,
        organizationId: schema.organizationRequisites.organizationId,
        currencyId: schema.organizationRequisites.currencyId,
        kind: schema.organizationRequisites.kind,
        label: schema.organizationRequisites.label,
        beneficiaryName: schema.organizationRequisites.beneficiaryName,
        institutionName: schema.organizationRequisites.institutionName,
        institutionCountry: schema.organizationRequisites.institutionCountry,
        accountNo: schema.organizationRequisites.accountNo,
        corrAccount: schema.organizationRequisites.corrAccount,
        iban: schema.organizationRequisites.iban,
        bic: schema.organizationRequisites.bic,
        swift: schema.organizationRequisites.swift,
        bankAddress: schema.organizationRequisites.bankAddress,
        network: schema.organizationRequisites.network,
        assetCode: schema.organizationRequisites.assetCode,
        address: schema.organizationRequisites.address,
        memoTag: schema.organizationRequisites.memoTag,
        accountRef: schema.organizationRequisites.accountRef,
        subaccountRef: schema.organizationRequisites.subaccountRef,
        contact: schema.organizationRequisites.contact,
        notes: schema.organizationRequisites.notes,
        currencyCode: schema.currencies.code,
      })
      .from(schema.organizationRequisites)
      .innerJoin(
        schema.currencies,
        eq(schema.currencies.id, schema.organizationRequisites.currencyId),
      )
      .where(and(...conditions))
      .orderBy(
        asc(schema.organizationRequisites.label),
        asc(schema.organizationRequisites.createdAt),
      );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      currencyId: row.currencyId,
      kind: row.kind,
      label: buildOrganizationRequisiteOptionLabel({
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

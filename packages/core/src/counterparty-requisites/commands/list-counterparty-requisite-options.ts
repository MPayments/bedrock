import { and, asc, eq, isNull } from "drizzle-orm";

import type { CounterpartyRequisitesServiceContext } from "../internal/context";
import { schema } from "../schema";
import {
  buildCounterpartyRequisiteOptionLabel,
  ListCounterpartyRequisiteOptionsQuerySchema,
  type ListCounterpartyRequisiteOptionsQuery,
} from "../validation";

export function createListCounterpartyRequisiteOptionsHandler(
  context: CounterpartyRequisitesServiceContext,
) {
  const { db } = context;

  return async function listCounterpartyRequisiteOptions(
    input?: ListCounterpartyRequisiteOptionsQuery,
  ) {
    const query = ListCounterpartyRequisiteOptionsQuerySchema.parse(input ?? {});
    const conditions = [isNull(schema.counterpartyRequisites.archivedAt)];

    if (query.counterpartyId) {
      conditions.push(
        eq(schema.counterpartyRequisites.counterpartyId, query.counterpartyId),
      );
    }

    const rows = await db
      .select({
        id: schema.counterpartyRequisites.id,
        counterpartyId: schema.counterpartyRequisites.counterpartyId,
        currencyId: schema.counterpartyRequisites.currencyId,
        kind: schema.counterpartyRequisites.kind,
        label: schema.counterpartyRequisites.label,
        beneficiaryName: schema.counterpartyRequisites.beneficiaryName,
        institutionName: schema.counterpartyRequisites.institutionName,
        institutionCountry: schema.counterpartyRequisites.institutionCountry,
        accountNo: schema.counterpartyRequisites.accountNo,
        corrAccount: schema.counterpartyRequisites.corrAccount,
        iban: schema.counterpartyRequisites.iban,
        bic: schema.counterpartyRequisites.bic,
        swift: schema.counterpartyRequisites.swift,
        bankAddress: schema.counterpartyRequisites.bankAddress,
        network: schema.counterpartyRequisites.network,
        assetCode: schema.counterpartyRequisites.assetCode,
        address: schema.counterpartyRequisites.address,
        memoTag: schema.counterpartyRequisites.memoTag,
        accountRef: schema.counterpartyRequisites.accountRef,
        subaccountRef: schema.counterpartyRequisites.subaccountRef,
        contact: schema.counterpartyRequisites.contact,
        notes: schema.counterpartyRequisites.notes,
        currencyCode: schema.currencies.code,
      })
      .from(schema.counterpartyRequisites)
      .innerJoin(
        schema.currencies,
        eq(schema.currencies.id, schema.counterpartyRequisites.currencyId),
      )
      .where(and(...conditions))
      .orderBy(
        asc(schema.counterpartyRequisites.label),
        asc(schema.counterpartyRequisites.createdAt),
      );

    return rows.map((row) => ({
      id: row.id,
      counterpartyId: row.counterpartyId,
      currencyId: row.currencyId,
      kind: row.kind,
      label: buildCounterpartyRequisiteOptionLabel({
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

import { asc, desc, inArray, like, or, sql, type SQL } from "drizzle-orm";

import type { DocumentSummaryFields } from "../../types";
import { schema } from "./schema";

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function buildSummary(summary: DocumentSummaryFields) {
  return {
    title: summary.title,
    amountMinor: summary.amountMinor ?? null,
    currency: summary.currency ?? null,
    memo: summary.memo ?? null,
    counterpartyId: summary.counterpartyId ?? null,
    customerId: summary.customerId ?? null,
    organizationRequisiteId: summary.organizationRequisiteId ?? null,
    searchText: normalizeSearchText(summary.searchText),
  };
}

export function buildDocumentSearchCondition(query: string | undefined): SQL | undefined {
  if (!query) {
    return undefined;
  }

  const normalized = `%${normalizeSearchText(query)}%`;
  return or(
    like(sql`lower(${schema.documents.docNo})`, normalized),
    like(sql`lower(${schema.documents.id}::text)`, normalized),
    like(sql`lower(coalesce(${schema.documents.memo}, ''))`, normalized),
    like(sql`lower(${schema.documents.title})`, normalized),
    like(sql`lower(${schema.documents.searchText})`, normalized),
  )!;
}

export function inArraySafe<T>(column: any, values: T[] | undefined) {
  if (!values || values.length === 0) {
    return undefined;
  }

  return inArray(column, values as any[]);
}

export function resolveDocumentsSort(
  sortBy: "createdAt" | "occurredAt" | "updatedAt" | "postedAt",
  sortOrder: "asc" | "desc",
) {
  const column =
    sortBy === "createdAt"
      ? schema.documents.createdAt
      : sortBy === "updatedAt"
        ? schema.documents.updatedAt
        : sortBy === "postedAt"
          ? schema.documents.postedAt
          : schema.documents.occurredAt;

  return sortOrder === "asc" ? asc(column) : desc(column);
}

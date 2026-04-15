import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  requisiteProviderBranchIdentifiers,
  requisiteProviderBranches,
  requisiteProviderIdentifiers,
  requisiteProviders,
} from "./schema";
import type {
  RequisiteProvider,
  RequisiteProviderListItem,
} from "../../application/contracts/dto";
import {
  RequisiteProviderBranchIdentifierSchema,
  RequisiteProviderIdentifierSchema,
} from "../../application/contracts/dto";
import type { RequisiteProviderReads } from "../../application/ports/requisite-provider.reads";
import { normalizePaymentIdentifierValue } from "../../domain/identifier-schemes";

const PROVIDERS_SORT_COLUMN_MAP = {
  displayName: requisiteProviders.displayName,
  kind: requisiteProviders.kind,
  country: requisiteProviders.country,
  createdAt: requisiteProviders.createdAt,
  updatedAt: requisiteProviders.updatedAt,
} as const;

function normalizeIdentifierFilterValues(
  scheme: "bic" | "swift",
  values: string[],
) {
  return Array.from(
    new Set(
      values.map((value) =>
        normalizePaymentIdentifierValue({
          owner: "provider",
          scheme,
          value,
        }),
      ),
    ),
  );
}

export class DrizzleRequisiteProviderReads implements RequisiteProviderReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<RequisiteProvider | null> {
    const [row] = await this.db
      .select()
      .from(requisiteProviders)
      .where(eq(requisiteProviders.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    const [identifiers, branchRows] = await Promise.all([
      this.db
        .select()
        .from(requisiteProviderIdentifiers)
        .where(eq(requisiteProviderIdentifiers.providerId, row.id))
        .orderBy(
          asc(requisiteProviderIdentifiers.scheme),
          asc(requisiteProviderIdentifiers.createdAt),
        ),
      this.db
        .select()
        .from(requisiteProviderBranches)
        .where(eq(requisiteProviderBranches.providerId, row.id))
        .orderBy(
          asc(requisiteProviderBranches.createdAt),
          asc(requisiteProviderBranches.name),
        ),
    ]);
    const branchIds = branchRows.map((branch) => branch.id);
    const branchIdentifierRows = branchIds.length
      ? await this.db
          .select()
          .from(requisiteProviderBranchIdentifiers)
          .where(inArray(requisiteProviderBranchIdentifiers.branchId, branchIds))
          .orderBy(
            asc(requisiteProviderBranchIdentifiers.branchId),
            asc(requisiteProviderBranchIdentifiers.createdAt),
          )
      : [];
    const identifiersByBranchId = new Map<string, typeof branchIdentifierRows>();

    for (const identifier of branchIdentifierRows) {
      const items = identifiersByBranchId.get(identifier.branchId) ?? [];
      items.push(identifier);
      identifiersByBranchId.set(identifier.branchId, items);
    }

    return {
      ...row,
      identifiers: identifiers.map((identifier) =>
        RequisiteProviderIdentifierSchema.parse(identifier),
      ),
      branches: branchRows.map((branch) => ({
        ...branch,
        identifiers: (identifiersByBranchId.get(branch.id) ?? []).map(
          (identifier) => RequisiteProviderBranchIdentifierSchema.parse(identifier),
        ),
      })),
    };
  }

  async findActiveById(id: string): Promise<RequisiteProvider | null> {
    const provider = await this.findById(id);
    return provider?.archivedAt ? null : provider;
  }

  async list(input: {
    limit: number;
    offset: number;
    sortBy?: "displayName" | "kind" | "country" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
    id?: string[];
    kind?: string[];
    country?: string[];
    displayName?: string;
    legalName?: string;
    bic?: string[];
    swift?: string[];
  }): Promise<PaginatedList<RequisiteProviderListItem>> {
    const conditions: SQL[] = [isNull(requisiteProviders.archivedAt)];

    if (input.id?.length) {
      conditions.push(inArray(requisiteProviders.id, input.id));
    }

    if (input.displayName) {
      conditions.push(
        ilike(requisiteProviders.displayName, `%${input.displayName}%`),
      );
    }

    if (input.legalName) {
      conditions.push(ilike(requisiteProviders.legalName, `%${input.legalName}%`));
    }

    if (input.kind?.length) {
      conditions.push(
        inArray(
          requisiteProviders.kind,
          input.kind as RequisiteProviderListItem["kind"][],
        ),
      );
    }

    if (input.country?.length) {
      conditions.push(inArray(requisiteProviders.country, input.country));
    }

    const bicValues = input.bic?.length
      ? normalizeIdentifierFilterValues("bic", input.bic)
      : [];
    if (bicValues.length > 0) {
      conditions.push(this.buildIdentifierCondition("bic", bicValues));
    }

    const swiftValues = input.swift?.length
      ? normalizeIdentifierFilterValues("swift", input.swift)
      : [];
    if (swiftValues.length > 0) {
      conditions.push(this.buildIdentifierCondition("swift", swiftValues));
    }

    const where = and(...conditions);
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      input.sortBy,
      PROVIDERS_SORT_COLUMN_MAP,
      requisiteProviders.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(requisiteProviders)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(requisiteProviders)
        .where(where),
    ]);

    return {
      data: rows,
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  private buildIdentifierCondition(
    scheme: "bic" | "swift",
    values: string[],
  ): SQL {
    return or(
      exists(
        this.db
          .select({ id: requisiteProviderIdentifiers.id })
          .from(requisiteProviderIdentifiers)
          .where(
            and(
              eq(requisiteProviderIdentifiers.providerId, requisiteProviders.id),
              eq(requisiteProviderIdentifiers.scheme, scheme),
              inArray(requisiteProviderIdentifiers.normalizedValue, values),
            ),
          ),
      ),
      exists(
        this.db
          .select({ id: requisiteProviderBranchIdentifiers.id })
          .from(requisiteProviderBranchIdentifiers)
          .innerJoin(
            requisiteProviderBranches,
            eq(
              requisiteProviderBranchIdentifiers.branchId,
              requisiteProviderBranches.id,
            ),
          )
          .where(
            and(
              eq(requisiteProviderBranches.providerId, requisiteProviders.id),
              isNull(requisiteProviderBranches.archivedAt),
              eq(requisiteProviderBranchIdentifiers.scheme, scheme),
              inArray(requisiteProviderBranchIdentifiers.normalizedValue, values),
            ),
          ),
      ),
    )!;
  }
}

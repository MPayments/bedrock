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
import type { RequisiteProviderReads } from "../../application/ports/requisite-provider.reads";

const PROVIDERS_SORT_COLUMN_MAP = {
  displayName: requisiteProviders.displayName,
  kind: requisiteProviders.kind,
  country: requisiteProviders.country,
  createdAt: requisiteProviders.createdAt,
  updatedAt: requisiteProviders.updatedAt,
} as const;

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
      identifiers,
      branches: branchRows.map((branch) => ({
        ...branch,
        identifiers: identifiersByBranchId.get(branch.id) ?? [],
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
    kind?: string[];
    country?: string[];
    displayName?: string;
    legalName?: string;
  }): Promise<PaginatedList<RequisiteProviderListItem>> {
    const conditions: SQL[] = [isNull(requisiteProviders.archivedAt)];

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
}

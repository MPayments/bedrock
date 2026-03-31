import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { subAgentProfiles } from "./schema";
import { counterparties } from "../../../counterparties/adapters/drizzle/schema";
import {
  CountryCodeSchema,
  PartyKindSchema,
} from "../../../shared/domain/party-kind";
import type { SubAgentProfile } from "../../application/contracts/dto";
import type { ListSubAgentProfilesQuery } from "../../application/contracts/queries";
import type { SubAgentProfileReads } from "../../application/ports/sub-agent-profile.reads";

const SUB_AGENT_PROFILE_SORT_COLUMN_MAP = {
  shortName: counterparties.shortName,
  fullName: counterparties.fullName,
  commissionRate: subAgentProfiles.commissionRate,
  createdAt: subAgentProfiles.createdAt,
  updatedAt: subAgentProfiles.updatedAt,
} as const;

export class DrizzleSubAgentProfileReads implements SubAgentProfileReads {
  constructor(private readonly db: Queryable) {}

  async findById(counterpartyId: string): Promise<SubAgentProfile | null> {
    const [row] = await this.baseSelect()
      .where(eq(subAgentProfiles.counterpartyId, counterpartyId))
      .limit(1);

    return row ? this.mapRow(row) : null;
  }

  async list(
    input: ListSubAgentProfilesQuery,
  ): Promise<PaginatedList<SubAgentProfile>> {
    const conditions: SQL[] = [];

    if (input.shortName) {
      conditions.push(ilike(counterparties.shortName, `%${input.shortName}%`));
    }

    if (input.fullName) {
      conditions.push(ilike(counterparties.fullName, `%${input.fullName}%`));
    }

    const countries = input.country?.map((value) => CountryCodeSchema.parse(value));
    if (countries?.length) {
      conditions.push(inArray(counterparties.country, countries));
    }

    const kinds = input.kind?.map((value) => PartyKindSchema.parse(value));
    if (kinds?.length) {
      conditions.push(inArray(counterparties.kind, kinds));
    }

    conditions.push(eq(subAgentProfiles.isActive, input.isActive ?? true));

    const where = and(...conditions);
    const orderByFn =
      resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      SUB_AGENT_PROFILE_SORT_COLUMN_MAP,
      counterparties.shortName,
    );

    const [rows, countRows] = await Promise.all([
      this.baseSelect()
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(subAgentProfiles)
        .innerJoin(
          counterparties,
          eq(counterparties.id, subAgentProfiles.counterpartyId),
        )
        .where(where),
    ]);

    return {
      data: rows.map((row) => this.mapRow(row)),
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  private baseSelect() {
    return this.db
      .select({
        commissionRate: subAgentProfiles.commissionRate,
        counterpartyId: counterparties.id,
        country: counterparties.country,
        createdAt: subAgentProfiles.createdAt,
        fullName: counterparties.fullName,
        isActive: subAgentProfiles.isActive,
        kind: counterparties.kind,
        shortName: counterparties.shortName,
        updatedAt: subAgentProfiles.updatedAt,
      })
      .from(subAgentProfiles)
      .innerJoin(
        counterparties,
        eq(counterparties.id, subAgentProfiles.counterpartyId),
      );
  }

  private mapRow(row: {
    commissionRate: number;
    counterpartyId: string;
    country: string | null;
    createdAt: Date;
    fullName: string;
    isActive: boolean;
    kind: "legal_entity" | "individual";
    shortName: string;
    updatedAt: Date;
  }): SubAgentProfile {
    return {
      commissionRate: row.commissionRate,
      counterpartyId: row.counterpartyId,
      country: row.country,
      createdAt: row.createdAt,
      fullName: row.fullName,
      isActive: row.isActive,
      kind: row.kind,
      shortName: row.shortName,
      updatedAt: row.updatedAt,
    };
  }
}

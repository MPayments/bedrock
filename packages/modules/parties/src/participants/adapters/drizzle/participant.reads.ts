import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import type {
  CustomerLegalEntitiesQuery,
  ParticipantLookupItem,
  ParticipantLookupQuery,
  ParticipantLookupKind,
  ParticipantRequisiteSummary,
  RouteComposerRoleHint,
} from "../../application/contracts";
import type { ParticipantReads } from "../../application/ports/participant.reads";
import { counterparties } from "../../../counterparties/adapters/drizzle/schema";
import { customers } from "../../../customers/adapters/drizzle/schema";
import { organizations } from "../../../organizations/adapters/drizzle/schema";
import { requisites } from "../../../requisites/adapters/drizzle/schema";
import { subAgentProfiles } from "../../../sub-agent-profiles/adapters/drizzle/schema";

const EMPTY_REQUISITE_SUMMARY: ParticipantRequisiteSummary = {
  bankCount: 0,
  hasDefault: false,
  totalCount: 0,
};

type ParticipantLookupItemBase = Omit<ParticipantLookupItem, "requisites">;
type PrefixSearchColumn = Parameters<typeof ilike>[0];

function buildPrefixCondition(
  query: string,
  columns: PrefixSearchColumn[],
): SQL<unknown> | undefined {
  if (!query) {
    return undefined;
  }

  const pattern = `${query}%`;
  const conditions = columns.map((column) => ilike(column as any, pattern));
  return or(...conditions) ?? undefined;
}

function sortParticipantItems(
  left: ParticipantLookupItemBase,
  right: ParticipantLookupItemBase,
) {
  const displayNameOrder = left.displayName.localeCompare(
    right.displayName,
    "en",
    { sensitivity: "base" },
  );
  if (displayNameOrder !== 0) {
    return displayNameOrder;
  }

  return left.participantKind.localeCompare(right.participantKind, "en", {
    sensitivity: "base",
  });
}

function buildCounterpartyRoleHints(input: {
  participantKind: ParticipantLookupKind;
  relationshipKind: "customer_owned" | "external";
}): RouteComposerRoleHint[] {
  if (input.participantKind === "sub_agent") {
    return ["sub_agent", "external_counterparty"];
  }

  if (input.relationshipKind === "customer_owned") {
    return ["customer_legal_entity"];
  }

  return ["external_counterparty"];
}

export class DrizzleParticipantReads implements ParticipantReads {
  constructor(private readonly db: Queryable) {}

  async lookup(input: ParticipantLookupQuery): Promise<ParticipantLookupItem[]> {
    const kinds = input.kind
      ? [input.kind]
      : ([
          "customer",
          "counterparty",
          "organization",
          "sub_agent",
        ] as ParticipantLookupKind[]);

    const [customerItems, counterpartyItems, organizationItems, subAgentItems] =
      await Promise.all([
        kinds.includes("customer")
          ? this.searchCustomers(input)
          : Promise.resolve([]),
        kinds.includes("counterparty")
          ? this.searchCounterparties({
              customerId: input.customerId,
              limit: input.limit,
              q: input.q,
            })
          : Promise.resolve([]),
        kinds.includes("organization")
          ? this.searchOrganizations(input)
          : Promise.resolve([]),
        kinds.includes("sub_agent")
          ? this.searchSubAgents(input)
          : Promise.resolve([]),
      ]);

    const items = [
      ...customerItems,
      ...counterpartyItems,
      ...organizationItems,
      ...subAgentItems,
    ]
      .sort(sortParticipantItems)
      .slice(0, input.limit);

    return this.attachRequisiteSummaries(items);
  }

  async listCustomerLegalEntities(input: {
    customerId: string;
    query: CustomerLegalEntitiesQuery;
  }): Promise<ParticipantLookupItem[]> {
    const items = await this.searchCounterparties({
      customerId: input.customerId,
      limit: input.query.limit,
      q: input.query.q,
      relationshipKind: "customer_owned",
    });

    return this.attachRequisiteSummaries(items);
  }

  private async searchCustomers(
    input: Pick<ParticipantLookupQuery, "limit" | "q">,
  ): Promise<ParticipantLookupItemBase[]> {
    const prefixCondition = buildPrefixCondition(input.q, [
      customers.name,
      customers.externalRef,
    ]);

    const rows = await this.db
      .select({
        id: customers.id,
        name: customers.name,
      })
      .from(customers)
      .where(prefixCondition)
      .orderBy(asc(customers.name))
      .limit(input.limit);

    return rows.map((row) => ({
      country: null,
      customerId: null,
      displayName: row.name,
      id: row.id,
      isActive: true,
      legalName: row.name,
      participantKind: "customer",
      partyKind: null,
      relationshipKind: null,
      roleHints: ["deal_owner"],
      shortName: null,
    }));
  }

  private async searchOrganizations(
    input: Pick<ParticipantLookupQuery, "activeOnly" | "limit" | "q">,
  ): Promise<ParticipantLookupItemBase[]> {
    const conditions: SQL<unknown>[] = [];
    const prefixCondition = buildPrefixCondition(input.q, [
      organizations.shortName,
      organizations.fullName,
      organizations.externalRef,
    ]);

    if (prefixCondition) {
      conditions.push(prefixCondition);
    }

    if (input.activeOnly) {
      conditions.push(eq(organizations.isActive, true));
    }

    const rows = await this.db
      .select({
        country: organizations.country,
        fullName: organizations.fullName,
        id: organizations.id,
        isActive: organizations.isActive,
        kind: organizations.kind,
        shortName: organizations.shortName,
      })
      .from(organizations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(organizations.shortName), asc(organizations.fullName))
      .limit(input.limit);

    return rows.map((row) => ({
      country: row.country,
      customerId: null,
      displayName: row.shortName,
      id: row.id,
      isActive: row.isActive,
      legalName: row.fullName,
      participantKind: "organization",
      partyKind: row.kind,
      relationshipKind: null,
      roleHints: ["internal_entity", "liquidity_source"],
      shortName: row.shortName,
    }));
  }

  private async searchCounterparties(input: {
    customerId?: string;
    limit: number;
    q: string;
    relationshipKind?: "customer_owned" | "external";
  }): Promise<ParticipantLookupItemBase[]> {
    const conditions: SQL<unknown>[] = [];
    const prefixCondition = buildPrefixCondition(input.q, [
      counterparties.shortName,
      counterparties.fullName,
      counterparties.externalRef,
    ]);

    if (prefixCondition) {
      conditions.push(prefixCondition);
    }

    if (input.customerId) {
      conditions.push(eq(counterparties.customerId, input.customerId));
    }

    if (input.relationshipKind) {
      conditions.push(eq(counterparties.relationshipKind, input.relationshipKind));
    }

    const rows = await this.db
      .select({
        country: counterparties.country,
        customerId: counterparties.customerId,
        fullName: counterparties.fullName,
        id: counterparties.id,
        kind: counterparties.kind,
        relationshipKind: counterparties.relationshipKind,
        shortName: counterparties.shortName,
      })
      .from(counterparties)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(counterparties.shortName), asc(counterparties.fullName))
      .limit(input.limit);

    return rows.map((row) => ({
      country: row.country,
      customerId: row.customerId,
      displayName: row.shortName,
      id: row.id,
      isActive: true,
      legalName: row.fullName,
      participantKind: "counterparty",
      partyKind: row.kind,
      relationshipKind: row.relationshipKind,
      roleHints: buildCounterpartyRoleHints({
        participantKind: "counterparty",
        relationshipKind: row.relationshipKind,
      }),
      shortName: row.shortName,
    }));
  }

  private async searchSubAgents(
    input: Pick<
      ParticipantLookupQuery,
      "activeOnly" | "customerId" | "limit" | "q"
    >,
  ): Promise<ParticipantLookupItemBase[]> {
    const conditions: SQL<unknown>[] = [];
    const prefixCondition = buildPrefixCondition(input.q, [
      counterparties.shortName,
      counterparties.fullName,
      counterparties.externalRef,
    ]);

    if (prefixCondition) {
      conditions.push(prefixCondition);
    }

    if (input.activeOnly) {
      conditions.push(eq(subAgentProfiles.isActive, true));
    }

    if (input.customerId) {
      conditions.push(eq(counterparties.customerId, input.customerId));
    }

    const rows = await this.db
      .select({
        country: counterparties.country,
        customerId: counterparties.customerId,
        fullName: counterparties.fullName,
        id: counterparties.id,
        isActive: subAgentProfiles.isActive,
        kind: counterparties.kind,
        relationshipKind: counterparties.relationshipKind,
        shortName: counterparties.shortName,
      })
      .from(subAgentProfiles)
      .innerJoin(
        counterparties,
        eq(counterparties.id, subAgentProfiles.counterpartyId),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(counterparties.shortName), asc(counterparties.fullName))
      .limit(input.limit);

    return rows.map((row) => ({
      country: row.country,
      customerId: row.customerId,
      displayName: row.shortName,
      id: row.id,
      isActive: row.isActive,
      legalName: row.fullName,
      participantKind: "sub_agent",
      partyKind: row.kind,
      relationshipKind: row.relationshipKind,
      roleHints: buildCounterpartyRoleHints({
        participantKind: "sub_agent",
        relationshipKind: row.relationshipKind,
      }),
      shortName: row.shortName,
    }));
  }

  private async attachRequisiteSummaries(
    items: ParticipantLookupItemBase[],
  ): Promise<ParticipantLookupItem[]> {
    const counterpartyIds = Array.from(
      new Set(
        items
          .filter(
            (item) =>
              item.participantKind === "counterparty" ||
              item.participantKind === "sub_agent",
          )
          .map((item) => item.id),
      ),
    );
    const organizationIds = Array.from(
      new Set(
        items
          .filter((item) => item.participantKind === "organization")
          .map((item) => item.id),
      ),
    );

    const [counterpartySummaries, organizationSummaries] = await Promise.all([
      this.listRequisiteSummaries({
        ownerIds: counterpartyIds,
        ownerType: "counterparty",
      }),
      this.listRequisiteSummaries({
        ownerIds: organizationIds,
        ownerType: "organization",
      }),
    ]);

    return items.map((item) => {
      if (
        item.participantKind === "counterparty" ||
        item.participantKind === "sub_agent"
      ) {
        return {
          ...item,
          requisites:
            counterpartySummaries.get(item.id) ?? EMPTY_REQUISITE_SUMMARY,
        };
      }

      if (item.participantKind === "organization") {
        return {
          ...item,
          requisites:
            organizationSummaries.get(item.id) ?? EMPTY_REQUISITE_SUMMARY,
        };
      }

      return {
        ...item,
        requisites: EMPTY_REQUISITE_SUMMARY,
      };
    });
  }

  private async listRequisiteSummaries(input: {
    ownerIds: string[];
    ownerType: "counterparty" | "organization";
  }): Promise<Map<string, ParticipantRequisiteSummary>> {
    if (input.ownerIds.length === 0) {
      return new Map();
    }

    const ownerIdColumn =
      input.ownerType === "organization"
        ? requisites.organizationId
        : requisites.counterpartyId;

    const rows = await this.db
      .select({
        bankCount: sql<number>`count(*) filter (where ${requisites.kind} = 'bank')::int`,
        hasDefault: sql<boolean>`bool_or(${requisites.isDefault})`,
        ownerId: ownerIdColumn,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(requisites)
      .where(
        and(
          eq(requisites.ownerType, input.ownerType),
          inArray(ownerIdColumn, input.ownerIds),
          isNull(requisites.archivedAt),
        ),
      )
      .groupBy(ownerIdColumn);

    return new Map(
      rows
        .filter(
          (row): row is typeof row & { ownerId: string } => row.ownerId !== null,
        )
        .map((row) => [
          row.ownerId,
          {
            bankCount: row.bankCount,
            hasDefault: row.hasDefault,
            totalCount: row.totalCount,
          },
        ]),
    );
  }
}

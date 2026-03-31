import {
  and,
  asc,
  desc,
  eq,
  sql,
  type SQL,
} from "drizzle-orm";

import { minorToDecimalString } from "@bedrock/calculations";
import type { CurrenciesQueries } from "@bedrock/currencies/queries";
import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { dealApprovals, dealLegs, dealParticipants, deals, dealStatusHistory } from "./schema";
import type {
  Deal,
  DealApproval,
  DealDetails,
  DealLeg,
  DealParticipant,
  DealStatusHistoryEntry,
} from "../../application/contracts/dto";
import type { ListDealsQuery } from "../../application/contracts/queries";
import type {
  DealStatus,
  DealType,
} from "../../application/contracts/zod";
import type { DealReads } from "../../application/ports/deal.reads";

const DEALS_SORT_COLUMN_MAP = {
  createdAt: deals.createdAt,
  updatedAt: deals.updatedAt,
  status: deals.status,
  type: deals.type,
} as const;

function mapDeal(row: {
  id: string;
  customerId: string;
  agreementId: string;
  calculationId: string | null;
  type: "payment" | "currency_exchange" | "currency_transit" | "exporter_settlement";
  status:
    | "draft"
    | "submitted"
    | "rejected"
    | "preparing_documents"
    | "awaiting_funds"
    | "awaiting_payment"
    | "closing_documents"
    | "done"
    | "cancelled";
  agentId: string | null;
  reason: string | null;
  intakeComment: string | null;
  comment: string | null;
  requestedAmountMinor: bigint | null;
  requestedCurrencyId: string | null;
  requestedCurrencyPrecision: number | null;
  createdAt: Date;
  updatedAt: Date;
}): Deal {
  return {
    id: row.id,
    customerId: row.customerId,
    agreementId: row.agreementId,
    calculationId: row.calculationId,
    type: row.type,
    status: row.status,
    agentId: row.agentId,
    reason: row.reason,
    intakeComment: row.intakeComment,
    comment: row.comment,
    requestedAmount:
      row.requestedAmountMinor != null && row.requestedCurrencyPrecision != null
        ? minorToDecimalString(
            row.requestedAmountMinor,
            row.requestedCurrencyPrecision,
          )
        : null,
    requestedCurrencyId: row.requestedCurrencyId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapLeg(row: {
  id: string;
  idx: number;
  kind:
    | "payment"
    | "currency_exchange"
    | "currency_transit"
    | "exporter_settlement";
  status:
    | "draft"
    | "submitted"
    | "rejected"
    | "preparing_documents"
    | "awaiting_funds"
    | "awaiting_payment"
    | "closing_documents"
    | "done"
    | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}): DealLeg {
  return {
    id: row.id,
    idx: Number(row.idx),
    kind: row.kind,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapParticipant(row: {
  id: string;
  role: "customer" | "organization" | "counterparty";
  customerId: string | null;
  organizationId: string | null;
  counterpartyId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): DealParticipant {
  return {
    id: row.id,
    role: row.role,
    partyId: row.customerId ?? row.organizationId ?? row.counterpartyId!,
    customerId: row.customerId,
    organizationId: row.organizationId,
    counterpartyId: row.counterpartyId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapStatusHistory(row: {
  id: string;
  status:
    | "draft"
    | "submitted"
    | "rejected"
    | "preparing_documents"
    | "awaiting_funds"
    | "awaiting_payment"
    | "closing_documents"
    | "done"
    | "cancelled";
  changedBy: string | null;
  comment: string | null;
  createdAt: Date;
}): DealStatusHistoryEntry {
  return {
    id: row.id,
    status: row.status,
    changedBy: row.changedBy,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

function mapApproval(row: {
  id: string;
  approvalType: "commercial" | "compliance" | "operations";
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedBy: string | null;
  decidedBy: string | null;
  comment: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
}): DealApproval {
  return {
    id: row.id,
    approvalType: row.approvalType,
    status: row.status,
    requestedBy: row.requestedBy,
    decidedBy: row.decidedBy,
    comment: row.comment,
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
  };
}

export class DrizzleDealReads implements DealReads {
  constructor(
    private readonly db: Queryable,
    private readonly currenciesQueries: Pick<CurrenciesQueries, "listByIds">,
  ) {}

  async findById(id: string): Promise<DealDetails | null> {
    const [dealRow] = await this.db
      .select({
        id: deals.id,
        customerId: deals.customerId,
        agreementId: deals.agreementId,
        calculationId: deals.calculationId,
        type: deals.type,
        status: deals.status,
        agentId: deals.agentId,
        reason: deals.reason,
        intakeComment: deals.intakeComment,
        comment: deals.comment,
        requestedAmountMinor: deals.requestedAmountMinor,
        requestedCurrencyId: deals.requestedCurrencyId,
        createdAt: deals.createdAt,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .where(eq(deals.id, id))
      .limit(1);

    if (!dealRow) {
      return null;
    }
    const requestedCurrencies = await this.currenciesQueries.listByIds(
      dealRow.requestedCurrencyId ? [dealRow.requestedCurrencyId] : [],
    );
    const requestedCurrencyPrecision = dealRow.requestedCurrencyId
      ? requestedCurrencies.get(dealRow.requestedCurrencyId)?.precision ?? null
      : null;

    const [legRows, participantRows, historyRows, approvalRows] =
      await Promise.all([
        this.db
          .select({
            id: dealLegs.id,
            idx: dealLegs.idx,
            kind: dealLegs.kind,
            status: dealLegs.status,
            createdAt: dealLegs.createdAt,
            updatedAt: dealLegs.updatedAt,
          })
          .from(dealLegs)
          .where(eq(dealLegs.dealId, id))
          .orderBy(asc(dealLegs.idx)),
        this.db
          .select({
            id: dealParticipants.id,
            role: dealParticipants.role,
            customerId: dealParticipants.customerId,
            organizationId: dealParticipants.organizationId,
            counterpartyId: dealParticipants.counterpartyId,
            createdAt: dealParticipants.createdAt,
            updatedAt: dealParticipants.updatedAt,
          })
          .from(dealParticipants)
          .where(eq(dealParticipants.dealId, id))
          .orderBy(asc(dealParticipants.createdAt)),
        this.db
          .select({
            id: dealStatusHistory.id,
            status: dealStatusHistory.status,
            changedBy: dealStatusHistory.changedBy,
            comment: dealStatusHistory.comment,
            createdAt: dealStatusHistory.createdAt,
          })
          .from(dealStatusHistory)
          .where(eq(dealStatusHistory.dealId, id))
          .orderBy(asc(dealStatusHistory.createdAt)),
        this.db
          .select({
            id: dealApprovals.id,
            approvalType: dealApprovals.approvalType,
            status: dealApprovals.status,
            requestedBy: dealApprovals.requestedBy,
            decidedBy: dealApprovals.decidedBy,
            comment: dealApprovals.comment,
            requestedAt: dealApprovals.requestedAt,
            decidedAt: dealApprovals.decidedAt,
          })
          .from(dealApprovals)
          .where(eq(dealApprovals.dealId, id))
          .orderBy(asc(dealApprovals.requestedAt)),
      ]);

    return {
      ...mapDeal({
        ...dealRow,
        requestedCurrencyPrecision,
      }),
      legs: legRows.map(mapLeg),
      participants: participantRows.map(mapParticipant),
      statusHistory: historyRows.map(mapStatusHistory),
      approvals: approvalRows.map(mapApproval),
    };
  }

  async list(input: ListDealsQuery): Promise<PaginatedList<Deal>> {
    const conditions: SQL[] = [];

    if (input.customerId) {
      conditions.push(eq(deals.customerId, input.customerId));
    }

    if (input.agreementId) {
      conditions.push(eq(deals.agreementId, input.agreementId));
    }

    if (input.calculationId) {
      conditions.push(eq(deals.calculationId, input.calculationId));
    }

    if (input.type) {
      conditions.push(eq(deals.type, input.type as DealType));
    }

    if (input.status) {
      conditions.push(eq(deals.status, input.status as DealStatus));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      DEALS_SORT_COLUMN_MAP,
      deals.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          id: deals.id,
          customerId: deals.customerId,
          agreementId: deals.agreementId,
          calculationId: deals.calculationId,
          type: deals.type,
          status: deals.status,
          agentId: deals.agentId,
          reason: deals.reason,
          intakeComment: deals.intakeComment,
          comment: deals.comment,
          requestedAmountMinor: deals.requestedAmountMinor,
          requestedCurrencyId: deals.requestedCurrencyId,
          createdAt: deals.createdAt,
          updatedAt: deals.updatedAt,
        })
        .from(deals)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(deals)
        .where(where),
    ]);
    const requestedCurrencies = await this.currenciesQueries.listByIds(
      rows
        .map((row) => row.requestedCurrencyId)
        .filter((currencyId): currencyId is string => Boolean(currencyId)),
    );

    return {
      data: rows.map((row) =>
        mapDeal({
          ...row,
          requestedCurrencyPrecision: row.requestedCurrencyId
            ? requestedCurrencies.get(row.requestedCurrencyId)?.precision ?? null
            : null,
        }),
      ),
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }
}

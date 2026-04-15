import { DEAL_OPERATIONAL_POSITION_KIND_VALUES } from "./constants";
import type {
  DealHeader,
  DealOperationalPosition,
  DealOperationalState,
  DealSectionCompleteness,
  DealWorkflowLeg,
} from "../application/contracts/dto";
import type {
  DealOperationalPositionKind,
  DealOperationalPositionState,
  DealStatus,
} from "../application/contracts/zod";

interface CalculationOperationalLine {
  amountMinor: string;
  currencyId: string;
  kind: "fee_revenue" | "spread_revenue";
  updatedAt: Date;
}

const OPERATIONAL_POSITION_PROGRESS_ORDER: Record<
  DealOperationalPositionState,
  number
> = {
  not_applicable: 0,
  pending: 1,
  ready: 2,
  in_progress: 3,
  done: 4,
  blocked: -1,
};

function sourceRefsFromLegs(legs: DealWorkflowLeg[]): string[] {
  return legs.map((leg) => `leg:${leg.idx}:${leg.kind}`);
}

function aggregateLegState(
  legs: DealWorkflowLeg[],
): DealOperationalPositionState {
  if (legs.length === 0) {
    return "not_applicable";
  }

  if (legs.some((leg) => leg.state === "blocked")) {
    return "blocked";
  }

  if (legs.every((leg) => leg.state === "done" || leg.state === "skipped")) {
    return "done";
  }

  if (legs.some((leg) => leg.state === "in_progress")) {
    return "in_progress";
  }

  if (legs.some((leg) => leg.state === "ready")) {
    return "ready";
  }

  return "pending";
}

function positionReasonCodeFromState(
  state: DealOperationalPositionState,
): string | null {
  switch (state) {
    case "blocked":
      return "execution_blocked";
    case "pending":
      return "execution_pending";
    default:
      return null;
  }
}

function buildLegBackedPosition(input: {
  kind: DealOperationalPositionKind;
  legs: DealWorkflowLeg[];
  updatedAt: Date;
}): DealOperationalPosition {
  const state = aggregateLegState(input.legs);

  return {
    amountMinor: null,
    currencyId: null,
    kind: input.kind,
    reasonCode: positionReasonCodeFromState(state),
    sourceRefs: sourceRefsFromLegs(input.legs),
    state,
    updatedAt: state === "not_applicable" ? null : input.updatedAt,
  };
}

function buildPendingPosition(input: {
  kind: DealOperationalPositionKind;
  reasonCode: string;
  sourceRefs?: string[];
  updatedAt: Date;
}): DealOperationalPosition {
  return {
    amountMinor: null,
    currencyId: null,
    kind: input.kind,
    reasonCode: input.reasonCode,
    sourceRefs: input.sourceRefs ?? [],
    state: "pending",
    updatedAt: input.updatedAt,
  };
}

function buildNotApplicablePosition(
  kind: DealOperationalPositionKind,
): DealOperationalPosition {
  return {
    amountMinor: null,
    currencyId: null,
    kind,
    reasonCode: null,
    sourceRefs: [],
    state: "not_applicable",
    updatedAt: null,
  };
}

export function listRequiredOperationalPositionKinds(
  type: DealHeader["type"],
): DealOperationalPositionKind[] {
  switch (type) {
    case "payment":
    case "currency_exchange":
    case "internal_treasury":
      return ["customer_receivable", "provider_payable"];
    case "currency_transit":
      return ["customer_receivable", "provider_payable", "in_transit"];
    case "exporter_settlement":
      return [
        "customer_receivable",
        "provider_payable",
        "exporter_expected_receivable",
      ];
  }
}

export function isOperationalPositionAtLeastReady(
  state: DealOperationalPositionState,
): boolean {
  return OPERATIONAL_POSITION_PROGRESS_ORDER[state] >=
    OPERATIONAL_POSITION_PROGRESS_ORDER.ready;
}

export function isOperationalPositionDone(
  state: DealOperationalPositionState,
): boolean {
  return state === "done";
}

export function buildDealOperationalState(input: {
  calculationId: string | null;
  calculationLines: CalculationOperationalLine[];
  executionPlan: DealWorkflowLeg[];
  header: DealHeader;
  sectionCompleteness: DealSectionCompleteness[];
  status: DealStatus;
  updatedAt: Date;
}): DealOperationalState {
  const collectLegs = input.executionPlan.filter((leg) => leg.kind === "collect");
  const downstreamLegs = input.executionPlan.filter((leg) =>
    ["payout", "transit_hold", "settle_exporter"].includes(leg.kind),
  );
  const transitLegs = input.executionPlan.filter((leg) => leg.kind === "transit_hold");
  const incomingReceiptSection =
    input.sectionCompleteness.find((section) => section.sectionId === "incomingReceipt") ??
    null;

  const calculationLineByKind = new Map(
    input.calculationLines.map((line) => [line.kind, line] as const),
  );

  const positions: DealOperationalPosition[] =
    DEAL_OPERATIONAL_POSITION_KIND_VALUES.map((kind) => {
      switch (kind) {
      case "customer_receivable":
        return collectLegs.length > 0
          ? buildLegBackedPosition({
              kind,
              legs: collectLegs,
              updatedAt: input.updatedAt,
            })
          : buildNotApplicablePosition(kind);
      case "provider_payable":
        return downstreamLegs.length > 0
          ? buildLegBackedPosition({
              kind,
              legs: downstreamLegs,
              updatedAt: input.updatedAt,
            })
          : buildNotApplicablePosition(kind);
      case "in_transit":
        return transitLegs.length > 0
          ? buildLegBackedPosition({
              kind,
              legs: transitLegs,
              updatedAt: input.updatedAt,
            })
          : buildNotApplicablePosition(kind);
      case "exporter_expected_receivable": {
        if (input.header.type !== "exporter_settlement") {
          return buildNotApplicablePosition(kind);
        }

        const collectState = aggregateLegState(collectLegs);
        if (collectState === "blocked") {
          return {
            amountMinor: null,
            currencyId: null,
            kind,
            reasonCode: "execution_blocked",
            sourceRefs: sourceRefsFromLegs(collectLegs),
            state: "blocked" as const,
            updatedAt: input.updatedAt,
          } satisfies DealOperationalPosition;
        }
        if (collectState === "in_progress") {
          return {
            amountMinor: null,
            currencyId: null,
            kind,
            reasonCode: null,
            sourceRefs: sourceRefsFromLegs(collectLegs),
            state: "in_progress" as const,
            updatedAt: input.updatedAt,
          } satisfies DealOperationalPosition;
        }
        if (collectState === "done") {
          return {
            amountMinor: null,
            currencyId: null,
            kind,
            reasonCode: null,
            sourceRefs: sourceRefsFromLegs(collectLegs),
            state: "done" as const,
            updatedAt: input.updatedAt,
          } satisfies DealOperationalPosition;
        }
        if (incomingReceiptSection?.complete) {
          return {
            amountMinor: null,
            currencyId: input.header.incomingReceipt.expectedCurrencyId,
            kind,
            reasonCode: null,
            sourceRefs: ["section:incomingReceipt", ...sourceRefsFromLegs(collectLegs)],
            state: "ready" as const,
            updatedAt: input.updatedAt,
          } satisfies DealOperationalPosition;
        }
        return buildPendingPosition({
          kind,
          reasonCode: "incoming_receipt_incomplete",
          sourceRefs: ["section:incomingReceipt"],
          updatedAt: input.updatedAt,
        });
      }
      case "fee_revenue":
      case "spread_revenue": {
        const line = calculationLineByKind.get(kind);
        if (!input.calculationId) {
          return buildPendingPosition({
            kind,
            reasonCode: "calculation_missing",
            updatedAt: input.updatedAt,
          });
        }
        if (!line) {
          return buildNotApplicablePosition(kind);
        }
        return {
          amountMinor: line.amountMinor,
          currencyId: line.currencyId,
          kind,
          reasonCode: null,
          sourceRefs: [`calculation:${input.calculationId}:line:${kind}`],
          state:
            input.status === "closed" ? ("done" as const) : ("ready" as const),
          updatedAt: line.updatedAt,
        } satisfies DealOperationalPosition;
      }
      case "intercompany_due_from":
      case "intercompany_due_to":
      case "suspense":
        return buildNotApplicablePosition(kind);
      }
    });

  return {
    positions,
  };
}

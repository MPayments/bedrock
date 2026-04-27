import {
  createTreasuryOrdersServiceContext,
  type TreasuryOrdersServiceDeps,
} from "./context";
import {
  CreateTreasuryOrderInputSchema,
  GetTreasuryOrderByIdInputSchema,
  ListTreasuryOrdersQuerySchema,
  TreasuryOrderSchema,
  type CreateTreasuryOrderInput,
  type GetTreasuryOrderByIdInput,
  type ListTreasuryOrdersQuery,
} from "./contracts";
import {
  TreasuryOrderConflictError,
  TreasuryOrderNotFoundError,
  ValidationError,
} from "../../errors";
import { TreasuryOrder } from "../domain/treasury-order";

export function createTreasuryOrdersService(deps: TreasuryOrdersServiceDeps) {
  const context = createTreasuryOrdersServiceContext(deps);

  async function create(raw: CreateTreasuryOrderInput) {
    const input = CreateTreasuryOrderInputSchema.parse(raw);
    const now = context.runtime.now();
    const order = TreasuryOrder.create(
      {
        description: input.description,
        id: input.id ?? context.runtime.generateUuid(),
        steps: input.steps,
        type: input.type,
      },
      now,
      context.runtime.generateUuid,
    );
    const inserted = await context.repository.insert(order.toSnapshot());
    if (!inserted) {
      throw new TreasuryOrderConflictError(order.id);
    }
    return TreasuryOrderSchema.parse(inserted);
  }

  async function activate(raw: GetTreasuryOrderByIdInput) {
    const input = GetTreasuryOrderByIdInputSchema.parse(raw);
    const current = await context.repository.findById(input.orderId);
    if (!current) {
      throw new TreasuryOrderNotFoundError(input.orderId);
    }

    let order = TreasuryOrder.fromSnapshot(current).activate(context.runtime.now());
    const activated = order.toSnapshot();
    const purpose = activated.type === "pre_fund" ? "pre_fund" : "standalone_payment";

    for (const step of activated.steps) {
      if (step.paymentStepId || step.quoteExecutionId) continue;
      if (step.kind === "quote_execution") {
        if (!step.quoteId) {
          throw new ValidationError(
            `Treasury order step ${step.id} requires quoteId`,
          );
        }
        if (!step.fromAmountMinor || !step.toAmountMinor) {
          throw new ValidationError(
            `Treasury order FX step ${step.id} requires amounts`,
          );
        }
        const created = await context.quoteExecutions.commands.create({
          dealId: null,
          fromAmountMinor: step.fromAmountMinor,
          fromCurrencyId: step.fromCurrencyId,
          initialState: "pending",
          origin: {
            dealId: null,
            planLegId: step.id,
            routeSnapshotLegId: null,
            sequence: step.sequence,
            treasuryOrderId: activated.id,
            type: "treasury_order_step",
          },
          quoteId: step.quoteId,
          quoteLegIdx: null,
          quoteSnapshot: null,
          settlementRoute: {
            creditParty: step.toParty,
            debitParty: step.fromParty,
          },
          sourceRef: step.sourceRef,
          toAmountMinor: step.toAmountMinor,
          toCurrencyId: step.toCurrencyId,
          treasuryOrderId: activated.id,
        });
        order = order.linkQuoteExecution(
          step.id,
          created.id,
          context.runtime.now(),
        );
        continue;
      }
      const created = await context.paymentSteps.commands.create({
        dealId: null,
        fromAmountMinor: step.fromAmountMinor,
        fromCurrencyId: step.fromCurrencyId,
        fromParty: step.fromParty,
        initialState: "pending",
        kind: step.kind,
        origin: {
          dealId: null,
          planLegId: step.id,
          routeSnapshotLegId: null,
          sequence: step.sequence,
          treasuryOrderId: activated.id,
          type: "treasury_order_step",
        },
        planLegId: step.id,
        purpose,
        quoteId: step.quoteId,
        rate: step.rate,
        routeSnapshotLegId: null,
        sequence: step.sequence,
        sourceRef: step.sourceRef,
        toAmountMinor: step.toAmountMinor,
        toCurrencyId: step.toCurrencyId,
        toParty: step.toParty,
        treasuryBatchId: null,
        treasuryOrderId: activated.id,
      });
      order = order.linkPaymentStep(step.id, created.id, context.runtime.now());
    }

    const persisted = await context.repository.update(order.toSnapshot());
    if (!persisted) {
      throw new TreasuryOrderNotFoundError(input.orderId);
    }
    return TreasuryOrderSchema.parse(persisted);
  }

  async function cancel(raw: GetTreasuryOrderByIdInput) {
    const input = GetTreasuryOrderByIdInputSchema.parse(raw);
    const current = await context.repository.findById(input.orderId);
    if (!current) {
      throw new TreasuryOrderNotFoundError(input.orderId);
    }

    const cancelled = TreasuryOrder.fromSnapshot(current).cancel(
      context.runtime.now(),
    );
    const persisted = await context.repository.update(cancelled.toSnapshot());
    if (!persisted) {
      throw new TreasuryOrderNotFoundError(input.orderId);
    }
    return TreasuryOrderSchema.parse(persisted);
  }

  async function findById(raw: GetTreasuryOrderByIdInput) {
    const input = GetTreasuryOrderByIdInputSchema.parse(raw);
    const order = await context.repository.findById(input.orderId);
    return order ? TreasuryOrderSchema.parse(order) : null;
  }

  async function list(raw: ListTreasuryOrdersQuery) {
    const input = ListTreasuryOrdersQuerySchema.parse(raw);
    const result = await context.repository.list(input);
    return {
      data: result.rows.map((row) => TreasuryOrderSchema.parse(row)),
      limit: input.limit,
      offset: input.offset,
      total: result.total,
    };
  }

  return {
    commands: { activate, cancel, create },
    queries: { findById, list },
  };
}

export type TreasuryOrdersService = ReturnType<typeof createTreasuryOrdersService>;

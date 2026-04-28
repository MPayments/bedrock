import {
  createTreasuryOrdersServiceContext,
  type TreasuryOrdersServiceDeps,
} from "./context";
import {
  CreateInventoryPositionFromQuoteExecutionInputSchema,
  CreateTreasuryOrderInputSchema,
  GetInventoryPositionByIdInputSchema,
  GetReservedAllocationByDealAndQuoteInputSchema,
  GetTreasuryOrderByIdInputSchema,
  ListInventoryPositionsQuerySchema,
  ListTreasuryOrdersQuerySchema,
  ReserveInventoryAllocationInputSchema,
  TreasuryInventoryAllocationSchema,
  TreasuryInventoryPositionSchema,
  TreasuryOrderSchema,
  type CreateInventoryPositionFromQuoteExecutionInput,
  type CreateTreasuryOrderInput,
  type GetInventoryPositionByIdInput,
  type GetReservedAllocationByDealAndQuoteInput,
  type GetTreasuryOrderByIdInput,
  type ListInventoryPositionsQuery,
  type ListTreasuryOrdersQuery,
  type ReserveInventoryAllocationInput,
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
          executionParties: {
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

  async function createInventoryPositionFromQuoteExecution(
    raw: CreateInventoryPositionFromQuoteExecutionInput,
  ) {
    const input = CreateInventoryPositionFromQuoteExecutionInputSchema.parse(raw);
    const existing =
      await context.repository.findInventoryPositionByQuoteExecutionId(
        input.executionId,
      );
    if (existing) {
      return TreasuryInventoryPositionSchema.parse(existing);
    }

    const execution = await context.quoteExecutions.queries.findById({
      executionId: input.executionId,
    });
    if (!execution) {
      throw new ValidationError(
        `Quote execution ${input.executionId} is not available`,
      );
    }
    if (execution.state !== "completed") {
      throw new ValidationError(
        `Quote execution ${input.executionId} is not completed`,
      );
    }
    if (!execution.treasuryOrderId) {
      throw new ValidationError(
        `Quote execution ${input.executionId} is not linked to a treasury order`,
      );
    }

    const order = await context.repository.findById(execution.treasuryOrderId);
    if (!order) {
      throw new TreasuryOrderNotFoundError(execution.treasuryOrderId);
    }
    if (order.type !== "liquidity_purchase") {
      throw new ValidationError(
        `Treasury order ${order.id} is not a liquidity purchase`,
      );
    }
    const creditParty = execution.executionParties?.creditParty;
    if (!creditParty?.id) {
      throw new ValidationError(
        `Quote execution ${input.executionId} is missing credit party`,
      );
    }

    const now = context.runtime.now();
    const position = {
      acquiredAmountMinor: execution.toAmountMinor,
      availableAmountMinor: execution.toAmountMinor,
      costAmountMinor: execution.fromAmountMinor,
      costCurrencyId: execution.fromCurrencyId,
      createdAt: now,
      currencyId: execution.toCurrencyId,
      id: input.id ?? context.runtime.generateUuid(),
      ownerPartyId: creditParty.id,
      ownerRequisiteId: creditParty.requisiteId,
      sourceOrderId: order.id,
      sourceQuoteExecutionId: execution.id,
      state: "open" as const,
      updatedAt: now,
    };
    const inserted = await context.repository.insertInventoryPosition(position);
    if (!inserted) {
      const raced =
        await context.repository.findInventoryPositionByQuoteExecutionId(
          input.executionId,
        );
      if (raced) {
        return TreasuryInventoryPositionSchema.parse(raced);
      }
      throw new TreasuryOrderConflictError(position.id);
    }
    const completedOrder = TreasuryOrder.fromSnapshot(order).complete(now);
    await context.repository.update(completedOrder.toSnapshot());
    return TreasuryInventoryPositionSchema.parse(inserted);
  }

  async function reserveInventoryAllocation(
    raw: ReserveInventoryAllocationInput,
  ) {
    const input = ReserveInventoryAllocationInputSchema.parse(raw);
    const position = await context.repository.findInventoryPositionById(
      input.positionId,
    );
    if (!position) {
      throw new ValidationError(
        `Treasury inventory position ${input.positionId} is not available`,
      );
    }
    if (
      position.state !== "open" ||
      position.availableAmountMinor < input.amountMinor
    ) {
      throw new ValidationError(
        `Treasury inventory position ${input.positionId} has insufficient liquidity`,
      );
    }

    const costAmountMinor =
      position.acquiredAmountMinor === 0n
        ? 0n
        : (input.amountMinor * position.costAmountMinor +
            position.acquiredAmountMinor / 2n) /
          position.acquiredAmountMinor;
    const now = context.runtime.now();
    const reserved = await context.repository.reserveInventoryAllocation({
      amountMinor: input.amountMinor,
      costAmountMinor,
      createdAt: now,
      dealId: input.dealId,
      id: input.id ?? context.runtime.generateUuid(),
      positionId: input.positionId,
      quoteId: input.quoteId,
      state: "reserved",
      updatedAt: now,
    });
    if (!reserved) {
      throw new ValidationError(
        `Treasury inventory position ${input.positionId} has insufficient liquidity`,
      );
    }
    return TreasuryInventoryAllocationSchema.parse(reserved.allocation);
  }

  async function listInventoryPositions(raw: ListInventoryPositionsQuery) {
    const input = ListInventoryPositionsQuerySchema.parse(raw);
    const result = await context.repository.listInventoryPositions(input);
    return {
      data: result.rows.map((row) => TreasuryInventoryPositionSchema.parse(row)),
      limit: input.limit,
      offset: input.offset,
      total: result.total,
    };
  }

  async function findInventoryPositionById(raw: GetInventoryPositionByIdInput) {
    const input = GetInventoryPositionByIdInputSchema.parse(raw);
    const position = await context.repository.findInventoryPositionById(
      input.positionId,
    );
    return position ? TreasuryInventoryPositionSchema.parse(position) : null;
  }

  async function findReservedAllocationByDealAndQuote(
    raw: GetReservedAllocationByDealAndQuoteInput,
  ) {
    const input = GetReservedAllocationByDealAndQuoteInputSchema.parse(raw);
    const allocation =
      await context.repository.findReservedAllocationByDealAndQuote(input);
    return allocation ? TreasuryInventoryAllocationSchema.parse(allocation) : null;
  }

  return {
    commands: {
      activate,
      cancel,
      create,
      createInventoryPositionFromQuoteExecution,
      reserveInventoryAllocation,
    },
    queries: {
      findById,
      findInventoryPositionById,
      findReservedAllocationByDealAndQuote,
      list,
      listInventoryPositions,
    },
  };
}

export type TreasuryOrdersService = ReturnType<typeof createTreasuryOrdersService>;

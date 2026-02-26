import { and, eq, sql } from "drizzle-orm";

import {
  ACCOUNT_NO,
  CLEARING_KIND,
  OPERATION_CODE,
  POSTING_CODE,
  resolveAdjustmentInLedgerPostingTemplate,
  resolveAdjustmentReservePostingTemplate,
  resolveFeeReservePostingTemplate,
  resolveInLedgerFeePostingTemplate,
  resolveProviderFeeExpenseAccrualPostingTemplate,
} from "@bedrock/accounting";
import { type Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { makePlanKey } from "@bedrock/kernel";
import { TransferCodes } from "@bedrock/kernel/constants";
import { OPERATION_TRANSFER_TYPE } from "@bedrock/ledger";

import {
  AmountMismatchError,
  CurrencyMismatchError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from "../errors";
import {
  SYSTEM_LEDGER_ORG_ID,
  type TreasuryServiceContext,
} from "../internal/context";
import { consumeFxQuoteForExecution } from "../internal/fx-quote";
import {
  buildTreasuryIntent,
  type TemplateLine,
} from "../internal/ledger-operation";
import {
  ExecuteFxAllowedFrom,
  TreasuryOrderStatus,
  isOrderStatusIn,
  isSameEntryInAllowedState,
} from "../state-machine";
import { type ExecuteFxInput, validateExecuteFxInput } from "../validation";

export function createExecuteFxHandler(context: TreasuryServiceContext) {
  const { db, ledger, feesService, currenciesService, log } = context;

  return async function executeFx(input: ExecuteFxInput) {
    const validated = validateExecuteFxInput(input);
    log.debug("executeFx start", {
      orderId: validated.orderId,
      quoteRef: validated.quoteRef,
    });

    return db.transaction(async (tx: Transaction) => {
      const [order] = await tx
        .select()
        .from(schema.paymentOrders)
        .where(eq(schema.paymentOrders.id, validated.orderId))
        .limit(1);

      if (!order) throw new NotFoundError("Order", validated.orderId);
      const { code: payInCurrency } = await currenciesService.findById(
        order.payInCurrencyId,
      );
      const { code: payOutCurrency } = await currenciesService.findById(
        order.payOutCurrencyId,
      );

      if (validated.payInCurrency !== payInCurrency) {
        throw new CurrencyMismatchError(
          "payInCurrency",
          payInCurrency,
          validated.payInCurrency,
        );
      }
      if (validated.payOutCurrency !== payOutCurrency) {
        throw new CurrencyMismatchError(
          "payOutCurrency",
          payOutCurrency,
          validated.payOutCurrency,
        );
      }

      if (validated.principalMinor !== order.payInExpectedMinor) {
        throw new AmountMismatchError(
          "principalMinor (payInExpectedMinor)",
          order.payInExpectedMinor,
          validated.principalMinor,
        );
      }
      if (validated.payOutAmountMinor !== order.payOutAmountMinor) {
        throw new AmountMismatchError(
          "payOutAmountMinor",
          order.payOutAmountMinor,
          validated.payOutAmountMinor,
        );
      }
      if (validated.customerId !== order.customerId) {
        throw new ValidationError(
          `customerId mismatch: expected ${order.customerId}, got ${validated.customerId}`,
        );
      }
      if (
        validated.branchCounterpartyId !== order.payInCounterpartyId &&
        validated.branchCounterpartyId !== order.payOutCounterpartyId
      ) {
        throw new ValidationError(
          `branchCounterpartyId mismatch: expected one of [${order.payInCounterpartyId}, ${order.payOutCounterpartyId}], got ${validated.branchCounterpartyId}`,
        );
      }

      if (!isOrderStatusIn(order.status, ExecuteFxAllowedFrom)) {
        throw new InvalidStateError(
          `Order must be ${TreasuryOrderStatus.FUNDING_SETTLED} (posted), got ${order.status}`,
        );
      }

      const quote = await consumeFxQuoteForExecution(
        tx,
        validated,
        currenciesService,
      );
      const persistedQuoteLegRows = await tx
        .select()
        .from(schema.fxQuoteLegs)
        .where(eq(schema.fxQuoteLegs.quoteId, quote.id))
        .limit(2048);
      const legCurrencyIds = [
        ...new Set(
          persistedQuoteLegRows
            .flatMap((leg) => [
              (leg as { fromCurrencyId?: string }).fromCurrencyId,
              (leg as { toCurrencyId?: string }).toCurrencyId,
            ])
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const legCurrencyCodeById = new Map<string, string>();
      await Promise.all(
        legCurrencyIds.map(async (id) => {
          const currency = await currenciesService.findById(id);
          legCurrencyCodeById.set(id, currency.code);
        }),
      );
      const persistedQuoteLegs = persistedQuoteLegRows.map((leg) => ({
        ...leg,
        fromCurrency: legCurrencyCodeById.get(
          (leg as { fromCurrencyId: string }).fromCurrencyId,
        )!,
        toCurrency: legCurrencyCodeById.get(
          (leg as { toCurrencyId: string }).toCurrencyId,
        )!,
      }));
      persistedQuoteLegs.sort((a: any, b: any) => a.idx - b.idx);

      if (
        !persistedQuoteLegs.length &&
        (quote.pricingMode ?? "auto_cross") === "explicit_route"
      ) {
        throw new InvalidStateError(
          `Quote ${quote.id} has explicit_route pricingMode but no persisted legs`,
        );
      }

      const routeLegs = persistedQuoteLegs.length
        ? persistedQuoteLegs
        : [
            {
              idx: 1,
              fromCurrency: quote.fromCurrency,
              toCurrency: quote.toCurrency,
              fromAmountMinor: quote.fromAmountMinor,
              toAmountMinor: quote.toAmountMinor,
              rateNum: quote.rateNum,
              rateDen: quote.rateDen,
              sourceKind: "derived",
              sourceRef: null,
              asOf: validated.occurredAt,
              executionCounterpartyId: null,
              createdAt: validated.occurredAt,
              id: quote.id,
              quoteId: quote.id,
            },
          ];

      if (routeLegs[0]!.fromCurrency !== validated.payInCurrency) {
        throw new CurrencyMismatchError(
          "route[0].fromCurrency",
          routeLegs[0]!.fromCurrency,
          validated.payInCurrency,
        );
      }
      if (
        routeLegs[routeLegs.length - 1]!.toCurrency !== validated.payOutCurrency
      ) {
        throw new CurrencyMismatchError(
          "route[last].toCurrency",
          routeLegs[routeLegs.length - 1]!.toCurrency,
          validated.payOutCurrency,
        );
      }
      if (routeLegs[0]!.fromAmountMinor !== validated.principalMinor) {
        throw new AmountMismatchError(
          "route[0].fromAmountMinor",
          routeLegs[0]!.fromAmountMinor,
          validated.principalMinor,
        );
      }
      if (
        routeLegs[routeLegs.length - 1]!.toAmountMinor !==
        validated.payOutAmountMinor
      ) {
        throw new AmountMismatchError(
          "route[last].toAmountMinor",
          routeLegs[routeLegs.length - 1]!.toAmountMinor,
          validated.payOutAmountMinor,
        );
      }

      const chain = `fx:${validated.quoteRef}`;
      const lines: TemplateLine[] = [];
      const separateFeeOrders: {
        componentId: string;
        kind: string;
        bucket: string;
        accountingTreatment: "income" | "pass_through" | "expense";
        currency: string;
        amountMinor: bigint;
        memo: string | null | undefined;
        metadata: Record<string, string> | undefined;
        payoutOperationalAccountId: string;
      }[] = [];
      const defaultFeePayoutOperationalAccountId =
        order.payOutAccountId ?? order.payInAccountId;
      if (!defaultFeePayoutOperationalAccountId) {
        throw new ValidationError(
          `Order ${order.id} is missing payIn/payOut operational account ids for fee settlement`,
        );
      }

      lines.push({
        type: OPERATION_TRANSFER_TYPE.CREATE,
        chain,
        planKey: makePlanKey("fx_principal", {
          quoteRef: validated.quoteRef,
          orderId: validated.orderId,
          currency: validated.payInCurrency,
          amount: validated.principalMinor.toString(),
        }),
        postingCode: POSTING_CODE.FX_PRINCIPAL,
        debit: {
          accountNo: ACCOUNT_NO.CUSTOMER_WALLET,
          currency: validated.payInCurrency,
          dimensions: { customerId: validated.customerId },
        },
        credit: {
          accountNo: ACCOUNT_NO.ORDER_RESERVE,
          currency: validated.payInCurrency,
          dimensions: { orderId: validated.orderId },
        },
        amountMinor: validated.principalMinor,
        code: TransferCodes.FX_PRINCIPAL,
        memo: "FX principal",
      });

      for (const leg of routeLegs) {
        const executionCounterpartyId =
          leg.executionCounterpartyId ?? validated.branchCounterpartyId;

        lines.push({
          type: OPERATION_TRANSFER_TYPE.CREATE,
          chain,
          planKey: makePlanKey("fx_leg_out", {
            quoteRef: validated.quoteRef,
            orderId: validated.orderId,
            idx: leg.idx,
            executionCounterpartyId,
            fromCurrency: leg.fromCurrency,
            amount: leg.fromAmountMinor.toString(),
          }),
          postingCode: POSTING_CODE.FX_LEG_OUT,
          debit: {
            accountNo: ACCOUNT_NO.ORDER_RESERVE,
            currency: leg.fromCurrency,
            dimensions: { orderId: validated.orderId },
          },
          credit: {
            accountNo: ACCOUNT_NO.CLEARING,
            currency: leg.fromCurrency,
            dimensions: {
              clearingKind: CLEARING_KIND.TREASURY_FX,
              orderId: validated.orderId,
              counterpartyId: executionCounterpartyId,
            },
          },
          amountMinor: leg.fromAmountMinor,
          code: TransferCodes.FX_LEG_OUT,
          memo: `FX leg ${leg.idx} out`,
        });

        lines.push({
          type: OPERATION_TRANSFER_TYPE.CREATE,
          chain,
          planKey: makePlanKey("fx_leg_in", {
            quoteRef: validated.quoteRef,
            orderId: validated.orderId,
            idx: leg.idx,
            executionCounterpartyId,
            toCurrency: leg.toCurrency,
            amount: leg.toAmountMinor.toString(),
          }),
          postingCode: POSTING_CODE.FX_LEG_IN,
          debit: {
            accountNo: ACCOUNT_NO.CLEARING,
            currency: leg.toCurrency,
            dimensions: {
              clearingKind: CLEARING_KIND.TREASURY_FX,
              orderId: validated.orderId,
              counterpartyId: executionCounterpartyId,
            },
          },
          credit: {
            accountNo: ACCOUNT_NO.ORDER_RESERVE,
            currency: leg.toCurrency,
            dimensions: { orderId: validated.orderId },
          },
          amountMinor: leg.toAmountMinor,
          code: TransferCodes.FX_LEG_IN,
          memo: `FX leg ${leg.idx} in`,
        });
      }

      const quoteFeeComponents = await feesService.getQuoteFeeComponents(
        { quoteId: quote.id },
        tx,
      );
      const mergedFeeComponents = feesService.mergeFeeComponents({
        computed: quoteFeeComponents,
        manual: validated.fees,
      });

      for (const [idx, component] of mergedFeeComponents.entries()) {
        const defaults = feesService.getComponentDefaults(component.kind);
        const accountingTreatment =
          component.accountingTreatment ??
          (component.settlementMode === "separate_payment_order"
            ? "pass_through"
            : "income");

        if (accountingTreatment === "income") {
          const posting = resolveInLedgerFeePostingTemplate(component.kind);

          lines.push({
            type: OPERATION_TRANSFER_TYPE.CREATE,
            chain,
            planKey: makePlanKey("fx_fee_component_income", {
              quoteRef: validated.quoteRef,
              orderId: validated.orderId,
              idx: idx + 1,
              componentId: component.id,
              kind: component.kind,
              currency: component.currency,
              amount: component.amountMinor.toString(),
            }),
            postingCode: posting.postingCode,
            debit: {
              accountNo: posting.debitAccountNo,
              currency: component.currency,
              dimensions: { customerId: validated.customerId },
            },
            credit: {
              accountNo: posting.creditAccountNo,
              currency: component.currency,
              dimensions: {
                orderId: validated.orderId,
                feeBucket: posting.feeBucket ?? component.kind,
              },
            },
            amountMinor: component.amountMinor,
            code: posting.transferCode,
            memo: component.memo ?? defaults.memo,
          });
          continue;
        }

        if (accountingTreatment === "pass_through") {
          const posting = resolveFeeReservePostingTemplate(defaults.bucket);

          lines.push({
            type: OPERATION_TRANSFER_TYPE.CREATE,
            chain,
            planKey: makePlanKey("fx_fee_component_pass_through", {
              quoteRef: validated.quoteRef,
              orderId: validated.orderId,
              idx: idx + 1,
              componentId: component.id,
              kind: component.kind,
              currency: component.currency,
              amount: component.amountMinor.toString(),
            }),
            postingCode: posting.postingCode,
            debit: {
              accountNo: posting.debitAccountNo,
              currency: component.currency,
              dimensions: { customerId: validated.customerId },
            },
            credit: {
              accountNo: posting.creditAccountNo,
              currency: component.currency,
              dimensions: {
                feeBucket: posting.feeBucket ?? defaults.bucket,
                orderId: validated.orderId,
              },
            },
            amountMinor: component.amountMinor,
            code: posting.transferCode,
            memo: component.memo ?? "Fee reserved for separate payment order",
          });

          separateFeeOrders.push({
            componentId: component.id,
            kind: component.kind,
            bucket: defaults.bucket,
            accountingTreatment,
            currency: component.currency,
            amountMinor: component.amountMinor,
            memo: component.memo,
            metadata: component.metadata,
            payoutOperationalAccountId: defaultFeePayoutOperationalAccountId,
          });
          continue;
        }

        const posting = resolveProviderFeeExpenseAccrualPostingTemplate(
          defaults.bucket,
        );

        lines.push({
          type: OPERATION_TRANSFER_TYPE.CREATE,
          chain,
          planKey: makePlanKey("fx_fee_component_expense", {
            quoteRef: validated.quoteRef,
            orderId: validated.orderId,
            idx: idx + 1,
            componentId: component.id,
            kind: component.kind,
            currency: component.currency,
            amount: component.amountMinor.toString(),
          }),
          postingCode: posting.postingCode,
          debit: {
            accountNo: posting.debitAccountNo,
            currency: component.currency,
            dimensions: {
              feeBucket: posting.feeBucket ?? defaults.bucket,
              orderId: validated.orderId,
              counterpartyId: validated.branchCounterpartyId,
            },
          },
          credit: {
            accountNo: posting.creditAccountNo,
            currency: component.currency,
            dimensions: {
              feeBucket: posting.feeBucket ?? defaults.bucket,
              orderId: validated.orderId,
            },
          },
          amountMinor: component.amountMinor,
          code: posting.transferCode,
          memo: component.memo ?? "Provider fee expense accrual",
        });

        separateFeeOrders.push({
          componentId: component.id,
          kind: component.kind,
          bucket: defaults.bucket,
          accountingTreatment,
          currency: component.currency,
          amountMinor: component.amountMinor,
          memo: component.memo,
          metadata: component.metadata,
          payoutOperationalAccountId: defaultFeePayoutOperationalAccountId,
        });
      }

      const mergedAdjustments = feesService.mergeAdjustmentComponents({
        manual: validated.adjustments,
      });
      const partitionedAdjustments =
        feesService.partitionAdjustmentComponents(mergedAdjustments);

      for (const [
        idx,
        component,
      ] of partitionedAdjustments.inLedger.entries()) {
        const posting = resolveAdjustmentInLedgerPostingTemplate(
          component.effect,
          component.kind,
        );

        const adjFeeBucket = posting.feeBucket ?? `adjustment:${component.kind}`;
        lines.push({
          type: OPERATION_TRANSFER_TYPE.CREATE,
          chain,
          planKey: makePlanKey("fx_adjustment_component", {
            quoteRef: validated.quoteRef,
            orderId: validated.orderId,
            idx: idx + 1,
            componentId: component.id,
            kind: component.kind,
            effect: component.effect,
            currency: component.currency,
            amount: component.amountMinor.toString(),
          }),
          postingCode: posting.postingCode,
          debit: {
            accountNo: posting.debitAccountNo,
            currency: component.currency,
            dimensions:
              posting.debitAccountNo === ACCOUNT_NO.CUSTOMER_WALLET
                ? { customerId: validated.customerId }
                : { orderId: validated.orderId, feeBucket: adjFeeBucket },
          },
          credit: {
            accountNo: posting.creditAccountNo,
            currency: component.currency,
            dimensions:
              posting.creditAccountNo === ACCOUNT_NO.CUSTOMER_WALLET
                ? { customerId: validated.customerId }
                : { orderId: validated.orderId, feeBucket: adjFeeBucket },
          },
          amountMinor: component.amountMinor,
          code: posting.transferCode,
          memo:
            component.memo ??
            (component.effect === "increase_charge"
              ? "Adjustment charge"
              : "Adjustment refund"),
        });
      }

      for (const [
        idx,
        component,
      ] of partitionedAdjustments.separatePaymentOrder.entries()) {
        const posting = resolveAdjustmentReservePostingTemplate(
          component.effect,
          component.kind,
        );
        const bucket = posting.feeBucket ?? `adjustment:${component.kind}`;

        lines.push({
          type: OPERATION_TRANSFER_TYPE.CREATE,
          chain,
          planKey: makePlanKey("fx_adjustment_reserve", {
            quoteRef: validated.quoteRef,
            orderId: validated.orderId,
            idx: idx + 1,
            componentId: component.id,
            kind: component.kind,
            effect: component.effect,
            currency: component.currency,
            amount: component.amountMinor.toString(),
          }),
          postingCode: posting.postingCode,
          debit: {
            accountNo: posting.debitAccountNo,
            currency: component.currency,
            dimensions:
              posting.debitAccountNo === ACCOUNT_NO.CUSTOMER_WALLET
                ? { customerId: validated.customerId }
                : { orderId: validated.orderId, feeBucket: bucket },
          },
          credit: {
            accountNo: posting.creditAccountNo,
            currency: component.currency,
            dimensions: {
              feeBucket: bucket,
              orderId: validated.orderId,
            },
          },
          amountMinor: component.amountMinor,
          code: posting.transferCode,
          memo:
            component.memo ?? "Adjustment reserved for separate payment order",
        });

        separateFeeOrders.push({
          componentId: component.id,
          kind: `adjustment:${component.kind}`,
          bucket,
          accountingTreatment: "pass_through",
          currency: component.currency,
          amountMinor: component.amountMinor,
          memo: component.memo,
          metadata: {
            ...(component.metadata ?? {}),
            effect: component.effect,
          },
          payoutOperationalAccountId: defaultFeePayoutOperationalAccountId,
        });
      }

      lines.push({
        type: OPERATION_TRANSFER_TYPE.CREATE,
        chain,
        planKey: makePlanKey("fx_obligation", {
          quoteRef: validated.quoteRef,
          orderId: validated.orderId,
          payOutCounterpartyId: order.payOutCounterpartyId,
          currency: validated.payOutCurrency,
          amount: validated.payOutAmountMinor.toString(),
        }),
        postingCode: POSTING_CODE.FX_PAYOUT_OBLIGATION,
        debit: {
          accountNo: ACCOUNT_NO.ORDER_RESERVE,
          currency: validated.payOutCurrency,
          dimensions: { orderId: validated.orderId },
        },
        credit: {
          accountNo: ACCOUNT_NO.PAYOUT_OBLIGATION,
          currency: validated.payOutCurrency,
          dimensions: { orderId: validated.orderId },
        },
        amountMinor: validated.payOutAmountMinor,
        code: TransferCodes.FX_PAYOUT_OBLIGATION,
        memo: "Create payout obligation",
      });

      const { operationId: entryId } = await ledger.commit(
        tx,
        buildTreasuryIntent({
          source: { type: "order/fx_executed", id: validated.orderId },
          operationCode: OPERATION_CODE.TREASURY_FX_EXECUTED,
          payload: {
            orderId: validated.orderId,
            quoteRef: validated.quoteRef,
            principalMinor: validated.principalMinor.toString(),
            payOutAmountMinor: validated.payOutAmountMinor.toString(),
            payInCurrency: validated.payInCurrency,
            payOutCurrency: validated.payOutCurrency,
          },
          idempotencyKey: `fx:${validated.quoteRef}`,
          postingDate: validated.occurredAt,
          bookOrgId: SYSTEM_LEDGER_ORG_ID,
          lines,
        }),
      );

      if (separateFeeOrders.length) {
        const uniqueFeeOrderCurrencies = [
          ...new Set(separateFeeOrders.map((item) => item.currency)),
        ];
        const feeOrderCurrencyIdByCode = new Map<string, string>();
        await Promise.all(
          uniqueFeeOrderCurrencies.map(async (code) => {
            const currency = await currenciesService.findByCode(code);
            feeOrderCurrencyIdByCode.set(currency.code, currency.id);
          }),
        );

        await tx
          .insert(schema.feePaymentOrders)
          .values(
            separateFeeOrders.map((item) => ({
              parentOrderId: validated.orderId,
              quoteId: quote.id,
              componentId: item.componentId,
              idempotencyKey: `fee_order:${validated.orderId}:${item.kind}:${item.componentId}`,
              kind: item.kind,
              bucket: item.bucket,
              accountingTreatment: item.accountingTreatment,
              currencyId: feeOrderCurrencyIdByCode.get(item.currency)!,
              amountMinor: item.amountMinor,
              memo: item.memo ?? null,
              metadata: item.metadata ?? null,
              payoutOperationalAccountId: item.payoutOperationalAccountId,
              reserveOperationId: entryId,
              status: "reserved" as const,
            })),
          )
          .onConflictDoNothing({
            target: schema.feePaymentOrders.idempotencyKey,
          });
      }

      const moved = await tx
        .update(schema.paymentOrders)
        .set({
          status: TreasuryOrderStatus.FX_EXECUTED_PENDING_POSTING,
          ledgerOperationId: entryId,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.paymentOrders.id, validated.orderId),
            eq(
              schema.paymentOrders.status,
              TreasuryOrderStatus.FUNDING_SETTLED,
            ),
          ),
        )
        .returning({ id: schema.paymentOrders.id });

      if (!moved.length) {
        const current = await tx
          .select({
            status: schema.paymentOrders.status,
            ledgerOperationId: schema.paymentOrders.ledgerOperationId,
          })
          .from(schema.paymentOrders)
          .where(eq(schema.paymentOrders.id, validated.orderId))
          .limit(1);
        const currentLedgerOperationId = current[0]?.ledgerOperationId ?? null;

        if (
          current.length &&
          isSameEntryInAllowedState(
            current[0]!.status as string,
            currentLedgerOperationId,
            entryId,
            [
              TreasuryOrderStatus.FX_EXECUTED_PENDING_POSTING,
              TreasuryOrderStatus.FX_EXECUTED,
            ],
          )
        ) {
          log.debug("executeFx idempotent", { orderId: validated.orderId });
          return entryId;
        }

        throw new InvalidStateError(
          `Failed to update order status: concurrent modification detected. ` +
            `Current status: ${current[0]?.status ?? "unknown"}`,
        );
      }

      log.info("executeFx ok", {
        orderId: validated.orderId,
        entryId,
        quoteRef: validated.quoteRef,
      });
      return entryId;
    });
  };
}

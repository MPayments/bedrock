import { eq } from "drizzle-orm";

import {
  ACCOUNT_NO,
  OPERATION_CODE,
  POSTING_CODE,
  type Dimensions,
} from "@bedrock/accounting";
import { type Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { makePlanKey } from "@bedrock/kernel";
import { SYSTEM_LEDGER_ORG_ID, TransferCodes } from "@bedrock/kernel/constants";
import { OPERATION_TRANSFER_TYPE } from "@bedrock/ledger";

import {
  CurrencyMismatchError,
  NotFoundError,
} from "../errors";
import type { TreasuryServiceContext } from "../internal/context";
import { buildTreasuryIntent } from "../internal/ledger-operation";
import {
  type ExternalFundingInput,
  type ExternalFundingKind,
  validateExternalFundingInput,
} from "../validation";

const EXTERNAL_FUNDING_BY_KIND: Record<
  ExternalFundingKind,
  {
    postingCode: string;
    creditAccountNo: string;
    transferCode: number;
  }
> = {
  founder_equity: {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_FOUNDER_EQUITY,
    creditAccountNo: ACCOUNT_NO.FOUNDER_EQUITY,
    transferCode: TransferCodes.EXTERNAL_FUNDING_FOUNDER_EQUITY,
  },
  investor_equity: {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_INVESTOR_EQUITY,
    creditAccountNo: ACCOUNT_NO.INVESTOR_EQUITY,
    transferCode: TransferCodes.EXTERNAL_FUNDING_INVESTOR_EQUITY,
  },
  shareholder_loan: {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
    creditAccountNo: ACCOUNT_NO.SHAREHOLDER_LOAN,
    transferCode: TransferCodes.EXTERNAL_FUNDING_SHAREHOLDER_LOAN,
  },
  opening_balance: {
    postingCode: POSTING_CODE.EXTERNAL_FUNDING_OPENING_BALANCE,
    creditAccountNo: ACCOUNT_NO.OPENING_BALANCE_EQUITY,
    transferCode: TransferCodes.EXTERNAL_FUNDING_OPENING_BALANCE,
  },
};

function buildCreditDimensions(input: ExternalFundingInput): Dimensions {
  if (
    input.kind === "founder_equity" ||
    input.kind === "investor_equity" ||
    input.kind === "shareholder_loan"
  ) {
    return { counterpartyId: input.counterpartyId! };
  }

  return {};
}

export function createExternalFundingHandler(context: TreasuryServiceContext) {
  const { db, ledger, log, currenciesService } = context;

  return async function externalFunding(input: ExternalFundingInput) {
    const validated = validateExternalFundingInput(input);
    const config = EXTERNAL_FUNDING_BY_KIND[validated.kind];

    log.debug("externalFunding start", {
      entryRef: validated.entryRef,
      kind: validated.kind,
      operationalAccountId: validated.operationalAccountId,
    });

    return db.transaction(async (tx: Transaction) => {
      const [operationalAccount] = await tx
        .select({
          id: schema.operationalAccounts.id,
          currencyId: schema.operationalAccounts.currencyId,
        })
        .from(schema.operationalAccounts)
        .where(eq(schema.operationalAccounts.id, validated.operationalAccountId))
        .for("update")
        .limit(1);

      if (!operationalAccount) {
        throw new NotFoundError(
          "OperationalAccount",
          validated.operationalAccountId,
        );
      }

      const { code: accountCurrencyCode } = await currenciesService.findById(
        operationalAccount.currencyId,
      );

      if (validated.currency !== accountCurrencyCode) {
        throw new CurrencyMismatchError(
          "currency",
          accountCurrencyCode,
          validated.currency,
        );
      }

      if (validated.counterpartyId) {
        const [counterparty] = await tx
          .select({ id: schema.counterparties.id })
          .from(schema.counterparties)
          .where(eq(schema.counterparties.id, validated.counterpartyId))
          .limit(1);

        if (!counterparty) {
          throw new NotFoundError("Counterparty", validated.counterpartyId);
        }
      }

      if (validated.customerId) {
        const [customer] = await tx
          .select({ id: schema.customers.id })
          .from(schema.customers)
          .where(eq(schema.customers.id, validated.customerId))
          .limit(1);

        if (!customer) {
          throw new NotFoundError("Customer", validated.customerId);
        }
      }

      const planKey = makePlanKey("external_funding", {
        kind: validated.kind,
        entryRef: validated.entryRef,
        operationalAccountId: validated.operationalAccountId,
        currency: validated.currency,
        amount: validated.amountMinor.toString(),
      });

      const { operationId } = await ledger.commit(
        tx,
        buildTreasuryIntent({
          source: {
            type: "treasury/external_funding",
            id: `${validated.kind}:${validated.entryRef}`,
          },
          operationCode: OPERATION_CODE.TREASURY_EXTERNAL_FUNDING,
          payload: {
            kind: validated.kind,
            entryRef: validated.entryRef,
            operationalAccountId: validated.operationalAccountId,
            currency: validated.currency,
            amountMinor: validated.amountMinor.toString(),
            counterpartyId: validated.counterpartyId ?? null,
            customerId: validated.customerId ?? null,
            memo: validated.memo ?? null,
          },
          idempotencyKey: `external_funding:${validated.kind}:${validated.entryRef}`,
          postingDate: validated.occurredAt,
          bookOrgId: SYSTEM_LEDGER_ORG_ID,
          lines: [
            {
              type: OPERATION_TRANSFER_TYPE.CREATE,
              planKey,
              postingCode: config.postingCode,
              debit: {
                accountNo: ACCOUNT_NO.BANK,
                currency: validated.currency,
                dimensions: {
                  operationalAccountId: validated.operationalAccountId,
                },
              },
              credit: {
                accountNo: config.creditAccountNo,
                currency: validated.currency,
                dimensions: buildCreditDimensions(validated),
              },
              amountMinor: validated.amountMinor,
              code: config.transferCode,
              memo: validated.memo ?? `External funding: ${validated.kind}`,
            },
          ],
        }),
      );

      log.info("externalFunding ok", {
        entryRef: validated.entryRef,
        operationId,
      });

      return operationId;
    });
  };
}

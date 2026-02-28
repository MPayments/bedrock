import { randomUUID } from "crypto";

import { inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ACCOUNT_NO, OPERATION_CODE, POSTING_CODE } from "@bedrock/accounting";
import { currencyIdForCode } from "@bedrock/db/seeds";
import { schema } from "@bedrock/db/schema";
import { makePlanKey } from "@bedrock/kernel";
import { SYSTEM_LEDGER_ORG_ID, TransferCodes } from "@bedrock/kernel/constants";
import { createLedgerEngine, OPERATION_TRANSFER_TYPE } from "@bedrock/ledger";
import { createOperationalAccountsService } from "@bedrock/operational-accounts";

import { createTransfersService, InsufficientFundsError } from "../../src";
import { db } from "./setup";

async function createCounterparty(name: string) {
  const id = randomUUID();
  await db.insert(schema.counterparties).values({
    id,
    shortName: name,
    fullName: name,
    kind: "legal_entity",
    customerId: null,
  });
  return { id };
}

async function createAccountProvider(name: string) {
  const id = randomUUID();
  await db.insert(schema.operationalAccountProviders).values({
    id,
    type: "bank",
    name,
    country: "US",
  });
  return { id };
}

async function createOperationalAccount(input: {
  counterpartyId: string;
  accountProviderId: string;
  label: string;
  stableKey: string;
  currency: string;
}) {
  const id = randomUUID();
  await db.insert(schema.operationalAccounts).values({
    id,
    counterpartyId: input.counterpartyId,
    accountProviderId: input.accountProviderId,
    currencyId: currencyIdForCode(input.currency),
    label: input.label,
    stableKey: input.stableKey,
  });
  return { id };
}

async function seedSourceBankBalance(input: {
  ledger: ReturnType<typeof createLedgerEngine>;
  operationalAccountId: string;
  currency: string;
  amountMinor: bigint;
}) {
  await db.transaction(async (tx) => {
    await input.ledger.commit(tx, {
      source: {
        type: "transfers/integration/external_funding",
        id: `${input.operationalAccountId}:${input.amountMinor.toString()}`,
      },
      operationCode: OPERATION_CODE.TREASURY_EXTERNAL_FUNDING,
      idempotencyKey: `transfers:integration:funding:${input.operationalAccountId}:${input.amountMinor.toString()}`,
      postingDate: new Date(),
      bookOrgId: SYSTEM_LEDGER_ORG_ID,
      lines: [
        {
          type: OPERATION_TRANSFER_TYPE.CREATE,
          planKey: makePlanKey("transfers_integration_external_funding", {
            operationalAccountId: input.operationalAccountId,
            currency: input.currency,
            amountMinor: input.amountMinor.toString(),
          }),
          postingCode: POSTING_CODE.EXTERNAL_FUNDING_OPENING_BALANCE,
          debit: {
            accountNo: ACCOUNT_NO.BANK,
            currency: input.currency,
            dimensions: {
              operationalAccountId: input.operationalAccountId,
            },
          },
          credit: {
            accountNo: ACCOUNT_NO.OPENING_BALANCE_EQUITY,
            currency: input.currency,
            dimensions: {},
          },
          amountMinor: input.amountMinor,
          code: TransferCodes.EXTERNAL_FUNDING_OPENING_BALANCE,
          memo: "transfers integration funding seed",
        },
      ],
    });
  });
}

async function getAvailableSourceBalance(input: {
  operationalAccountId: string;
  currency: string;
}) {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(delta), 0)::text AS balance_minor
    FROM (
      SELECT p.amount_minor AS delta
      FROM ${schema.bookAccountInstances} inst
      JOIN ${schema.postings} p ON p.debit_instance_id = inst.id
      JOIN ${schema.ledgerOperations} lo ON lo.id = p.operation_id
      WHERE inst.account_no = ${ACCOUNT_NO.BANK}
        AND inst.currency = ${input.currency}
        AND inst.dimensions->>'operationalAccountId' = ${input.operationalAccountId}
        AND lo.status IN ('pending', 'posted')

      UNION ALL

      SELECT -p.amount_minor AS delta
      FROM ${schema.bookAccountInstances} inst
      JOIN ${schema.postings} p ON p.credit_instance_id = inst.id
      JOIN ${schema.ledgerOperations} lo ON lo.id = p.operation_id
      WHERE inst.account_no = ${ACCOUNT_NO.BANK}
        AND inst.currency = ${input.currency}
        AND inst.dimensions->>'operationalAccountId' = ${input.operationalAccountId}
        AND lo.status IN ('pending', 'posted')
    ) t
  `);

  const [row] = result.rows as { balance_minor: string }[];
  return BigInt(row?.balance_minor ?? "0");
}

describe("Transfers service integration", () => {
  it("allows only one parallel approve when source funds are insufficient for both transfers", async () => {
    const ledger = createLedgerEngine({ db });
    const operationalAccountsService = createOperationalAccountsService({ db });
    const transfersService = createTransfersService({
      db,
      ledger,
      operationalAccountsService,
    });

    const sourceCounterparty = await createCounterparty("Source Counterparty");
    const destinationCounterparty = await createCounterparty(
      "Destination Counterparty",
    );
    const provider = await createAccountProvider("Integration Test Bank");

    const sourceAccount = await createOperationalAccount({
      counterpartyId: sourceCounterparty.id,
      accountProviderId: provider.id,
      label: "Source USD",
      stableKey: "source-usd",
      currency: "USD",
    });
    const destinationAccount = await createOperationalAccount({
      counterpartyId: destinationCounterparty.id,
      accountProviderId: provider.id,
      label: "Destination USD",
      stableKey: "destination-usd",
      currency: "USD",
    });

    await seedSourceBankBalance({
      ledger,
      operationalAccountId: sourceAccount.id,
      currency: "USD",
      amountMinor: 1000n,
    });

    const transferIdOne = await transfersService.createDraft({
      sourceOperationalAccountId: sourceAccount.id,
      destinationOperationalAccountId: destinationAccount.id,
      amountMinor: 700n,
      makerUserId: randomUUID(),
      settlementMode: "immediate",
      idempotencyKey: `draft:${randomUUID()}`,
      memo: "parallel approve #1",
    });
    const transferIdTwo = await transfersService.createDraft({
      sourceOperationalAccountId: sourceAccount.id,
      destinationOperationalAccountId: destinationAccount.id,
      amountMinor: 700n,
      makerUserId: randomUUID(),
      settlementMode: "immediate",
      idempotencyKey: `draft:${randomUUID()}`,
      memo: "parallel approve #2",
    });

    const [approveOne, approveTwo] = await Promise.allSettled([
      transfersService.approve({
        transferId: transferIdOne,
        checkerUserId: randomUUID(),
        occurredAt: new Date(),
      }),
      transfersService.approve({
        transferId: transferIdTwo,
        checkerUserId: randomUUID(),
        occurredAt: new Date(),
      }),
    ]);

    const successes = [approveOne, approveTwo].filter(
      (result): result is PromiseFulfilledResult<unknown> =>
        result.status === "fulfilled",
    );
    const failures = [approveOne, approveTwo].filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.reason).toBeInstanceOf(InsufficientFundsError);

    const transferRows = await db
      .select({
        id: schema.transferOrders.id,
        status: schema.transferOrders.status,
        ledgerOperationId: schema.transferOrders.ledgerOperationId,
      })
      .from(schema.transferOrders)
      .where(inArray(schema.transferOrders.id, [transferIdOne, transferIdTwo]));

    const approvedRows = transferRows.filter(
      (row) => row.status === "approved_pending_posting",
    );
    const draftRows = transferRows.filter((row) => row.status === "draft");

    expect(approvedRows).toHaveLength(1);
    expect(approvedRows[0]?.ledgerOperationId).not.toBeNull();
    expect(draftRows).toHaveLength(1);
    expect(draftRows[0]?.ledgerOperationId).toBeNull();

    const sourceBalance = await getAvailableSourceBalance({
      operationalAccountId: sourceAccount.id,
      currency: "USD",
    });
    expect(sourceBalance).toBe(300n);
  });
});

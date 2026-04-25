import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { COMMERCIAL_CORE_ACTOR_USER_ID } from "../../../../../tests/integration/commercial-core/constants";
import {
  createAgreementFixture,
  createCalculationFixture,
  createFxQuoteFixture,
  createPaymentIntakeDraft,
} from "../../../../../tests/integration/commercial-core/fixtures";

describe("deals integration characterization", () => {
  it("creates and updates typed payment intake", async () => {
    const fixture = await createAgreementFixture();

    const created = await fixture.runtime.modules.deals.deals.commands.createDraft({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      agreementId: fixture.agreement.id,
      customerId: fixture.customer.id,
      idempotencyKey: randomUUID(),
      intake: {
        ...createPaymentIntakeDraft({
          applicantCounterpartyId: fixture.applicant.id,
          beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
          sourceCurrencyId: fixture.currencies.rub.id,
          targetCurrencyId: fixture.currencies.usd.id,
        }),
        common: {
          ...createPaymentIntakeDraft({
            applicantCounterpartyId: fixture.applicant.id,
            beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
            sourceCurrencyId: fixture.currencies.rub.id,
            targetCurrencyId: fixture.currencies.usd.id,
          }).common,
          applicantCounterpartyId: null,
        },
        moneyRequest: {
          ...createPaymentIntakeDraft({
            applicantCounterpartyId: fixture.applicant.id,
            beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
            sourceCurrencyId: fixture.currencies.rub.id,
            targetCurrencyId: fixture.currencies.usd.id,
          }).moneyRequest,
          sourceAmount: null,
        },
      },
    });

    expect(created.summary.agreementId).toBe(fixture.agreement.id);
    expect(created.summary.status).toBe("draft");
    expect(
      created.participants.some((participant) => participant.role === "customer"),
    ).toBe(true);

    const updated = await fixture.runtime.modules.deals.deals.commands.replaceIntake({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      dealId: created.summary.id,
      expectedRevision: created.revision,
      intake: {
        ...created.intake,
        common: {
          ...created.intake.common,
          customerNote: "Updated intake note",
        },
        incomingReceipt: {
          ...created.intake.incomingReceipt,
          expectedAmount: "1250.00",
        },
        moneyRequest: {
          ...created.intake.moneyRequest,
          purpose: "Updated purpose",
          sourceAmount: null,
          sourceCurrencyId: fixture.currencies.rub.id,
          targetCurrencyId: fixture.currencies.usd.id,
        },
      },
    });

    expect(updated.intake.moneyRequest.purpose).toBe("Updated purpose");
    expect(updated.revision).toBe(2);

    const workflow = await fixture.runtime.modules.deals.deals.queries.findWorkflowById(
      created.summary.id,
    );
    const detail = await fixture.runtime.modules.deals.deals.queries.findById(
      created.summary.id,
    );

    expect(workflow?.summary.agreementId).toBe(fixture.agreement.id);
    expect(workflow?.revision).toBe(2);
    expect(workflow?.intake.moneyRequest.purpose).toBe("Updated purpose");
    expect(workflow?.intake.common.customerNote).toBe("Updated intake note");
    expect(workflow?.intake.moneyRequest.sourceAmount).toBeNull();
    expect(workflow?.intake.moneyRequest.sourceCurrencyId).toBe(
      fixture.currencies.rub.id,
    );
    expect(workflow?.intake.moneyRequest.targetCurrencyId).toBe(
      fixture.currencies.usd.id,
    );
    expect(workflow?.intake.incomingReceipt.expectedAmount).toBe("1250.00");
    expect(detail?.amount).toBe("1250.00");
    expect(detail?.currencyId).toBe(fixture.currencies.usd.id);
    expect(detail?.comment).toBeNull();
  });

  it("links a calculation only from the accepted quote for a convert deal", async () => {
    const fixture = await createAgreementFixture();
    const draft = await fixture.runtime.modules.deals.deals.commands.createDraft({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      agreementId: fixture.agreement.id,
      customerId: fixture.customer.id,
      idempotencyKey: randomUUID(),
      intake: createPaymentIntakeDraft({
        applicantCounterpartyId: fixture.applicant.id,
        beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
        sourceCurrencyId: fixture.currencies.usd.id,
        targetCurrencyId: fixture.currencies.eur.id,
      }),
    });

    const quote = await createFxQuoteFixture({
      dealId: draft.summary.id,
      fromAmountMinor: 100000n,
      fromCurrencyId: fixture.currencies.usd.id,
      rateDen: 100n,
      rateNum: 91n,
      toAmountMinor: 91000n,
      toCurrencyId: fixture.currencies.eur.id,
    });

    await fixture.runtime.modules.deals.deals.commands.acceptQuote({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      dealId: draft.summary.id,
      quoteId: quote.id,
    });

    const calculation = await createCalculationFixture({
      baseCurrencyId: fixture.currencies.eur.id,
      calculationCurrencyId: fixture.currencies.usd.id,
      fxQuoteId: quote.id,
      rateDen: quote.rateDen,
      rateNum: quote.rateNum,
    });

    const attached =
      await fixture.runtime.modules.deals.deals.commands.linkCalculationFromAcceptedQuote(
        {
          actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
          calculationId: calculation.id,
          dealId: draft.summary.id,
          quoteId: quote.id,
        },
      );

    expect(attached.calculationId).toBe(calculation.id);

    const history = await fixture.runtime.modules.deals.deals.queries.listCalculationHistory(
      draft.summary.id,
    );
    expect(history).toHaveLength(1);
    expect(history[0]?.calculationId).toBe(calculation.id);
    expect(history[0]?.sourceQuoteId).toBe(quote.id);
  });

  it("submits typed payment intake and still rejects transitions outside the static map", async () => {
    const fixture = await createAgreementFixture();
    const created = await fixture.runtime.modules.deals.deals.commands.createDraft({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      agreementId: fixture.agreement.id,
      customerId: fixture.customer.id,
      idempotencyKey: randomUUID(),
      intake: {
        ...createPaymentIntakeDraft({
          applicantCounterpartyId: fixture.applicant.id,
          beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
          sourceCurrencyId: fixture.currencies.rub.id,
          targetCurrencyId: fixture.currencies.usd.id,
        }),
        incomingReceipt: {
          contractNumber: null,
          expectedAmount: "1000.00",
          expectedAt: null,
          invoiceNumber: null,
          payerCounterpartyId: null,
          payerSnapshot: null,
        },
        moneyRequest: {
          ...createPaymentIntakeDraft({
            applicantCounterpartyId: fixture.applicant.id,
            beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
            sourceCurrencyId: fixture.currencies.rub.id,
            targetCurrencyId: fixture.currencies.usd.id,
          }).moneyRequest,
          sourceAmount: null,
        },
      },
    });

    const workflowBefore = await fixture.runtime.modules.deals.deals.queries.findWorkflowById(
      created.summary.id,
    );
    expect(workflowBefore?.nextAction).toBe("Submit deal");

    const commented = await fixture.runtime.modules.deals.deals.commands.updateComment({
      comment: "Internal comment",
      dealId: created.summary.id,
    });
    expect(commented.comment).toBe("Internal comment");

    await expect(
      fixture.runtime.modules.deals.deals.commands.transitionStatus({
        actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
        dealId: created.summary.id,
        status: "done",
      }),
    ).rejects.toThrow("Cannot transition deal status from draft to done");

    const submitted = await fixture.runtime.modules.deals.deals.commands.transitionStatus({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      comment: "Move to submitted",
      dealId: created.summary.id,
      status: "submitted",
    });

    expect(submitted.summary.status).toBe("submitted");
    expect(submitted.nextAction).toBe("Accept quote");

    await expect(
      fixture.runtime.modules.deals.deals.commands.transitionStatus({
        actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
        dealId: created.summary.id,
        status: "done",
      }),
    ).rejects.toThrow("Cannot transition deal status from submitted to done");
  });

  it("loads multiple workflow projections in input order without per-call lookup orchestration", async () => {
    const fixture = await createAgreementFixture();
    const firstDraft = await fixture.runtime.modules.deals.deals.commands.createDraft({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      agreementId: fixture.agreement.id,
      customerId: fixture.customer.id,
      idempotencyKey: randomUUID(),
      intake: createPaymentIntakeDraft({
        applicantCounterpartyId: fixture.applicant.id,
        beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
        sourceCurrencyId: fixture.currencies.usd.id,
      }),
    });
    const secondDraft =
      await fixture.runtime.modules.deals.deals.commands.createDraft({
        actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
        agreementId: fixture.agreement.id,
        customerId: fixture.customer.id,
        idempotencyKey: randomUUID(),
        intake: createPaymentIntakeDraft({
          applicantCounterpartyId: fixture.applicant.id,
          beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
          sourceCurrencyId: fixture.currencies.eur.id,
        }),
      });

    const workflows = await fixture.runtime.modules.deals.deals.queries.findWorkflowsByIds(
      [secondDraft.summary.id, firstDraft.summary.id, randomUUID()],
    );

    expect(workflows.map((workflow) => workflow.summary.id)).toEqual([
      secondDraft.summary.id,
      firstDraft.summary.id,
    ]);
    expect(workflows[0]?.executionPlan.length).toBeGreaterThan(0);
    expect(workflows[1]?.executionPlan.length).toBeGreaterThan(0);
  });

  it("makes an accepted quote non-current after intake revision changes without deleting acceptance history", async () => {
    const fixture = await createAgreementFixture();
    const draft = await fixture.runtime.modules.deals.deals.commands.createDraft({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      agreementId: fixture.agreement.id,
      customerId: fixture.customer.id,
      idempotencyKey: randomUUID(),
      intake: createPaymentIntakeDraft({
        applicantCounterpartyId: fixture.applicant.id,
        beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
        sourceCurrencyId: fixture.currencies.usd.id,
        targetCurrencyId: fixture.currencies.eur.id,
      }),
    });

    const quote = await createFxQuoteFixture({
      dealId: draft.summary.id,
      fromAmountMinor: 100000n,
      fromCurrencyId: fixture.currencies.usd.id,
      rateDen: 100n,
      rateNum: 91n,
      toAmountMinor: 91000n,
      toCurrencyId: fixture.currencies.eur.id,
    });

    await fixture.runtime.modules.deals.deals.commands.acceptQuote({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      dealId: draft.summary.id,
      quoteId: quote.id,
    });

    const replaced = await fixture.runtime.modules.deals.deals.commands.replaceIntake({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      dealId: draft.summary.id,
      expectedRevision: draft.revision,
      intake: {
        ...draft.intake,
        common: {
          ...draft.intake.common,
          customerNote: "Revised after pricing",
        },
      },
    });

    expect(replaced.revision).toBe(2);
    expect(replaced.acceptedQuote).toBeNull();
    expect(replaced.nextAction).toBe("Submit deal");

    const acceptanceRows = await fixture.runtime.pool.query<{
      count: string;
    }>(
      "select count(*)::text as count from deal_quote_acceptances where deal_id = $1",
      [draft.summary.id],
    );
    expect(acceptanceRows.rows[0]?.count).toBe("1");
  });

  it("supersedes the prior accepted quote while keeping acceptance history", async () => {
    const fixture = await createAgreementFixture();
    const draft = await fixture.runtime.modules.deals.deals.commands.createDraft({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      agreementId: fixture.agreement.id,
      customerId: fixture.customer.id,
      idempotencyKey: randomUUID(),
      intake: createPaymentIntakeDraft({
        applicantCounterpartyId: fixture.applicant.id,
        beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
        sourceCurrencyId: fixture.currencies.usd.id,
        targetCurrencyId: fixture.currencies.eur.id,
      }),
    });

    const firstQuote = await createFxQuoteFixture({
      dealId: draft.summary.id,
      fromAmountMinor: 100000n,
      fromCurrencyId: fixture.currencies.usd.id,
      rateDen: 100n,
      rateNum: 91n,
      toAmountMinor: 91000n,
      toCurrencyId: fixture.currencies.eur.id,
    });
    const secondQuote = await createFxQuoteFixture({
      dealId: draft.summary.id,
      fromAmountMinor: 100000n,
      fromCurrencyId: fixture.currencies.usd.id,
      rateDen: 100n,
      rateNum: 92n,
      toAmountMinor: 92000n,
      toCurrencyId: fixture.currencies.eur.id,
    });

    await fixture.runtime.modules.deals.deals.commands.acceptQuote({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      dealId: draft.summary.id,
      quoteId: firstQuote.id,
    });
    const updated = await fixture.runtime.modules.deals.deals.commands.acceptQuote({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      dealId: draft.summary.id,
      quoteId: secondQuote.id,
    });

    expect(updated.acceptedQuote?.quoteId).toBe(secondQuote.id);

    const acceptanceRows = await fixture.runtime.pool.query<{
      quoteId: string;
      replacedByQuoteId: string | null;
      revokedAt: Date | null;
    }>(
      `select
         quote_id as "quoteId",
         replaced_by_quote_id as "replacedByQuoteId",
         revoked_at as "revokedAt"
       from deal_quote_acceptances
       where deal_id = $1
       order by accepted_at asc`,
      [draft.summary.id],
    );

    expect(acceptanceRows.rows).toHaveLength(2);
    expect(acceptanceRows.rows[0]?.quoteId).toBe(firstQuote.id);
    expect(acceptanceRows.rows[0]?.replacedByQuoteId).toBe(secondQuote.id);
    expect(acceptanceRows.rows[0]?.revokedAt).not.toBeNull();
    expect(acceptanceRows.rows[1]?.quoteId).toBe(secondQuote.id);
  });

  it("falls back to Accept quote when the accepted quote is no longer executable", async () => {
    const fixture = await createAgreementFixture();
    const draft = await fixture.runtime.modules.deals.deals.commands.createDraft({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      agreementId: fixture.agreement.id,
      customerId: fixture.customer.id,
      idempotencyKey: randomUUID(),
      intake: createPaymentIntakeDraft({
        applicantCounterpartyId: fixture.applicant.id,
        beneficiaryCounterpartyId: fixture.externalBeneficiary.id,
        sourceCurrencyId: fixture.currencies.usd.id,
        targetCurrencyId: fixture.currencies.eur.id,
      }),
    });

    const quote = await createFxQuoteFixture({
      dealId: draft.summary.id,
      fromAmountMinor: 100000n,
      fromCurrencyId: fixture.currencies.usd.id,
      rateDen: 100n,
      rateNum: 91n,
      toAmountMinor: 91000n,
      toCurrencyId: fixture.currencies.eur.id,
    });

    await fixture.runtime.modules.deals.deals.commands.acceptQuote({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      dealId: draft.summary.id,
      quoteId: quote.id,
    });

    await fixture.runtime.pool.query(
      `update fx_quotes
       set status = 'used',
           used_by_ref = 'fx_execute:doc-1',
           used_at = $2
       where id = $1`,
      [quote.id, new Date("2026-01-06T10:10:00.000Z")],
    );

    const workflow = await fixture.runtime.modules.deals.deals.queries.findWorkflowById(
      draft.summary.id,
    );

    expect(workflow?.acceptedQuote?.quoteId).toBe(quote.id);
    expect(workflow?.acceptedQuote?.quoteStatus).toBe("used");
    expect(workflow?.nextAction).toBe("Submit deal");
  });
});

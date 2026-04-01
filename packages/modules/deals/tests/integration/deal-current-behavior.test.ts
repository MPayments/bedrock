import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  COMMERCIAL_CORE_ACTOR_USER_ID,
  createAgreementFixture,
  createCalculationFixture,
  createFxQuoteFixture,
  createPaymentIntakeDraft,
} from "../../../../../tests/integration/commercial-core/fixtures";

describe("deals integration characterization", () => {
  it("resolves the sole active agreement on legacy create and maps legacy intake patch fields into the typed snapshot", async () => {
    const fixture = await createAgreementFixture();

    const created = await fixture.runtime.modules.deals.deals.commands.create({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      agreementId: undefined,
      agentId: null,
      calculationId: null,
      comment: "Legacy intake comment",
      counterpartyId: fixture.applicant.id,
      customerId: fixture.customer.id,
      idempotencyKey: randomUUID(),
      intakeComment: null,
      reason: null,
      requestedAmount: "1000.00",
      requestedCurrencyId: fixture.currencies.usd.id,
      type: "payment",
    });

    expect(created.agreementId).toBe(fixture.agreement.id);
    expect(created.status).toBe("draft");
    expect(created.requestedAmount).toBe("1000.00");
    expect(created.participants.some((participant) => participant.role === "customer")).toBe(true);

    const updated = await fixture.runtime.modules.deals.deals.commands.updateIntake({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      comment: "Updated legacy note",
      counterpartyId: fixture.applicant.id,
      dealId: created.id,
      reason: "Updated purpose",
      requestedAmount: "1250.00",
      requestedCurrencyId: fixture.currencies.usd.id,
    });

    expect(updated.reason).toBe("Updated purpose");
    expect(updated.requestedAmount).toBe("1250.00");
    expect(updated.comment).toBe("Updated legacy note");
    expect(updated.revision).toBe(2);

    const workflow = await fixture.runtime.modules.deals.deals.queries.findWorkflowById(
      created.id,
    );
    expect(workflow?.summary.agreementId).toBe(fixture.agreement.id);
    expect(workflow?.revision).toBe(2);
    expect(workflow?.intake.moneyRequest.purpose).toBe("Updated purpose");
    expect(workflow?.intake.common.customerNote).toBe("Updated legacy note");
  });

  it("attaches a calculation link to the accepted quote for a convert deal", async () => {
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

    const attached = await fixture.runtime.modules.deals.deals.commands.attachCalculation({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      calculationId: calculation.id,
      dealId: draft.summary.id,
      sourceQuoteId: quote.id,
    });

    expect(attached.calculationId).toBe(calculation.id);

    const history = await fixture.runtime.modules.deals.deals.queries.listCalculationHistory(
      draft.summary.id,
    );
    expect(history).toHaveLength(1);
    expect(history[0]?.calculationId).toBe(calculation.id);
    expect(history[0]?.sourceQuoteId).toBe(quote.id);
  });

  it("allows generic valid status transitions even when intake is incomplete and rejects transitions outside the static map", async () => {
    const fixture = await createAgreementFixture();
    const created = await fixture.runtime.modules.deals.deals.commands.create({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      agreementId: fixture.agreement.id,
      agentId: null,
      calculationId: null,
      comment: null,
      counterpartyId: fixture.applicant.id,
      customerId: fixture.customer.id,
      idempotencyKey: randomUUID(),
      intakeComment: null,
      reason: "Legacy payment",
      requestedAmount: "1000.00",
      requestedCurrencyId: fixture.currencies.usd.id,
      type: "payment",
    });

    const workflowBefore = await fixture.runtime.modules.deals.deals.queries.findWorkflowById(
      created.id,
    );
    expect(workflowBefore?.nextAction).toBe("Complete intake");

    const submitted = await fixture.runtime.modules.deals.deals.commands.transitionStatus({
      actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
      comment: "Move to submitted",
      dealId: created.id,
      status: "submitted",
    });

    expect(submitted.status).toBe("submitted");

    await expect(
      fixture.runtime.modules.deals.deals.commands.transitionStatus({
        actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
        dealId: created.id,
        status: "done",
      }),
    ).rejects.toThrow("Cannot transition deal status from submitted to done");
  });
});

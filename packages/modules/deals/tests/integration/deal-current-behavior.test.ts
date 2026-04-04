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
    expect(workflow?.intake.moneyRequest.sourceAmount).toBeNull();
    expect(workflow?.intake.moneyRequest.sourceCurrencyId).toBeNull();
    expect(workflow?.intake.moneyRequest.targetCurrencyId).toBe(
      fixture.currencies.usd.id,
    );
    expect(workflow?.intake.incomingReceipt.expectedAmount).toBe("1250.00");
    expect(workflow?.intake.incomingReceipt.expectedCurrencyId).toBe(
      fixture.currencies.usd.id,
    );
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

  it("blocks status transitions when business requirements are not met and still rejects transitions outside the static map", async () => {
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

    await expect(
      fixture.runtime.modules.deals.deals.commands.transitionStatus({
        actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
        comment: "Move to submitted",
        dealId: created.id,
        status: "submitted",
      }),
    ).rejects.toThrow("Deal transition to submitted is blocked");

    await expect(
      fixture.runtime.modules.deals.deals.commands.transitionStatus({
        actorUserId: COMMERCIAL_CORE_ACTOR_USER_ID,
        dealId: created.id,
        status: "done",
      }),
    ).rejects.toThrow("Cannot transition deal status from draft to done");
  });

  it("hydrates linked treasury operations back onto execution plan legs", async () => {
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
      }),
    });

    const workflowBefore = await fixture.runtime.modules.deals.deals.queries.findWorkflowById(
      draft.summary.id,
    );
    const collectLeg = workflowBefore?.executionPlan.find(
      (leg) => leg.kind === "collect",
    );
    expect(collectLeg).toBeDefined();
    expect(collectLeg?.operationRefs).toEqual([]);

    const operationId = randomUUID();
    const linkId = randomUUID();
    const sourceRef = `deal:${draft.summary.id}:leg:${collectLeg!.idx}:payin:1`;

    await fixture.runtime.pool.query(
      `
        insert into treasury_operations (
          id,
          deal_id,
          customer_id,
          internal_entity_organization_id,
          kind,
          state,
          source_ref,
          amount_minor,
          currency_id,
          created_at,
          updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
      `,
      [
        operationId,
        draft.summary.id,
        fixture.customer.id,
        fixture.organization.id,
        "payin",
        "planned",
        sourceRef,
        "100000",
        fixture.currencies.usd.id,
      ],
    );
    await fixture.runtime.pool.query(
      `
        insert into deal_leg_operation_links (
          id,
          deal_leg_id,
          treasury_operation_id,
          operation_kind,
          source_ref
        ) values ($1, $2, $3, $4, $5)
      `,
      [linkId, collectLeg!.id, operationId, "payin", sourceRef],
    );

    const workflowAfter = await fixture.runtime.modules.deals.deals.queries.findWorkflowById(
      draft.summary.id,
    );

    expect(
      workflowAfter?.executionPlan.find((leg) => leg.kind === "collect"),
    ).toMatchObject({
      id: collectLeg!.id,
      operationRefs: [
        {
          kind: "payin",
          operationId,
          sourceRef,
        },
      ],
    });
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

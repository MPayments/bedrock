#!/usr/bin/env tsx
/**
 * Seeds a ready-to-use test scenario for local development:
 *   - Logs in as admin through the finance audience.
 *   - Creates a payment route template (RUB → USD, 1 hop through
 *     Arabian Fuel Alliance DMCC).
 *   - Creates a draft payment deal for the WHITE PRIDE LLC customer.
 *   - Fills the deal intake (amount, currencies, beneficiary stub).
 *   - Attaches the new route template to the deal's pricing context.
 *
 * Prereqs (will fail loudly if missing):
 *   - `bun run db:nuke && bun run db:migrate && bun run db:seed` ran.
 *   - `bun run --filter=db db:seed:users` ran (admin@bedrock.com/admin123).
 *   - `bun run --filter=db db:seed:deal-payment` ran (WHITE PRIDE customer).
 *   - API server is live on localhost:3000.
 *
 * Run: `bunx tsx scripts/seed-test-scenario.ts`
 */

import { randomUUID } from "node:crypto";

const API_BASE = "http://localhost:3000";

// Well-known UUIDs from the baseline seeds.
const PAYMENT_DEAL_CUSTOMER_ID = "00000000-0000-4000-8000-000000000211";
const PAYMENT_DEAL_COUNTERPARTY_ID = "00000000-0000-4000-8000-000000000312";
const PAYMENT_DEAL_AGREEMENT_ID = "4b7bff28-0387-4b55-8e11-6b234f3b8201";
const ARABIAN_FUEL_ALLIANCE_ORG_ID = "00000000-0000-4000-8000-000000000320";
const ARABIAN_FUEL_ALLIANCE_RUB_REQ = "00000000-0000-4000-8000-000000000509";
const CURRENCY_RUB_ID = "00000000-0000-4000-8000-000000000104";
const CURRENCY_USD_ID = "00000000-0000-4000-8000-000000000101";

type FetchResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; body: string };

async function httpJson<T = unknown>(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<FetchResult<T>> {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);

  const response = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  const text = await response.text();
  if (!response.ok) {
    return { ok: false, status: response.status, body: text };
  }
  return { ok: true, data: text ? (JSON.parse(text) as T) : (null as T) };
}

async function signIn(): Promise<string> {
  const response = await fetch(
    `${API_BASE}/api/auth/finance/sign-in/email`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // better-auth's same-origin guard requires an Origin header even for
        // server-to-server calls. Match the finance app's public origin.
        origin: "http://localhost:3001",
      },
      body: JSON.stringify({
        email: "admin@bedrock.com",
        password: "admin123",
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Sign-in failed (${response.status}): ${await response.text()}`,
    );
  }
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Sign-in returned no cookie");
  const token = setCookie
    .split(";")[0]
    ?.split("=")
    .slice(1)
    .join("=");
  if (!token) throw new Error("Could not extract session token from cookie");
  return `bedrock-finance.session_token=${token}`;
}

function buildRouteDraft() {
  // Two hops: customer → Arabian Fuel Alliance (RUB/RUB identity) → beneficiary
  // (RUB→USD market). Both endpoints are abstract so the template is reusable
  // across deals; the deal's intake supplies the concrete applicant/
  // beneficiary counterparty ids (the finance projection binds them at read
  // time — see buildFinanceRouteAttachment).
  const sourceNodeId = `route-node-${randomUUID()}`;
  const hopNodeId = `route-node-${randomUUID()}`;
  const destinationNodeId = `route-node-${randomUUID()}`;
  const leg1Id = `leg-${randomUUID()}`;
  const leg2Id = `leg-${randomUUID()}`;

  return {
    draft: {
      additionalFees: [],
      amountInMinor: "2410384296",
      amountOutMinor: "32000000",
      currencyInId: CURRENCY_RUB_ID,
      currencyOutId: CURRENCY_USD_ID,
      legs: [
        {
          fees: [],
          fromCurrencyId: CURRENCY_RUB_ID,
          id: leg1Id,
          toCurrencyId: CURRENCY_RUB_ID,
        },
        {
          fees: [
            {
              chargeToCustomer: true,
              id: `fee-${randomUUID()}`,
              kind: "fx_spread",
              percentage: "1.0",
            },
          ],
          fromCurrencyId: CURRENCY_RUB_ID,
          id: leg2Id,
          toCurrencyId: CURRENCY_USD_ID,
        },
      ],
      lockedSide: "currency_in",
      participants: [
        {
          binding: "abstract",
          displayName: "Клиент",
          entityId: null,
          entityKind: null,
          nodeId: sourceNodeId,
          requisiteId: null,
          role: "source",
        },
        {
          binding: "bound",
          displayName: "ARABIAN FUEL ALLIANCE DMCC",
          entityId: ARABIAN_FUEL_ALLIANCE_ORG_ID,
          entityKind: "organization",
          nodeId: hopNodeId,
          requisiteId: ARABIAN_FUEL_ALLIANCE_RUB_REQ,
          role: "hop",
        },
        {
          binding: "abstract",
          displayName: "Бенефициар",
          entityId: null,
          entityKind: null,
          nodeId: destinationNodeId,
          requisiteId: null,
          role: "destination",
        },
      ],
    },
    maxMarginBps: 1000,
    minMarginBps: 25,
    name: `Test route ${new Date().toISOString().slice(0, 10)}`,
  };
}

function buildDealIntake() {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  return {
    intake: {
      common: {
        applicantCounterpartyId: PAYMENT_DEAL_COUNTERPARTY_ID,
        customerNote: "Seeded test deal — feel free to delete.",
        requestedExecutionDate: tomorrow.toISOString(),
      },
      externalBeneficiary: {
        bankInstructionSnapshot: {
          accountNo: "ACC-SEED-0001",
          bankAddress: null,
          bankCountry: "AE",
          bankName: "Seed Test Bank",
          beneficiaryName: "Seed Beneficiary",
          bic: null,
          iban: null,
          label: "Primary seed beneficiary",
          swift: "SEEDXXX",
        },
        beneficiaryCounterpartyId: null,
        beneficiarySnapshot: {
          country: "AE",
          displayName: "Seed Beneficiary",
          inn: null,
          legalName: "Seed Beneficiary Ltd",
        },
      },
      incomingReceipt: {
        contractNumber: "SEED-CONTRACT-001",
        expectedAmount: "320000.00",
        expectedAt: tomorrow.toISOString(),
        invoiceNumber: "SEED-INV-001",
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Seeded test payment to external beneficiary.",
        sourceAmount: null,
        sourceCurrencyId: CURRENCY_RUB_ID,
        targetCurrencyId: CURRENCY_USD_ID,
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type: "payment" as const,
    },
  };
}

async function main() {
  console.log("[seed-test-scenario] Signing in as admin@bedrock.com...");
  const cookie = await signIn();

  console.log("[seed-test-scenario] Creating payment route template...");
  const routeDraft = buildRouteDraft();
  const routeResult = await httpJson<{ id: string; name: string }>(
    "/v1/payment-routes",
    {
      method: "POST",
      body: JSON.stringify(routeDraft),
      cookie,
    },
  );
  if (!routeResult.ok) {
    throw new Error(
      `Create route template failed (${routeResult.status}): ${routeResult.body}`,
    );
  }
  console.log(
    `  ✓ Route template '${routeResult.data.name}' (id=${routeResult.data.id})`,
  );

  console.log("[seed-test-scenario] Creating payment deal draft...");
  const intake = buildDealIntake();
  const dealResult = await httpJson<{ summary: { id: string } }>(
    "/v1/deals/drafts",
    {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({
        agreementId: PAYMENT_DEAL_AGREEMENT_ID,
        customerId: PAYMENT_DEAL_CUSTOMER_ID,
        ...intake,
      }),
      cookie,
    },
  );
  if (!dealResult.ok) {
    throw new Error(
      `Create deal draft failed (${dealResult.status}): ${dealResult.body}`,
    );
  }
  const dealId = dealResult.data.summary.id;
  console.log(`  ✓ Deal draft created (id=${dealId})`);

  console.log("[seed-test-scenario] Attaching route template to deal...");
  const attachResult = await httpJson<{ revision: number }>(
    `/v1/deals/${dealId}/pricing/route/attach`,
    {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({
        routeTemplateId: routeResult.data.id,
      }),
      cookie,
    },
  );
  if (!attachResult.ok) {
    console.warn(
      `  ⚠ Route attach failed (${attachResult.status}): ${attachResult.body}`,
    );
    console.warn(
      "  Deal is still usable — you can attach the route via the pricing tab.",
    );
    printSummary();
    return;
  }
  console.log("  ✓ Route attached to deal pricing context");

  // Pricing commit can only run once the deal leaves `draft` status (the
  // domain rejects quotes from drafts). Transition submitted first, then
  // commit, then advance to `preparing_documents` which unlocks the
  // formal-document creation (invoice, etc).
  console.log("[seed-test-scenario] Advancing status draft → submitted...");
  const submitResult = await transitionStatus(cookie, dealId, "submitted");
  if (!submitResult.ok) {
    console.warn(
      `  ⚠ Status transition to submitted failed (${submitResult.status}): ${submitResult.body}`,
    );
    printSummary();
    return;
  }
  console.log("  ✓ Status → submitted");

  console.log(
    "[seed-test-scenario] Committing pricing (creates quote, accepts it, locks calculation)...",
  );
  // Status transition doesn't bump the pricing context revision, so the
  // revision returned from `/route/attach` is still current.
  const commitResult = await httpJson<{ calculationId: string }>(
    `/v1/deals/${dealId}/pricing/commit`,
    {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({
        // 320,000 USD target (beneficiary receives)
        amountMinor: "32000000",
        amountSide: "target",
        asOf: new Date().toISOString(),
        expectedRevision: attachResult.data.revision,
      }),
      cookie,
    },
  );
  if (!commitResult.ok) {
    console.warn(
      `  ⚠ Pricing commit failed (${commitResult.status}): ${commitResult.body}`,
    );
    console.warn(
      "  Deal is submitted — you can drive quote/accept/calculation manually via the pricing tab.",
    );
    printSummary();
    return;
  }
  console.log(
    `  ✓ Pricing committed (calculation id=${commitResult.data.calculationId})`,
  );

  console.log(
    "[seed-test-scenario] Advancing status submitted → preparing_documents...",
  );
  const prepResult = await transitionStatus(
    cookie,
    dealId,
    "preparing_documents",
  );
  if (!prepResult.ok) {
    console.warn(
      `  ⚠ Status transition to preparing_documents failed (${prepResult.status}): ${prepResult.body}`,
    );
    console.warn(
      "  Deal is submitted — you can create the opening invoice via the finance documents tab.",
    );
    printSummary();
    return;
  }
  console.log("  ✓ Status → preparing_documents");
  console.log(
    "  ▸ The opening invoice is now creatable on the finance Документы tab.",
  );

  printSummary();

  function printSummary() {
    console.log("");
    console.log("[seed-test-scenario] Done.");
    console.log("");
    console.log(
      "  Customer:    White Pride (00000000-0000-4000-8000-000000000211)",
    );
    console.log("  Agreement:   WP-AFA-2026-001 (4b7bff28-...)");
    console.log(`  Route:       ${routeResult.data.id}`);
    console.log(`  Deal:        ${dealId}`);
    console.log("");
    console.log(`  CRM:     http://localhost:3002/deals/${dealId}`);
    console.log(`  Finance: http://localhost:3001/treasury/deals/${dealId}`);
  }
}

async function transitionStatus(
  cookie: string,
  dealId: string,
  status: string,
) {
  return httpJson(`/v1/deals/${dealId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    cookie,
  });
}

main().catch((error) => {
  console.error("[seed-test-scenario] Failed:", error);
  process.exit(1);
});

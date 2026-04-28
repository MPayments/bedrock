import {
  PaymentRouteDraftSchema,
  PaymentRouteVisualMetadataSchema,
} from "@bedrock/treasury/contracts";

import type { Database } from "../client";
import { schema } from "../schema-registry";
import { CURRENCY_IDS } from "./currencies";
import { ORGANIZATION_IDS, REQUISITE_IDS } from "./fixtures";

export const PAYMENT_ROUTE_IDS = {
  RUB_AED_USD: "a4c02212-c6de-46ab-8d01-1dedea5e9e19",
} as const;

const ROUTE_NODE_IDS = {
  AFA_AED: "route-node-0357e018-cb0a-49ab-a115-61e603dc62d8",
  AFA_RUB: "route-node-0b2537cc-7ae4-4310-b80a-c2ebd1b41aba",
  BENEFICIARY: "route-node-4f112c07-eef8-4d1a-ba7d-b3e4baf09b03",
  MULTIHANSA_AED: "route-node-60fcf53c-eeb8-468d-8b29-d07310a39c9b",
  SOURCE: "route-node-d910b07b-f0da-4015-b5a3-fdce3a4c1f8b",
} as const;

const RUB_AED_USD_DRAFT = PaymentRouteDraftSchema.parse({
  additionalFees: [],
  amountInMinor: "1200000",
  amountOutMinor: "15983",
  currencyInId: CURRENCY_IDS.RUB,
  currencyOutId: CURRENCY_IDS.USD,
  legs: [
    {
      fees: [],
      fromCurrencyId: CURRENCY_IDS.RUB,
      id: "route-leg-9f0d1b2e-d80c-450b-90c5-a8187b075747",
      toCurrencyId: CURRENCY_IDS.RUB,
    },
    {
      fees: [
        {
          application: "embedded_in_rate",
          id: "route-fee-784964a9-ab41-443d-a379-50a0e4171481",
          kind: "fx_spread",
          label: "Комиссия",
          percentage: "0.25",
        },
      ],
      fromCurrencyId: CURRENCY_IDS.RUB,
      id: "route-leg-9cd238d4-75a7-45ae-a647-ba4ae8964f56",
      toCurrencyId: CURRENCY_IDS.AED,
    },
    {
      fees: [],
      fromCurrencyId: CURRENCY_IDS.AED,
      id: "route-leg-5ff0e36c-6122-4338-abfe-f528628dd818",
      toCurrencyId: CURRENCY_IDS.AED,
    },
    {
      fees: [],
      fromCurrencyId: CURRENCY_IDS.AED,
      id: "route-leg-ec641768-f951-4735-a914-2711ca060864",
      toCurrencyId: CURRENCY_IDS.USD,
    },
  ],
  lockedSide: "currency_in",
  participants: [
    {
      binding: "abstract",
      displayName: "Клиент",
      entityId: null,
      entityKind: null,
      nodeId: ROUTE_NODE_IDS.SOURCE,
      requisiteId: null,
      role: "source",
    },
    {
      binding: "bound",
      displayName: "ARABIAN FUEL ALLIANCE DMCC",
      entityId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
      entityKind: "organization",
      nodeId: ROUTE_NODE_IDS.AFA_RUB,
      requisiteId: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_EXI_RUB,
      role: "hop",
    },
    {
      binding: "bound",
      displayName: "ARABIAN FUEL ALLIANCE DMCC",
      entityId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
      entityKind: "organization",
      nodeId: ROUTE_NODE_IDS.AFA_AED,
      requisiteId: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_EXI_AED,
      role: "hop",
    },
    {
      binding: "bound",
      displayName: "MULTIHANSA BROKERS - FZCO",
      entityId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
      entityKind: "organization",
      nodeId: ROUTE_NODE_IDS.MULTIHANSA_AED,
      requisiteId: REQUISITE_IDS.MULTIHANSA_ADCB_AED,
      role: "hop",
    },
    {
      binding: "abstract",
      displayName: "Бенефициар",
      entityId: null,
      entityKind: null,
      nodeId: ROUTE_NODE_IDS.BENEFICIARY,
      requisiteId: null,
      role: "destination",
    },
  ],
});

const RUB_AED_USD_VISUAL = PaymentRouteVisualMetadataSchema.parse({
  nodePositions: {
    [ROUTE_NODE_IDS.SOURCE]: { x: 0, y: 72 },
    [ROUTE_NODE_IDS.AFA_RUB]: { x: 260, y: 180 },
    [ROUTE_NODE_IDS.AFA_AED]: { x: 520, y: 72 },
    [ROUTE_NODE_IDS.MULTIHANSA_AED]: { x: 780, y: 180 },
    [ROUTE_NODE_IDS.BENEFICIARY]: { x: 1040, y: 72 },
  },
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
});

export async function seedPaymentRoutes(db: Database): Promise<void> {
  const now = new Date("2026-04-28T16:00:19.270Z");
  const hopCount = Math.max(RUB_AED_USD_DRAFT.participants.length - 2, 0);

  await db
    .insert(schema.paymentRouteTemplates)
    .values({
      createdAt: now,
      currencyInId: RUB_AED_USD_DRAFT.currencyInId,
      currencyOutId: RUB_AED_USD_DRAFT.currencyOutId,
      destinationEntityId: null,
      destinationEntityKind: null,
      draft: RUB_AED_USD_DRAFT,
      hopCount,
      id: PAYMENT_ROUTE_IDS.RUB_AED_USD,
      lastCalculation: null,
      maxMarginBps: 1000,
      minMarginBps: 25,
      name: "rub aed usd",
      snapshotPolicy: "clone_on_attach",
      sourceCustomerId: null,
      status: "active",
      updatedAt: now,
      visual: RUB_AED_USD_VISUAL,
    })
    .onConflictDoUpdate({
      target: schema.paymentRouteTemplates.id,
      set: {
        currencyInId: RUB_AED_USD_DRAFT.currencyInId,
        currencyOutId: RUB_AED_USD_DRAFT.currencyOutId,
        destinationEntityId: null,
        destinationEntityKind: null,
        draft: RUB_AED_USD_DRAFT,
        hopCount,
        lastCalculation: null,
        maxMarginBps: 1000,
        minMarginBps: 25,
        name: "rub aed usd",
        snapshotPolicy: "clone_on_attach",
        sourceCustomerId: null,
        status: "active",
        updatedAt: now,
        visual: RUB_AED_USD_VISUAL,
      },
    });

  console.log(
    `[seed:payment-routes] Seeded route ${PAYMENT_ROUTE_IDS.RUB_AED_USD} (rub aed usd)`,
  );
}

import { inArray } from "drizzle-orm";
import { createHash } from "node:crypto";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { CURRENCY_IDS, seedCurrencies } from "./currencies";
import { ORGANIZATION_IDS, seedOrganizations } from "./organizations";

type SeedDb = Database | Transaction;

type SeedRouteTemplateParticipant = {
  bindingKind:
    | "fixed_party"
    | "deal_customer"
    | "deal_applicant"
    | "deal_payer"
    | "deal_beneficiary";
  code: string;
  displayNameTemplate: string | null;
  metadata: Record<string, unknown>;
  partyId: string | null;
  partyKind: "customer" | "counterparty" | "organization";
  role: string;
  sequence: number;
};

type SeedRouteTemplateLeg = {
  code: string;
  fromCurrencyId: string;
  fromParticipantCode: string;
  idx: number;
  kind:
    | "collection"
    | "intracompany_transfer"
    | "intercompany_funding"
    | "fx_conversion"
    | "payout"
    | "return"
    | "adjustment";
  notes: string | null;
  settlementModel: string;
  toCurrencyId: string;
  toParticipantCode: string;
};

type SeedRouteTemplateCostComponent = {
  basisType:
    | "deal_source_amount"
    | "deal_target_amount"
    | "leg_from_amount"
    | "leg_to_amount"
    | "gross_revenue";
  bps: string | null;
  classification: "revenue" | "expense" | "pass_through" | "adjustment";
  code: string;
  currencyId: string;
  family: string;
  fixedAmountMinor: bigint | null;
  formulaType: "fixed" | "bps" | "per_million" | "manual";
  includedInClientRate: boolean;
  legCode: string | null;
  manualAmountMinor: bigint | null;
  notes: string | null;
  perMillion: string | null;
  sequence: number;
};

type SeedRouteTemplate = {
  code: string;
  costComponents: SeedRouteTemplateCostComponent[];
  dealType:
    | "payment"
    | "currency_transit"
    | "currency_exchange"
    | "exporter_settlement";
  description: string | null;
  id: string;
  legs: SeedRouteTemplateLeg[];
  name: string;
  participants: SeedRouteTemplateParticipant[];
};

function stableUuid(input: string) {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32);
  const chars = hex.split("");

  chars[12] = "4";
  chars[16] = ["8", "9", "a", "b"][Number.parseInt(chars[16] ?? "0", 16) % 4]!;

  return [
    chars.slice(0, 8).join(""),
    chars.slice(8, 12).join(""),
    chars.slice(12, 16).join(""),
    chars.slice(16, 20).join(""),
    chars.slice(20, 32).join(""),
  ].join("-");
}

export const ROUTE_TEMPLATE_IDS = {
  PAYMENT_DIRECT_RUB: stableUuid("route-template:payment-direct-rub"),
  PAYMENT_RUB_AED_USD: stableUuid("route-template:payment-rub-aed-usd-payout"),
  CURRENCY_TRANSIT_USD: stableUuid("route-template:currency-transit-usd"),
  EXPORTER_SETTLEMENT_USD: stableUuid(
    "route-template:exporter-settlement-usd-internal",
  ),
} as const;

const ROUTE_TEMPLATE_SEEDS: readonly SeedRouteTemplate[] = [
  {
    code: "payment-rub-aed-usd-payout",
    costComponents: [
      {
        basisType: "deal_target_amount",
        bps: "150",
        classification: "revenue",
        code: "client_markup",
        currencyId: CURRENCY_IDS.USD,
        family: "pricing",
        fixedAmountMinor: null,
        formulaType: "bps",
        includedInClientRate: true,
        legCode: null,
        manualAmountMinor: null,
        notes: "Commercial client markup included in the promised rate.",
        perMillion: null,
        sequence: 1,
      },
      {
        basisType: "deal_source_amount",
        bps: "10",
        classification: "expense",
        code: "liquidity_fee",
        currencyId: CURRENCY_IDS.RUB,
        family: "liquidity",
        fixedAmountMinor: null,
        formulaType: "bps",
        includedInClientRate: false,
        legCode: null,
        manualAmountMinor: null,
        notes: "Estimated RUB-side liquidity cost.",
        perMillion: null,
        sequence: 2,
      },
      {
        basisType: "leg_to_amount",
        bps: null,
        classification: "expense",
        code: "wire_fee",
        currencyId: CURRENCY_IDS.USD,
        family: "wire",
        fixedAmountMinor: 1500n,
        formulaType: "fixed",
        includedInClientRate: false,
        legCode: "payout_usd",
        manualAmountMinor: null,
        notes: "Expected payout wire cost.",
        perMillion: null,
        sequence: 3,
      },
      {
        basisType: "leg_to_amount",
        bps: "4.1",
        classification: "expense",
        code: "fx_provider_fee",
        currencyId: CURRENCY_IDS.USD,
        family: "provider_fx",
        fixedAmountMinor: null,
        formulaType: "bps",
        includedInClientRate: false,
        legCode: "convert_aed_usd",
        manualAmountMinor: null,
        notes: "Estimated bank FX execution fee.",
        perMillion: null,
        sequence: 4,
      },
      {
        basisType: "deal_target_amount",
        bps: "70",
        classification: "expense",
        code: "subagent_commission",
        currencyId: CURRENCY_IDS.USD,
        family: "subagent",
        fixedAmountMinor: null,
        formulaType: "bps",
        includedInClientRate: false,
        legCode: null,
        manualAmountMinor: null,
        notes: "External sub-agent commission allowance.",
        perMillion: null,
        sequence: 5,
      },
    ],
    dealType: "payment",
    description:
      "Supplier payment route with RUB collection, internal AED transfer, AED/USD conversion, and USD payout.",
    id: ROUTE_TEMPLATE_IDS.PAYMENT_RUB_AED_USD,
    legs: [
      {
        code: "collect_rub",
        fromCurrencyId: CURRENCY_IDS.RUB,
        fromParticipantCode: "customer",
        idx: 1,
        kind: "collection",
        notes: "Collect RUB from the customer.",
        settlementModel: "managed_collection",
        toCurrencyId: CURRENCY_IDS.RUB,
        toParticipantCode: "treasury_ru",
      },
      {
        code: "convert_rub_aed",
        fromCurrencyId: CURRENCY_IDS.RUB,
        fromParticipantCode: "treasury_ru",
        idx: 2,
        kind: "fx_conversion",
        notes: "Convert collected RUB into AED for internal funding.",
        settlementModel: "internal_fx",
        toCurrencyId: CURRENCY_IDS.AED,
        toParticipantCode: "treasury_ru",
      },
      {
        code: "transfer_aed",
        fromCurrencyId: CURRENCY_IDS.AED,
        fromParticipantCode: "treasury_ru",
        idx: 3,
        kind: "intracompany_transfer",
        notes: "Move AED liquidity to the payout entity.",
        settlementModel: "internal_transfer",
        toCurrencyId: CURRENCY_IDS.AED,
        toParticipantCode: "treasury_ae",
      },
      {
        code: "convert_aed_usd",
        fromCurrencyId: CURRENCY_IDS.AED,
        fromParticipantCode: "treasury_ae",
        idx: 4,
        kind: "fx_conversion",
        notes: "Convert AED inventory into payout currency.",
        settlementModel: "internal_fx",
        toCurrencyId: CURRENCY_IDS.USD,
        toParticipantCode: "treasury_ae",
      },
      {
        code: "payout_usd",
        fromCurrencyId: CURRENCY_IDS.USD,
        fromParticipantCode: "treasury_ae",
        idx: 5,
        kind: "payout",
        notes: "Execute the outbound USD payout.",
        settlementModel: "outgoing_wire",
        toCurrencyId: CURRENCY_IDS.USD,
        toParticipantCode: "beneficiary",
      },
    ],
    name: "RUB Collection -> AED Internal Transfer -> AED/USD Conversion -> USD Payout",
    participants: [
      {
        bindingKind: "deal_customer",
        code: "customer",
        displayNameTemplate: "Deal customer",
        metadata: {},
        partyId: null,
        partyKind: "customer",
        role: "customer",
        sequence: 1,
      },
      {
        bindingKind: "fixed_party",
        code: "treasury_ru",
        displayNameTemplate: "Multihansa Brokers",
        metadata: { treasuryRegion: "ru" },
        partyId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
        partyKind: "organization",
        role: "internal_source",
        sequence: 2,
      },
      {
        bindingKind: "fixed_party",
        code: "treasury_ae",
        displayNameTemplate: "Arabian Fuel Alliance",
        metadata: { treasuryRegion: "ae" },
        partyId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
        partyKind: "organization",
        role: "internal_destination",
        sequence: 3,
      },
      {
        bindingKind: "deal_beneficiary",
        code: "beneficiary",
        displayNameTemplate: "Deal beneficiary",
        metadata: {},
        partyId: null,
        partyKind: "counterparty",
        role: "beneficiary",
        sequence: 4,
      },
    ],
  },
  {
    code: "payment-direct-rub",
    costComponents: [
      {
        basisType: "deal_target_amount",
        bps: "60",
        classification: "revenue",
        code: "client_markup",
        currencyId: CURRENCY_IDS.RUB,
        family: "pricing",
        fixedAmountMinor: null,
        formulaType: "bps",
        includedInClientRate: true,
        legCode: null,
        manualAmountMinor: null,
        notes: "Commercial markup for direct local payment.",
        perMillion: null,
        sequence: 1,
      },
      {
        basisType: "deal_source_amount",
        bps: "5",
        classification: "expense",
        code: "liquidity_fee",
        currencyId: CURRENCY_IDS.RUB,
        family: "liquidity",
        fixedAmountMinor: null,
        formulaType: "bps",
        includedInClientRate: false,
        legCode: null,
        manualAmountMinor: null,
        notes: "Expected liquidity cost on direct payment.",
        perMillion: null,
        sequence: 2,
      },
      {
        basisType: "leg_to_amount",
        bps: null,
        classification: "expense",
        code: "wire_fee",
        currencyId: CURRENCY_IDS.RUB,
        family: "wire",
        fixedAmountMinor: 2500n,
        formulaType: "fixed",
        includedInClientRate: false,
        legCode: "payout_rub",
        manualAmountMinor: null,
        notes: "Expected local transfer fee.",
        perMillion: null,
        sequence: 3,
      },
    ],
    dealType: "payment",
    description: "Direct same-currency payment route without internal FX.",
    id: ROUTE_TEMPLATE_IDS.PAYMENT_DIRECT_RUB,
    legs: [
      {
        code: "collect_rub",
        fromCurrencyId: CURRENCY_IDS.RUB,
        fromParticipantCode: "customer",
        idx: 1,
        kind: "collection",
        notes: "Collect payment funds from the customer.",
        settlementModel: "managed_collection",
        toCurrencyId: CURRENCY_IDS.RUB,
        toParticipantCode: "treasury_ru",
      },
      {
        code: "payout_rub",
        fromCurrencyId: CURRENCY_IDS.RUB,
        fromParticipantCode: "treasury_ru",
        idx: 2,
        kind: "payout",
        notes: "Transfer the same currency directly to the beneficiary.",
        settlementModel: "outgoing_wire",
        toCurrencyId: CURRENCY_IDS.RUB,
        toParticipantCode: "beneficiary",
      },
    ],
    name: "Direct Payment",
    participants: [
      {
        bindingKind: "deal_customer",
        code: "customer",
        displayNameTemplate: "Deal customer",
        metadata: {},
        partyId: null,
        partyKind: "customer",
        role: "customer",
        sequence: 1,
      },
      {
        bindingKind: "fixed_party",
        code: "treasury_ru",
        displayNameTemplate: "Multihansa Brokers",
        metadata: { treasuryRegion: "ru" },
        partyId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
        partyKind: "organization",
        role: "internal_settlement",
        sequence: 2,
      },
      {
        bindingKind: "deal_beneficiary",
        code: "beneficiary",
        displayNameTemplate: "Deal beneficiary",
        metadata: {},
        partyId: null,
        partyKind: "counterparty",
        role: "beneficiary",
        sequence: 3,
      },
    ],
  },
  {
    code: "currency-transit-usd",
    costComponents: [
      {
        basisType: "deal_target_amount",
        bps: "35",
        classification: "revenue",
        code: "client_markup",
        currencyId: CURRENCY_IDS.USD,
        family: "pricing",
        fixedAmountMinor: null,
        formulaType: "bps",
        includedInClientRate: true,
        legCode: null,
        manualAmountMinor: null,
        notes: "Transit spread retained by the platform.",
        perMillion: null,
        sequence: 1,
      },
      {
        basisType: "leg_to_amount",
        bps: null,
        classification: "expense",
        code: "wire_fee",
        currencyId: CURRENCY_IDS.USD,
        family: "wire",
        fixedAmountMinor: 1000n,
        formulaType: "fixed",
        includedInClientRate: false,
        legCode: "payout_usd",
        manualAmountMinor: null,
        notes: "Expected transit payout fee.",
        perMillion: null,
        sequence: 2,
      },
    ],
    dealType: "currency_transit",
    description: "Transit route that keeps the same settlement currency end-to-end.",
    id: ROUTE_TEMPLATE_IDS.CURRENCY_TRANSIT_USD,
    legs: [
      {
        code: "collect_usd",
        fromCurrencyId: CURRENCY_IDS.USD,
        fromParticipantCode: "customer",
        idx: 1,
        kind: "collection",
        notes: "Receive inbound transit funds.",
        settlementModel: "managed_collection",
        toCurrencyId: CURRENCY_IDS.USD,
        toParticipantCode: "treasury_ae",
      },
      {
        code: "payout_usd",
        fromCurrencyId: CURRENCY_IDS.USD,
        fromParticipantCode: "treasury_ae",
        idx: 2,
        kind: "payout",
        notes: "Release the transit funds to the destination counterparty.",
        settlementModel: "outgoing_wire",
        toCurrencyId: CURRENCY_IDS.USD,
        toParticipantCode: "beneficiary",
      },
    ],
    name: "Currency Transit",
    participants: [
      {
        bindingKind: "deal_customer",
        code: "customer",
        displayNameTemplate: "Deal customer",
        metadata: {},
        partyId: null,
        partyKind: "customer",
        role: "customer",
        sequence: 1,
      },
      {
        bindingKind: "fixed_party",
        code: "treasury_ae",
        displayNameTemplate: "Arabian Fuel Alliance",
        metadata: { treasuryRegion: "ae" },
        partyId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
        partyKind: "organization",
        role: "internal_transit",
        sequence: 2,
      },
      {
        bindingKind: "deal_beneficiary",
        code: "beneficiary",
        displayNameTemplate: "Deal beneficiary",
        metadata: {},
        partyId: null,
        partyKind: "counterparty",
        role: "beneficiary",
        sequence: 3,
      },
    ],
  },
  {
    code: "exporter-settlement-usd-internal",
    costComponents: [
      {
        basisType: "deal_target_amount",
        bps: "45",
        classification: "revenue",
        code: "client_markup",
        currencyId: CURRENCY_IDS.USD,
        family: "pricing",
        fixedAmountMinor: null,
        formulaType: "bps",
        includedInClientRate: true,
        legCode: null,
        manualAmountMinor: null,
        notes: "Exporter settlement spread.",
        perMillion: null,
        sequence: 1,
      },
      {
        basisType: "leg_from_amount",
        bps: "12",
        classification: "expense",
        code: "funding_fee",
        currencyId: CURRENCY_IDS.USD,
        family: "funding",
        fixedAmountMinor: null,
        formulaType: "bps",
        includedInClientRate: false,
        legCode: "fund_usd",
        manualAmountMinor: null,
        notes: "Internal funding allocation cost.",
        perMillion: null,
        sequence: 2,
      },
      {
        basisType: "leg_to_amount",
        bps: null,
        classification: "expense",
        code: "wire_fee",
        currencyId: CURRENCY_IDS.USD,
        family: "wire",
        fixedAmountMinor: 1200n,
        formulaType: "fixed",
        includedInClientRate: false,
        legCode: "payout_usd",
        manualAmountMinor: null,
        notes: "Expected outbound settlement fee.",
        perMillion: null,
        sequence: 3,
      },
    ],
    dealType: "exporter_settlement",
    description:
      "Exporter settlement route with internal USD funding before final payout.",
    id: ROUTE_TEMPLATE_IDS.EXPORTER_SETTLEMENT_USD,
    legs: [
      {
        code: "collect_usd",
        fromCurrencyId: CURRENCY_IDS.USD,
        fromParticipantCode: "customer",
        idx: 1,
        kind: "collection",
        notes: "Collect exporter settlement funds from the customer account.",
        settlementModel: "managed_collection",
        toCurrencyId: CURRENCY_IDS.USD,
        toParticipantCode: "treasury_ru",
      },
      {
        code: "fund_usd",
        fromCurrencyId: CURRENCY_IDS.USD,
        fromParticipantCode: "treasury_ru",
        idx: 2,
        kind: "intercompany_funding",
        notes: "Fund the payout entity with the settlement amount.",
        settlementModel: "internal_transfer",
        toCurrencyId: CURRENCY_IDS.USD,
        toParticipantCode: "treasury_ae",
      },
      {
        code: "payout_usd",
        fromCurrencyId: CURRENCY_IDS.USD,
        fromParticipantCode: "treasury_ae",
        idx: 3,
        kind: "payout",
        notes: "Pay out the exporter settlement amount.",
        settlementModel: "outgoing_wire",
        toCurrencyId: CURRENCY_IDS.USD,
        toParticipantCode: "beneficiary",
      },
    ],
    name: "Exporter Settlement",
    participants: [
      {
        bindingKind: "deal_customer",
        code: "customer",
        displayNameTemplate: "Deal customer",
        metadata: {},
        partyId: null,
        partyKind: "customer",
        role: "customer",
        sequence: 1,
      },
      {
        bindingKind: "fixed_party",
        code: "treasury_ru",
        displayNameTemplate: "Multihansa Brokers",
        metadata: { treasuryRegion: "ru" },
        partyId: ORGANIZATION_IDS.MULTIHANSA_BROKERS,
        partyKind: "organization",
        role: "internal_source",
        sequence: 2,
      },
      {
        bindingKind: "fixed_party",
        code: "treasury_ae",
        displayNameTemplate: "Arabian Fuel Alliance",
        metadata: { treasuryRegion: "ae" },
        partyId: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
        partyKind: "organization",
        role: "internal_destination",
        sequence: 3,
      },
      {
        bindingKind: "deal_beneficiary",
        code: "beneficiary",
        displayNameTemplate: "Settlement beneficiary",
        metadata: {},
        partyId: null,
        partyKind: "counterparty",
        role: "beneficiary",
        sequence: 4,
      },
    ],
  },
] as const;

async function deleteSeededRouteTemplates(db: SeedDb) {
  await db
    .delete(schema.routeTemplates)
    .where(
      inArray(
        schema.routeTemplates.code,
        ROUTE_TEMPLATE_SEEDS.map((template) => template.code),
      ),
    );
}

async function insertRouteTemplate(db: SeedDb, template: SeedRouteTemplate) {
  const participantIdByCode = new Map<string, string>();
  const legIdByCode = new Map<string, string>();

  await db.insert(schema.routeTemplates).values({
    id: template.id,
    code: template.code,
    name: template.name,
    dealType: template.dealType,
    description: template.description,
    status: "published",
  });

  await db.insert(schema.routeTemplateParticipants).values(
    template.participants.map((participant) => {
      const participantId = stableUuid(
        `route-template-participant:${template.code}:${participant.code}`,
      );
      participantIdByCode.set(participant.code, participantId);

      return {
        id: participantId,
        routeTemplateId: template.id,
        code: participant.code,
        role: participant.role,
        bindingKind: participant.bindingKind,
        partyKind: participant.partyKind,
        customerId:
          participant.bindingKind === "fixed_party" &&
          participant.partyKind === "customer"
            ? participant.partyId
            : null,
        organizationId:
          participant.bindingKind === "fixed_party" &&
          participant.partyKind === "organization"
            ? participant.partyId
            : null,
        counterpartyId:
          participant.bindingKind === "fixed_party" &&
          participant.partyKind === "counterparty"
            ? participant.partyId
            : null,
        requisiteId: null,
        displayNameTemplate: participant.displayNameTemplate,
        sequence: participant.sequence,
        metadataJson: participant.metadata,
      };
    }),
  );

  await db.insert(schema.routeTemplateLegs).values(
    template.legs.map((leg) => {
      const legId = stableUuid(`route-template-leg:${template.code}:${leg.code}`);
      legIdByCode.set(leg.code, legId);

      return {
        id: legId,
        routeTemplateId: template.id,
        code: leg.code,
        idx: leg.idx,
        kind: leg.kind,
        fromParticipantId: participantIdByCode.get(leg.fromParticipantCode)!,
        toParticipantId: participantIdByCode.get(leg.toParticipantCode)!,
        fromCurrencyId: leg.fromCurrencyId,
        toCurrencyId: leg.toCurrencyId,
        expectedFromAmountMinor: null,
        expectedToAmountMinor: null,
        expectedRateNum: null,
        expectedRateDen: null,
        settlementModel: leg.settlementModel,
        executionCounterpartyId: null,
        notes: leg.notes,
      };
    }),
  );

  await db.insert(schema.routeTemplateCostComponents).values(
    template.costComponents.map((component) => ({
      id: stableUuid(
        `route-template-component:${template.code}:${component.code}`,
      ),
      routeTemplateId: template.id,
      legId: component.legCode ? legIdByCode.get(component.legCode)! : null,
      code: component.code,
      family: component.family,
      classification: component.classification,
      formulaType: component.formulaType,
      basisType: component.basisType,
      currencyId: component.currencyId,
      fixedAmountMinor: component.fixedAmountMinor,
      bps: component.bps,
      perMillion: component.perMillion,
      manualAmountMinor: component.manualAmountMinor,
      roundingMode: "half_up",
      includedInClientRate: component.includedInClientRate,
      sequence: component.sequence,
      notes: component.notes,
    })),
  );
}

export async function seedRouteTemplates(db: SeedDb) {
  await seedCurrencies(db as Database);
  await seedOrganizations(db);
  await deleteSeededRouteTemplates(db);

  for (const template of ROUTE_TEMPLATE_SEEDS) {
    await insertRouteTemplate(db, template);
  }

  console.log(
    `[seed:route-templates] Seeded ${ROUTE_TEMPLATE_SEEDS.length} published route templates`,
  );
}

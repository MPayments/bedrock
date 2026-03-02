import type { Database, Transaction } from "../client";
import { schema } from "../schema";

const ROUTING_RULES = [
  {
    id: "00000000-0000-4000-8000-000000000901",
    name: "default-payout-usd",
    priority: 10,
    enabled: true,
    direction: "payout" as const,
    corridor: "default",
    currency: "USD",
    preferredProviders: ["mock_webhook", "mock_polling"],
    degradationOrder: ["sepa_sct"],
  },
  {
    id: "00000000-0000-4000-8000-000000000902",
    name: "default-payin-usd",
    priority: 20,
    enabled: true,
    direction: "payin" as const,
    corridor: "default",
    currency: "USD",
    preferredProviders: ["mock_webhook", "mock_polling"],
    degradationOrder: ["ach"],
  },
];

const PROVIDER_CORRIDORS = [
  {
    id: "00000000-0000-4000-8000-000000000911",
    providerCode: "mock_webhook",
    corridor: "default",
    direction: "payout" as const,
    currency: "USD",
    supportsWebhooks: true,
    pollingRequired: false,
    slaScore: 90,
  },
  {
    id: "00000000-0000-4000-8000-000000000912",
    providerCode: "mock_polling",
    corridor: "default",
    direction: "payout" as const,
    currency: "USD",
    supportsWebhooks: false,
    pollingRequired: true,
    slaScore: 70,
  },
  {
    id: "00000000-0000-4000-8000-000000000913",
    providerCode: "mock_webhook",
    corridor: "default",
    direction: "payin" as const,
    currency: "USD",
    supportsWebhooks: true,
    pollingRequired: false,
    slaScore: 90,
  },
  {
    id: "00000000-0000-4000-8000-000000000914",
    providerCode: "mock_polling",
    corridor: "default",
    direction: "payin" as const,
    currency: "USD",
    supportsWebhooks: false,
    pollingRequired: true,
    slaScore: 70,
  },
];

const PROVIDER_FEE_SCHEDULES = [
  {
    id: "00000000-0000-4000-8000-000000000921",
    providerCode: "mock_webhook",
    corridor: "default",
    currency: "USD",
    fixedFeeMinor: 10n,
    bps: 20,
    fxMarkupBps: 5,
  },
  {
    id: "00000000-0000-4000-8000-000000000922",
    providerCode: "mock_polling",
    corridor: "default",
    currency: "USD",
    fixedFeeMinor: 20n,
    bps: 35,
    fxMarkupBps: 10,
  },
];

const PROVIDER_LIMITS = [
  {
    id: "00000000-0000-4000-8000-000000000931",
    providerCode: "mock_webhook",
    corridor: "default",
    currency: "USD",
    minAmountMinor: 1n,
    maxAmountMinor: 1_000_000_000n,
    enabled: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000932",
    providerCode: "mock_polling",
    corridor: "default",
    currency: "USD",
    minAmountMinor: 1n,
    maxAmountMinor: 1_000_000_000n,
    enabled: true,
  },
];

const CONNECTOR_HEALTH = [
  {
    providerCode: "mock_webhook",
    status: "up" as const,
    score: 90,
  },
  {
    providerCode: "mock_polling",
    status: "up" as const,
    score: 70,
  },
];

const CONNECTOR_CURSORS = [
  {
    providerCode: "mock_webhook",
    cursorKey: "default",
    cursorValue: null,
  },
  {
    providerCode: "mock_polling",
    cursorKey: "default",
    cursorValue: null,
  },
];

export async function seedOrchestration(db: Database | Transaction) {
  for (const rule of ROUTING_RULES) {
    await db
      .insert(schema.routingRules)
      .values(rule)
      .onConflictDoUpdate({
        target: schema.routingRules.id,
        set: {
          name: rule.name,
          priority: rule.priority,
          enabled: rule.enabled,
          direction: rule.direction,
          corridor: rule.corridor,
          currency: rule.currency,
          preferredProviders: rule.preferredProviders,
          degradationOrder: rule.degradationOrder,
        },
      });
  }

  for (const corridor of PROVIDER_CORRIDORS) {
    await db
      .insert(schema.providerCorridors)
      .values(corridor)
      .onConflictDoUpdate({
        target: [
          schema.providerCorridors.providerCode,
          schema.providerCorridors.corridor,
          schema.providerCorridors.direction,
          schema.providerCorridors.currency,
        ],
        set: {
          supportsWebhooks: corridor.supportsWebhooks,
          pollingRequired: corridor.pollingRequired,
          slaScore: corridor.slaScore,
          enabled: true,
        },
      });
  }

  for (const schedule of PROVIDER_FEE_SCHEDULES) {
    await db
      .insert(schema.providerFeeSchedules)
      .values(schedule)
      .onConflictDoUpdate({
        target: schema.providerFeeSchedules.id,
        set: {
          fixedFeeMinor: schedule.fixedFeeMinor,
          bps: schedule.bps,
          fxMarkupBps: schedule.fxMarkupBps,
        },
      });
  }

  for (const limit of PROVIDER_LIMITS) {
    await db
      .insert(schema.providerLimits)
      .values(limit)
      .onConflictDoUpdate({
        target: [
          schema.providerLimits.providerCode,
          schema.providerLimits.corridor,
          schema.providerLimits.currency,
        ],
        set: {
          minAmountMinor: limit.minAmountMinor,
          maxAmountMinor: limit.maxAmountMinor,
          enabled: limit.enabled,
        },
      });
  }

  for (const health of CONNECTOR_HEALTH) {
    await db
      .insert(schema.connectorHealth)
      .values(health)
      .onConflictDoUpdate({
        target: schema.connectorHealth.providerCode,
        set: {
          status: health.status,
          score: health.score,
        },
      });
  }

  for (const cursor of CONNECTOR_CURSORS) {
    await db
      .insert(schema.connectorCursors)
      .values(cursor)
      .onConflictDoUpdate({
        target: [
          schema.connectorCursors.providerCode,
          schema.connectorCursors.cursorKey,
        ],
        set: {
          cursorValue: cursor.cursorValue,
        },
      });
  }

  console.log(
    `[seed:orchestration] Seeded ${ROUTING_RULES.length} routing rules and ${PROVIDER_CORRIDORS.length} provider corridors`,
  );
}

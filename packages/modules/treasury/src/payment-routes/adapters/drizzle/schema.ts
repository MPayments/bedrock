import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { PaymentRouteCalculation } from "../../application/contracts/dto";
import type {
  PaymentRouteDraft,
  PaymentRouteParticipantKind,
  PaymentRouteTemplateStatus,
  PaymentRouteVisualMetadata,
} from "../../application/contracts/zod";

export const paymentRouteTemplates = pgTable(
  "payment_route_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: text("status")
      .$type<PaymentRouteTemplateStatus>()
      .notNull()
      .default("active"),
    sourceCustomerId: uuid("source_customer_id").notNull(),
    destinationEntityKind: text("destination_entity_kind")
      .$type<Exclude<PaymentRouteParticipantKind, "customer">>()
      .notNull(),
    destinationEntityId: uuid("destination_entity_id").notNull(),
    currencyInId: uuid("currency_in_id").notNull(),
    currencyOutId: uuid("currency_out_id").notNull(),
    hopCount: integer("hop_count").notNull().default(0),
    draft: jsonb("draft").$type<PaymentRouteDraft>().notNull(),
    visual: jsonb("visual")
      .$type<PaymentRouteVisualMetadata>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    lastCalculation:
      jsonb("last_calculation").$type<PaymentRouteCalculation | null>(),
    snapshotPolicy: text("snapshot_policy")
      .$type<"clone_on_attach">()
      .notNull()
      .default("clone_on_attach"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("payment_route_templates_status_idx").on(table.status),
    index("payment_route_templates_name_idx").on(table.name),
    index("payment_route_templates_updated_idx").on(table.updatedAt),
    index("payment_route_templates_source_customer_idx").on(table.sourceCustomerId),
  ],
);

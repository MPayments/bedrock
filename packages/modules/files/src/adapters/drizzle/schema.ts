import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { deals } from "@bedrock/deals/schema";
import { user } from "@bedrock/iam/schema";
import { counterparties } from "@bedrock/parties/schema";

import {
  FILE_GENERATED_FORMAT_VALUES,
  FILE_GENERATED_LANG_VALUES,
  FILE_LINK_KIND_VALUES,
  FILE_ORIGIN_VALUES,
} from "../../domain/constants";

export const fileAssetOriginEnum = pgEnum(
  "file_asset_origin",
  FILE_ORIGIN_VALUES,
);
export const fileLinkKindEnum = pgEnum("file_link_kind", FILE_LINK_KIND_VALUES);
export const fileGeneratedFormatEnum = pgEnum(
  "file_generated_format",
  FILE_GENERATED_FORMAT_VALUES,
);
export const fileGeneratedLangEnum = pgEnum(
  "file_generated_lang",
  FILE_GENERATED_LANG_VALUES,
);

export const fileVersions = pgTable(
  "file_versions",
  {
    id: uuid("id").primaryKey(),
    fileAssetId: uuid("file_asset_id")
      .notNull()
      .references((): AnyPgColumn => fileAssets.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    storageKey: text("storage_key").notNull(),
    checksum: text("checksum").notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("file_versions_asset_version_uq").on(
      table.fileAssetId,
      table.versionNumber,
    ),
    unique("file_versions_id_asset_uq").on(table.id, table.fileAssetId),
    index("file_versions_asset_idx").on(table.fileAssetId),
  ],
);

export const fileAssets = pgTable(
  "file_assets",
  {
    id: uuid("id").primaryKey(),
    currentVersionId: uuid("current_version_id"),
    origin: fileAssetOriginEnum("origin").notNull(),
    description: text("description"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: "file_assets_current_version_belongs_to_asset_fk",
      columns: [table.currentVersionId, table.id],
      foreignColumns: [fileVersions.id, fileVersions.fileAssetId],
    }).onDelete("set null"),
    uniqueIndex("file_assets_current_version_uq")
      .on(table.currentVersionId)
      .where(sql`${table.currentVersionId} is not null`),
    index("file_assets_current_version_idx").on(table.currentVersionId),
  ],
);

export const fileLinks = pgTable(
  "file_links",
  {
    id: uuid("id").primaryKey(),
    fileAssetId: uuid("file_asset_id")
      .notNull()
      .references(() => fileAssets.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    counterpartyId: uuid("counterparty_id").references(() => counterparties.id, {
      onDelete: "cascade",
    }),
    linkKind: fileLinkKindEnum("link_kind").notNull(),
    generatedFormat: fileGeneratedFormatEnum("generated_format"),
    generatedLang: fileGeneratedLangEnum("generated_lang"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("file_links_asset_uq").on(table.fileAssetId),
    index("file_links_deal_idx").on(table.dealId),
    index("file_links_counterparty_idx").on(table.counterpartyId),
    check(
      "file_links_exactly_one_owner_chk",
      sql`(
        (${table.dealId} is not null and ${table.counterpartyId} is null)
        or (${table.dealId} is null and ${table.counterpartyId} is not null)
      )`,
    ),
    check(
      "file_links_generated_variant_shape_chk",
      sql`(
        ${table.linkKind} in ('deal_attachment', 'legal_entity_attachment')
        and ${table.generatedFormat} is null
        and ${table.generatedLang} is null
      ) or (
        ${table.linkKind} in ('deal_application', 'deal_invoice', 'deal_acceptance', 'legal_entity_contract')
        and ${table.generatedFormat} is not null
        and ${table.generatedLang} is not null
      )`,
    ),
    uniqueIndex("file_links_generated_deal_variant_uq")
      .on(
        table.dealId,
        table.linkKind,
        table.generatedFormat,
        table.generatedLang,
      )
      .where(
        sql`${table.dealId} is not null and ${table.linkKind} in ('deal_application', 'deal_invoice', 'deal_acceptance')`,
      ),
    uniqueIndex("file_links_generated_counterparty_variant_uq")
      .on(
        table.counterpartyId,
        table.linkKind,
        table.generatedFormat,
        table.generatedLang,
      )
      .where(
        sql`${table.counterpartyId} is not null and ${table.linkKind} = 'legal_entity_contract'`,
      ),
  ],
);

export const fileAssetsRelations = relations(fileAssets, ({ many, one }) => ({
  currentVersion: one(fileVersions, {
    relationName: "file_assets_current_version",
    fields: [fileAssets.currentVersionId],
    references: [fileVersions.id],
  }),
  link: one(fileLinks, {
    fields: [fileAssets.id],
    references: [fileLinks.fileAssetId],
  }),
  versions: many(fileVersions, {
    relationName: "file_versions_file_asset",
  }),
}));

export const fileVersionsRelations = relations(fileVersions, ({ one }) => ({
  currentForAsset: one(fileAssets, {
    relationName: "file_assets_current_version",
    fields: [fileVersions.id],
    references: [fileAssets.currentVersionId],
  }),
  fileAsset: one(fileAssets, {
    relationName: "file_versions_file_asset",
    fields: [fileVersions.fileAssetId],
    references: [fileAssets.id],
  }),
}));

export const fileLinksRelations = relations(fileLinks, ({ one }) => ({
  counterparty: one(counterparties, {
    fields: [fileLinks.counterpartyId],
    references: [counterparties.id],
  }),
  deal: one(deals, {
    fields: [fileLinks.dealId],
    references: [deals.id],
  }),
  fileAsset: one(fileAssets, {
    fields: [fileLinks.fileAssetId],
    references: [fileAssets.id],
  }),
}));

import { relations, sql } from 'drizzle-orm';
import { pgTable, serial, text, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { contracts } from './contract';
import { subAgents } from './sub-agent';
import { clientDocuments } from './client-document';
import { user } from './user';

type LocalizedText = {
  ru?: string | null;
  en?: string | null;
};

export const clients = pgTable('clients', {
  id: serial().primaryKey(),

  orgName: text().notNull(),
  orgNameI18n: jsonb().$type<LocalizedText>(),
  orgType: text(),
  orgTypeI18n: jsonb().$type<LocalizedText>(),

  directorName: text(),
  directorNameI18n: jsonb().$type<LocalizedText>(),
  position: text(),
  positionI18n: jsonb().$type<LocalizedText>(),
  directorBasis: text(),
  directorBasisI18n: jsonb().$type<LocalizedText>(),

  address: text(),
  addressI18n: jsonb().$type<LocalizedText>(),
  email: text(),
  phone: text(),

  inn: text(),
  kpp: text(),
  ogrn: text(),
  oktmo: text(),
  okpo: text(),

  bankName: text(),
  bankNameI18n: jsonb().$type<LocalizedText>(),
  bankAddress: text(),
  bankAddressI18n: jsonb().$type<LocalizedText>(),
  account: text(),
  bic: text(),
  corrAccount: text(),

  isDeleted: boolean().default(false).notNull(),
  contractId: integer().references(() => contracts.id),
  subAgentId: integer().references(() => subAgents.id),
  userId: integer().references(() => user.id),
  createdAt: text()
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(contracts, {
    fields: [clients.contractId],
    references: [contracts.id],
  }),
  subAgent: one(subAgents, {
    fields: [clients.subAgentId],
    references: [subAgents.id],
  }),
  user: one(user, {
    fields: [clients.userId],
    references: [user.id],
  }),
  documents: many(clientDocuments),
}));

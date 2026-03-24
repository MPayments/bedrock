import { pgEnum } from "drizzle-orm/pg-core";

export const opsApplicationStatusEnum = pgEnum("ops_application_status", [
  "forming",
  "created",
  "rejected",
  "finished",
]);

export const opsDealStatusEnum = pgEnum("ops_deal_status", [
  "preparing_documents",
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
  "done",
  "cancelled",
]);

export const opsActivityActionEnum = pgEnum("ops_activity_action", [
  "create",
  "update",
  "delete",
  "status_change",
  "comment",
  "upload_document",
]);

export const opsActivityEntityEnum = pgEnum("ops_activity_entity", [
  "application",
  "deal",
  "client",
  "calculation",
  "contract",
  "todo",
  "document",
]);

export const opsActivitySourceEnum = pgEnum("ops_activity_source", [
  "web",
  "bot",
]);

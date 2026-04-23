import type { DealLegKind, DealType } from "./zod";

export const LEG_KIND_REQUIRED_DOC_TYPE: Record<DealLegKind, string | null> = {
  collect: "invoice",
  convert: "exchange",
  transit_hold: null,
  payout: null,
  settle_exporter: "transfer_resolution",
};

export const OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<DealType, string> = {
  payment: "invoice",
  currency_exchange: "exchange",
  currency_transit: "invoice",
  exporter_settlement: "invoice",
};

export const CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<
  DealType,
  string | null
> = {
  payment: "acceptance",
  currency_exchange: null,
  currency_transit: "acceptance",
  exporter_settlement: "acceptance",
};

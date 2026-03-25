export const DEAL_STATUS_VALUES = [
  "preparing_documents",
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
  "done",
  "cancelled",
] as const;

export type DealStatus = (typeof DEAL_STATUS_VALUES)[number];

// Sequential progression, plus done/cancelled from any state
const VALID_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  preparing_documents: [
    "awaiting_funds",
    "done",
    "cancelled",
  ],
  awaiting_funds: [
    "awaiting_payment",
    "done",
    "cancelled",
  ],
  awaiting_payment: [
    "closing_documents",
    "done",
    "cancelled",
  ],
  closing_documents: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

export function canTransitionDeal(from: DealStatus, to: DealStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

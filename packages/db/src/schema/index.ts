import { journalEntries, journalLines } from "./journal";
import { ledgerAccounts } from "./ledger";
import { outbox } from "./outbox";
import { tbTransferPlans } from "./tb-plan";

export const schema = {
  journalEntries,
  journalLines,
  ledgerAccounts,
  outbox,
  tbTransferPlans
};
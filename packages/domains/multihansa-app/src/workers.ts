import { type WorkerDescriptor } from "@multihansa/common/workers";
import { DOCUMENTS_WORKER_DESCRIPTOR } from "@multihansa/documents/runtime";
import {
  BALANCES_WORKER_DESCRIPTOR,
} from "@multihansa/balances";
import {
  LEDGER_WORKER_DESCRIPTOR,
} from "@multihansa/ledger";
import {
  DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR,
} from "@multihansa/reporting/ifrs-documents";
import { FX_RATES_WORKER_DESCRIPTOR } from "@multihansa/treasury/fx";
import { RECONCILIATION_WORKER_DESCRIPTOR } from "@multihansa/reconciliation";

export const MULTIHANSA_WORKER_DESCRIPTORS = [
  BALANCES_WORKER_DESCRIPTOR,
  DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR,
  DOCUMENTS_WORKER_DESCRIPTOR,
  FX_RATES_WORKER_DESCRIPTOR,
  LEDGER_WORKER_DESCRIPTOR,
  RECONCILIATION_WORKER_DESCRIPTOR,
] as const satisfies readonly WorkerDescriptor[];

import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  CounterpartyRequisite,
  CounterpartyRequisiteOption,
  ListCounterpartyRequisiteOptionsQuery,
  ListCounterpartyRequisitesQuery,
} from "../../contracts";
import type { CounterpartyRequisiteSnapshot } from "../../domain/counterparty-requisite";

export interface CounterpartyRequisiteOptionRecord extends Omit<
  CounterpartyRequisiteOption,
  "ownerType" | "ownerId"
> {
  ownerId: string;
  currencyCode: string;
  beneficiaryName: string | null;
  institutionName: string | null;
  institutionCountry: string | null;
  accountNo: string | null;
  corrAccount: string | null;
  iban: string | null;
  bic: string | null;
  swift: string | null;
  bankAddress: string | null;
  network: string | null;
  assetCode: string | null;
  address: string | null;
  memoTag: string | null;
  accountRef: string | null;
  subaccountRef: string | null;
  contact: string | null;
  notes: string | null;
}

export interface CounterpartyRequisitesQueryRepository {
  findActiveRequisiteById: (id: string) => Promise<CounterpartyRequisite | null>;
  listRequisites: (
    input: ListCounterpartyRequisitesQuery,
  ) => Promise<PaginatedList<CounterpartyRequisite>>;
  listRequisiteOptions: (
    input: ListCounterpartyRequisiteOptionsQuery,
  ) => Promise<CounterpartyRequisiteOptionRecord[]>;
  listLabelsById: (ids: string[]) => Promise<Map<string, string>>;
}

export interface CounterpartyRequisitesCommandTxRepository {
  findActiveRequisiteSnapshotById: (
    id: string,
  ) => Promise<CounterpartyRequisiteSnapshot | null>;
  listActiveRequisitesByCounterpartyCurrency: (input: {
    counterpartyId: string;
    currencyId: string;
  }) => Promise<CounterpartyRequisiteSnapshot[]>;
  insertRequisite: (
    requisite: CounterpartyRequisiteSnapshot,
  ) => Promise<CounterpartyRequisiteSnapshot>;
  updateRequisite: (
    requisite: CounterpartyRequisiteSnapshot,
  ) => Promise<CounterpartyRequisiteSnapshot | null>;
  setDefaultState: (input: {
    counterpartyId: string;
    currencyId: string;
    defaultId: string | null;
    demotedIds: string[];
  }) => Promise<void>;
  archiveRequisite: (input: {
    requisiteId: string;
    archivedAt: Date;
  }) => Promise<boolean>;
}

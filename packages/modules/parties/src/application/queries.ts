import type { PartiesRepository } from "./ports";

export interface PartiesQueries {
  customers: {
    listDisplayNamesById: (ids: string[]) => Promise<Map<string, string>>;
  };
  counterparties: {
    listShortNamesById: (ids: string[]) => Promise<Map<string, string>>;
    listGroupMembers: (input: {
      groupIds: string[];
      includeDescendants: boolean;
    }) => Promise<
      {
        rootGroupId: string;
        counterpartyId: string;
      }[]
    >;
  };
}

export type CustomersQueries = PartiesQueries["customers"];
export type CounterpartiesQueries = PartiesQueries["counterparties"];

export function createPartiesQueryHandlers(input: {
  parties: PartiesRepository;
}): PartiesQueries {
  const { parties } = input;

  return {
    customers: {
      listDisplayNamesById(ids: string[]) {
        return parties.listCustomerDisplayNamesById(ids);
      },
    },
    counterparties: {
      listShortNamesById(ids: string[]) {
        return parties.listCounterpartyShortNamesById(ids);
      },
      listGroupMembers(query) {
        return parties.listGroupMembers(query);
      },
    },
  };
}

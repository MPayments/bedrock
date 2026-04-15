import type {
  CustomerLegalEntitiesQuery,
  ParticipantLookupItem,
  ParticipantLookupQuery,
} from "../contracts";

export interface ParticipantReads {
  listCustomerLegalEntities(input: {
    customerId: string;
    query: CustomerLegalEntitiesQuery;
  }): Promise<ParticipantLookupItem[]>;
  lookup(input: ParticipantLookupQuery): Promise<ParticipantLookupItem[]>;
}

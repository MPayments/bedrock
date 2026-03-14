import {
  assertBooksBelongToInternalLedgerOrganizations,
  assertInternalLedgerOrganization,
  listInternalLedgerOrganizations,
} from "@bedrock/organizations";
import type { Database, Transaction } from "@bedrock/platform-persistence";

type Queryable = Database | Transaction;

export async function listAccountingInternalOrganizations(db: Queryable) {
  return listInternalLedgerOrganizations(db);
}

export async function assertAccountingOrganizationIsInternal(input: {
  db: Queryable;
  organizationId: string;
}) {
  return assertInternalLedgerOrganization(input);
}

export async function assertAccountingBooksBelongToInternalOrganizations(input: {
  db: Queryable;
  bookIds: string[];
}) {
  return assertBooksBelongToInternalLedgerOrganizations(input);
}

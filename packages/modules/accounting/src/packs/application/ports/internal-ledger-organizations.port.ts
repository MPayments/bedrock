export interface InternalLedgerOrganizationsPort {
  assertBooksBelongToInternalLedgerOrganizations(bookIds: string[]): Promise<void>;
}

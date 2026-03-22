export type InternalLedgerBookGuard = (input: {
  bookIds: string[];
}) => Promise<void>;

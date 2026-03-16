export type PersistenceSession = unknown;

export type RunInPersistenceSession = <T>(
  run: (session: PersistenceSession) => Promise<T>,
) => Promise<T>;

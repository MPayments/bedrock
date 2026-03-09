export interface SqlContribution<
  TTables extends Record<string, unknown> = Record<string, unknown>,
> {
  tables?: TTables;
  relations?: Record<string, unknown>;
  migrations?: readonly unknown[];
}

export function defineSqlContribution<T extends SqlContribution>(input: T): T {
  return input;
}

export function defineSqlRelations<T extends Record<string, unknown>>(
  relations: T,
): T {
  return relations;
}

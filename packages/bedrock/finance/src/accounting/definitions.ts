import type { AccountingPackDefinition } from "./packs/schema";

export interface ChartDefinition {
  name: string;
  accounts: readonly Record<string, unknown>[];
}

export interface JournalDefinition {
  name: string;
  chart: string;
  source: string;
  map: (input: unknown) => unknown;
}

export type PostingTemplateDefinition = AccountingPackDefinition;

export function defineChart(
  name: string,
  definition: Omit<ChartDefinition, "name">,
): ChartDefinition {
  return {
    name,
    ...definition,
  };
}

export function defineJournal(
  name: string,
  definition: Omit<JournalDefinition, "name">,
): JournalDefinition {
  return {
    name,
    ...definition,
  };
}

export function definePostingTemplate<T extends PostingTemplateDefinition>(
  definition: T,
): T {
  return definition;
}

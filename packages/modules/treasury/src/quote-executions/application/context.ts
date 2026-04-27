import type { ModuleRuntime } from "@bedrock/shared/core";

import type { QuoteExecutionsRepository } from "./ports/quote-executions.repository";
import type { QuotesService } from "../../quotes/application";

export interface QuoteExecutionsServiceDeps {
  quotes: Pick<QuotesService["queries"], "getQuoteDetails">;
  repository: QuoteExecutionsRepository;
  runtime: ModuleRuntime;
}

export type QuoteExecutionsServiceContext = QuoteExecutionsServiceDeps;

export function createQuoteExecutionsServiceContext(
  deps: QuoteExecutionsServiceDeps,
): QuoteExecutionsServiceContext {
  return deps;
}

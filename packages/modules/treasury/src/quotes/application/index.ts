import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateQuoteCommand } from "./commands/create-quote";
import { ExpireQuotesCommand } from "./commands/expire-quotes";
import { MarkQuoteUsedCommand } from "./commands/mark-quote-used";
import type {
  QuoteFeeComponentsRepository,
  QuoteFinancialLinesRepository,
  QuotesCommandUnitOfWork,
  QuoteRecord,
  QuoteRatesPort,
  QuotesRepository,
} from "./ports";
import { GetQuoteByIdQuery } from "./queries/get-quote-by-id";
import { GetQuoteDetailsQuery } from "./queries/get-quote-details";
import { ListQuotesQuery } from "./queries/list-quotes";
import { PreviewQuoteQuery } from "./queries/preview-quote";
import type {
  CurrenciesPort,
  QuoteFeesPort,
} from "../../shared/application/external-ports";

export interface QuotesServiceDeps {
  runtime: ModuleRuntime;
  currencies: CurrenciesPort;
  fees: QuoteFeesPort;
  quoteFeeComponentsRepository: QuoteFeeComponentsRepository;
  quoteFinancialLinesRepository: QuoteFinancialLinesRepository;
  quotesRepository: QuotesRepository;
  rates: QuoteRatesPort;
  commandUow: QuotesCommandUnitOfWork;
}

export function createQuotesService(deps: QuotesServiceDeps) {
  const createQuote = new CreateQuoteCommand(
    deps.runtime,
    deps.currencies,
    deps.fees,
    deps.commandUow,
    deps.rates.getCrossRate,
  );
  const markQuoteUsed = new MarkQuoteUsedCommand(
    deps.currencies,
    deps.quotesRepository,
  );
  const expireQuotes = new ExpireQuotesCommand(deps.quotesRepository);
  const previewQuote = new PreviewQuoteQuery(
    deps.fees,
    deps.rates.getCrossRate,
  );
  const listQuotes = new ListQuotesQuery(
    deps.currencies,
    deps.quotesRepository,
  );
  const getQuoteDetails = new GetQuoteDetailsQuery(
    deps.currencies,
    deps.quoteFeeComponentsRepository,
    deps.quoteFinancialLinesRepository,
    deps.quotesRepository,
  );
  const getQuoteById = new GetQuoteByIdQuery(deps.quotesRepository);

  return {
    commands: {
      createQuote: createQuote.execute.bind(createQuote),
      markQuoteUsed: markQuoteUsed.execute.bind(markQuoteUsed),
      expireQuotes: expireQuotes.execute.bind(expireQuotes),
    },
    queries: {
      findById: getQuoteById.execute.bind(getQuoteById) as (
        id: string,
      ) => Promise<QuoteRecord | null>,
      previewQuote: previewQuote.execute.bind(previewQuote),
      listQuotes: listQuotes.execute.bind(listQuotes),
      getQuoteDetails: getQuoteDetails.execute.bind(getQuoteDetails),
    },
  };
}

export type QuotesService = ReturnType<typeof createQuotesService>;

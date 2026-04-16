import type { ModuleRuntime } from "@bedrock/shared/core";

import type { CrossRate } from "../../rates/application/ports/rates.repository";
import type { CurrenciesPort } from "../../shared/application/external-ports";
import { ArchivePaymentRouteTemplateCommand } from "./commands/archive-template";
import { CreatePaymentRouteTemplateCommand } from "./commands/create-template";
import { DuplicatePaymentRouteTemplateCommand } from "./commands/duplicate-template";
import { UpdatePaymentRouteTemplateCommand } from "./commands/update-template";
import type { PaymentRouteTemplatesRepository } from "./ports/payment-routes.repository";
import { GetPaymentRouteTemplateByIdQuery } from "./queries/get-template-by-id";
import { ListPaymentRouteTemplatesQueryHandler } from "./queries/list-templates";
import { PreviewPaymentRouteQuery } from "./queries/preview-template";

export interface PaymentRoutesServiceDeps {
  currencies: CurrenciesPort;
  repository: PaymentRouteTemplatesRepository;
  runtime: ModuleRuntime;
  getCrossRate: (
    base: string,
    quote: string,
    asOf: Date,
    anchor?: string,
  ) => Promise<CrossRate>;
}

export function createPaymentRoutesService(deps: PaymentRoutesServiceDeps) {
  const createTemplate = new CreatePaymentRouteTemplateCommand(
    deps.runtime,
    deps.currencies,
    deps.repository,
    deps.getCrossRate,
  );
  const updateTemplate = new UpdatePaymentRouteTemplateCommand(
    deps.runtime,
    deps.currencies,
    deps.repository,
    deps.getCrossRate,
  );
  const archiveTemplate = new ArchivePaymentRouteTemplateCommand(
    deps.runtime,
    deps.repository,
  );
  const duplicateTemplate = new DuplicatePaymentRouteTemplateCommand(
    deps.runtime,
    deps.repository,
  );
  const getTemplateById = new GetPaymentRouteTemplateByIdQuery(deps.repository);
  const listTemplates = new ListPaymentRouteTemplatesQueryHandler(
    deps.repository,
  );
  const previewTemplate = new PreviewPaymentRouteQuery(
    deps.currencies,
    deps.getCrossRate,
  );

  return {
    commands: {
      archiveTemplate: archiveTemplate.execute.bind(archiveTemplate),
      createTemplate: createTemplate.execute.bind(createTemplate),
      duplicateTemplate: duplicateTemplate.execute.bind(duplicateTemplate),
      updateTemplate: updateTemplate.execute.bind(updateTemplate),
    },
    queries: {
      findTemplateById: getTemplateById.execute.bind(getTemplateById),
      listTemplates: listTemplates.execute.bind(listTemplates),
      previewTemplate: previewTemplate.execute.bind(previewTemplate),
    },
  };
}

export type PaymentRoutesService = ReturnType<typeof createPaymentRoutesService>;

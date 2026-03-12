import type { CurrenciesService } from "@bedrock/application/currencies";
import type { RequisitesService } from "@bedrock/application/requisites";

export interface CommercialModuleDeps {
  currenciesService: CurrenciesService;
  requisitesService: RequisitesService;
}

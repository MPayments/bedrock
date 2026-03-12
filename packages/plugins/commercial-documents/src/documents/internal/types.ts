import type { CurrenciesService } from "@bedrock/currencies";
import type { RequisitesService } from "@bedrock/parties/requisites";

export interface CommercialModuleDeps {
  currenciesService: CurrenciesService;
  requisitesService: RequisitesService;
}

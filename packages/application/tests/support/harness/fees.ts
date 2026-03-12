import { createMockCurrenciesService } from "./fx";
import { createFeesService } from "../../../src/fees/service";

export function createTestFeesService(deps: Record<string, any>) {
  return createFeesService({
    ...deps,
    currenciesService: deps.currenciesService ?? createMockCurrenciesService(),
  });
}

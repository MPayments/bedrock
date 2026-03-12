import { createMockCurrenciesService } from "./fx";
import { createFeesService } from "@bedrock/fees";
import { createStubDb } from "@bedrock/test-utils";

export function createTestFeesService(deps: Record<string, any>) {
  return createFeesService({
    ...deps,
    db: deps.db ?? createStubDb(),
    currenciesService: deps.currenciesService ?? createMockCurrenciesService(),
  });
}

import {
  createCbrRateSourceProvider,
} from "./sources/cbr";
import {
  createInvestingRateSourceProvider,
} from "./sources/investing";
import {
  createXeRateSourceProvider,
} from "./sources/xe";

export function createDefaultFxRateSourceProviders() {
  return {
    cbr: createCbrRateSourceProvider(),
    investing: createInvestingRateSourceProvider(),
    xe: createXeRateSourceProvider(),
  };
}

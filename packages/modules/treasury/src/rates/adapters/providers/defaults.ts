import {
  createCbrRateSourceProvider,
} from "./sources/cbr";
import {
  createGrinexRateSourceProvider,
} from "./sources/grinex";
import {
  createInvestingRateSourceProvider,
} from "./sources/investing";
import {
  createXeRateSourceProvider,
} from "./sources/xe";

export function createDefaultRateSourceProviders() {
  return {
    cbr: createCbrRateSourceProvider(),
    investing: createInvestingRateSourceProvider(),
    xe: createXeRateSourceProvider(),
    grinex: createGrinexRateSourceProvider(),
  };
}

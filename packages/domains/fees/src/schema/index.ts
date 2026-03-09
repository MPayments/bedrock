import { fxQuoteFeeComponents } from "./quote-components";
import { feeRules } from "./rules";

export const schema = {
  feeRules,
  fxQuoteFeeComponents,
};

export { fxQuoteFeeComponents, feeRules };

export {
  type FeeAccountingTreatment,
  type FeeCalcMethod,
  type FeeOperationKind,
  type FeeSettlementMode,
} from "./rules";
export { type FeeComponentSource } from "./quote-components";

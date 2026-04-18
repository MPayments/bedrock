import {
  calculationLineKindEnum,
  calculationLines,
  calculations,
  calculationRateSourceEnum,
  calculationSnapshots,
} from "./adapters/drizzle/schema";
import { paymentRouteTemplates } from "./route-templates/adapters/drizzle/schema";

export {
  calculationLineKindEnum,
  calculationLines,
  calculations,
  calculationRateSourceEnum,
  calculationSnapshots,
  paymentRouteTemplates,
};

export const schema = {
  calculations,
  calculationSnapshots,
  calculationLines,
  calculationRateSourceEnum,
  calculationLineKindEnum,
  paymentRouteTemplates,
};

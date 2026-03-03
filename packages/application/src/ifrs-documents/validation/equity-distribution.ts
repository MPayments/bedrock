import { z } from "zod";

import {
  EquityContributionInputSchema,
  EquityContributionSchema,
} from "./equity-contribution";

export const EquityDistributionInputSchema = EquityContributionInputSchema;

export const EquityDistributionSchema = EquityContributionSchema;

export type EquityDistributionInput = z.infer<typeof EquityDistributionInputSchema>;
export type EquityDistribution = z.infer<typeof EquityDistributionSchema>;

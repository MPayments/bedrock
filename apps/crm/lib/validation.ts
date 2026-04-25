import { z } from "zod";

export const localizedTextSchema = z.object({
  ru: z.string().optional(),
  en: z.string().optional(),
});

export interface CustomerBankingFormData {
  bankMode: "existing" | "manual";
  bankProvider: {
    address?: string;
    country?: string;
    name?: string;
    routingCode?: string;
  };
  bankProviderId: string | null;
  bankRequisite: {
    accountNo?: string;
    beneficiaryName?: string;
    iban?: string;
  };
}

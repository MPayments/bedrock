import { z } from "zod";

export const CompanyLookupResultSchema = z.object({
  orgName: z.string(),
  orgType: z.string().nullable(),
  directorName: z.string().nullable(),
  position: z.string().nullable(),
  directorBasis: z.string().nullable(),
  address: z.string().nullable(),
  inn: z.string(),
  kpp: z.string().nullable(),
  ogrn: z.string().nullable(),
  oktmo: z.string().nullable(),
  okpo: z.string().nullable(),
});

export type CompanyLookupResult = z.infer<typeof CompanyLookupResultSchema>;

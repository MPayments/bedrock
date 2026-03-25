import { z } from "zod";

export const CompanyLookupResultSchema = z.object({
  inn: z.string(),
  kpp: z.string().nullable(),
  ogrn: z.string().nullable(),
  name: z.string(),
  fullName: z.string().nullable(),
  directorName: z.string().nullable(),
  directorPosition: z.string().nullable(),
  address: z.string().nullable(),
  oktmo: z.string().nullable(),
  okpo: z.string().nullable(),
  orgType: z.string().nullable(),
});

export type CompanyLookupResult = z.infer<typeof CompanyLookupResultSchema>;

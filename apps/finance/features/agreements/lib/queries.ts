import { cache } from "react";
import { z } from "zod";

import { readJsonWithSchema, requestOk } from "@/lib/api/response";
import { getServerApiClient } from "@/lib/api/server-client";
import { isUuid } from "@/lib/resources/http";

export const FinanceAgreementContextSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  organizationRequisiteId: z.string().uuid(),
});

export type FinanceAgreementContext = z.infer<
  typeof FinanceAgreementContextSchema
>;

const getAgreementContextByIdUncached = async (
  id: string,
): Promise<FinanceAgreementContext | null> => {
  if (!isUuid(id)) {
    return null;
  }

  const client = await getServerApiClient();
  const response = await client.v1.agreements[":id"].$get(
    {
      param: { id },
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить договор");
  return readJsonWithSchema(response, FinanceAgreementContextSchema);
};

export const getAgreementContextById = cache(getAgreementContextByIdUncached);

import { EditAccountFormClient } from "../components/edit-account-form-client";
import { getAccountById, getAccountFormOptions } from "../lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface AccountPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountPage({ params }: AccountPageProps) {
  const [{ entity: account }, options] = await Promise.all([
    loadResourceByIdParamOrNotFound({
      params,
      getById: getAccountById,
    }),
    getAccountFormOptions(),
  ]);

  return <EditAccountFormClient account={account} options={options} />;
}

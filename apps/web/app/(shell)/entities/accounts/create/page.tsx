import { CreateAccountFormClient } from "../components/create-account-form-client";
import { getAccountFormOptions } from "../lib/queries";

export default async function CreateAccountPage() {
  const options = await getAccountFormOptions();

  return <CreateAccountFormClient options={options} />;
}

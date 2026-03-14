import { CreateOrganizationFormClient } from "@/features/entities/organizations/components/create-organization-form-client";

export default function TreasuryCreateOrganizationPage() {
  return (
    <CreateOrganizationFormClient detailsBasePath="/treasury/organizations" />
  );
}

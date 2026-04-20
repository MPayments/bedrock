import { Card, CardContent } from "@bedrock/sdk-ui/components/card";

import type {
  ApiCanonicalCounterparty,
  ApiCrmDealWorkbenchProjection,
  ApiDealCounterpartySnapshot,
} from "./types";

type PartiesSidebarCardProps = {
  applicant: ApiCanonicalCounterparty | null;
  assignee: ApiCrmDealWorkbenchProjection["assignee"];
  beneficiarySnapshot: ApiDealCounterpartySnapshot | null;
  customer: ApiCrmDealWorkbenchProjection["context"]["customer"];
  customerDisplayName: string | null;
};

function Row({
  label,
  name,
  meta,
}: {
  label: string;
  name: string | null;
  meta: string | null;
}) {
  return (
    <div className="space-y-1">
      <div className="kv-label">{label}</div>
      <div className="text-[13px] font-medium leading-snug">
        {name ?? "—"}
      </div>
      {meta ? (
        <div className="font-mono text-[11px] text-muted-foreground">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

function getCounterpartyIdentifier(
  counterparty: ApiCanonicalCounterparty | null,
): string | null {
  if (!counterparty?.partyProfile) return null;
  const primary = counterparty.partyProfile.identifiers.find(
    (identifier) =>
      identifier.scheme === "inn" || identifier.scheme === "INN",
  );
  return primary?.value ?? null;
}

export function PartiesSidebarCard({
  applicant,
  assignee,
  beneficiarySnapshot,
  customer,
  customerDisplayName,
}: PartiesSidebarCardProps) {
  const customerMetaParts: string[] = [];
  const customerIdentifier = getCounterpartyIdentifier(applicant);
  if (customerIdentifier) customerMetaParts.push(customerIdentifier);
  if (customer?.customer.externalRef) {
    customerMetaParts.push(customer.customer.externalRef);
  }

  const beneficiaryMetaParts: string[] = [];
  if (beneficiarySnapshot?.inn) {
    beneficiaryMetaParts.push(beneficiarySnapshot.inn);
  }
  if (beneficiarySnapshot?.country) {
    beneficiaryMetaParts.push(beneficiarySnapshot.country);
  }

  const agentDisplay =
    assignee.displayName ?? assignee.userId ?? null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <Row
          label="Customer"
          name={customerDisplayName ?? customer?.customer.name ?? null}
          meta={customerMetaParts.join(" · ") || null}
        />
        <div className="h-px bg-border" />
        <Row
          label="Beneficiary"
          name={
            beneficiarySnapshot?.displayName ??
            beneficiarySnapshot?.legalName ??
            null
          }
          meta={beneficiaryMetaParts.join(" · ") || null}
        />
        <div className="h-px bg-border" />
        <Row
          label="Agent"
          name={agentDisplay}
          meta={assignee.displayName ? "Bedrock CRM" : null}
        />
      </CardContent>
    </Card>
  );
}

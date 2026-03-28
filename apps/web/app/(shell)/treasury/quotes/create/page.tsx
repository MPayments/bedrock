import * as React from "react";
import { TicketPercent } from "lucide-react";

import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { TreasuryFxCreateForm } from "@/features/treasury/quotes/components/treasury-fx-create-form";
import {
  createEmptyDocumentFormOptions,
  getDocumentFormOptions,
} from "@/features/documents/lib/form-options";
import { getServerSessionSnapshot } from "@/lib/auth/session";

export default async function TreasuryFxCreatePage() {
  const session = await getServerSessionSnapshot();
  const options = await getDocumentFormOptions().catch(() =>
    createEmptyDocumentFormOptions(),
  );

  return (
    <EntityListPageShell
      icon={TicketPercent}
      title="Казначейский FX"
      description="Создание валютной конверсии из treasury workspace."
      fallback={null}
    >
      <TreasuryFxCreateForm options={options} userRole={session.role} />
    </EntityListPageShell>
  );
}

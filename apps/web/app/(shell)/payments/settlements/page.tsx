import { searchParamsCache } from "@/app/(shell)/operations/lib/validations";
import { FilteredDocumentsPage } from "@/features/documents/ui/filtered-documents-page";

const SETTLEMENT_DOC_TYPES = [
  "payout_settle",
  "payout_void",
  "fee_payout_settle",
  "fee_payout_void",
];

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsedSearch = await searchParamsCache.parse(searchParams);

  return (
    <FilteredDocumentsPage
      title="Платежные расчеты"
      description="Settlement и void документы по payout и fee payout workflows."
      docTypes={SETTLEMENT_DOC_TYPES}
      search={parsedSearch}
    />
  );
}

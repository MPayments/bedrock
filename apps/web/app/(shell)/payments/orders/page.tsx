import { searchParamsCache } from "@/app/(shell)/operations/lib/validations";
import { FilteredDocumentsPage } from "@/features/documents/ui/filtered-documents-page";

const ORDER_DOC_TYPES = [
  "payment_case",
  "payin_funding",
  "payout_initiate",
  "fee_payout_initiate",
  "external_funding",
  "fx_execute",
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsedSearch = await searchParamsCache.parse(searchParams);

  return (
    <FilteredDocumentsPage
      title="Платежные ордера"
      description="Канонический список payment cases, funding и initiate документов."
      docTypes={ORDER_DOC_TYPES}
      search={parsedSearch}
    />
  );
}

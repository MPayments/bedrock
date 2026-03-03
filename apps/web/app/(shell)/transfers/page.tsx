import { ArrowRightLeft } from "lucide-react";

import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { EntityListPageShell } from "@/components/entities/entity-list-page-shell";
import { DocumentsTable } from "@/features/documents/components/documents-table";
import { getDocuments } from "@/features/operations/documents/lib/queries";
import { RecentItemsCard } from "@/features/overview/ui/recent-items-card";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

const TRANSFER_DOC_TYPES = [
  "transfer_intra",
  "transfer_intercompany",
  "transfer_resolution",
];

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export default async function TransfersOverviewPage() {
  const [total, pending, recent] = await Promise.all([
    getDocuments({ page: 1, perPage: 1, docType: TRANSFER_DOC_TYPES }),
    getDocuments({
      page: 1,
      perPage: 1,
      docType: TRANSFER_DOC_TYPES,
      postingStatus: ["unposted", "posting"],
    }),
    getDocuments({ page: 1, perPage: 5, docType: TRANSFER_DOC_TYPES }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <SectionOverviewPage
        icon={ArrowRightLeft}
        title="Переводы"
        description="Intra/intercompany переводы и документы разрешения (settle/void/fail)."
        stats={[
          {
            id: "total",
            label: "Всего transfer-документов IFRS",
            value: formatCount(total.total),
            description: "Переводы между счетами и документы разрешения transfer lifecycle.",
          },
          {
            id: "pending",
            label: "Ожидают проведения",
            value: formatCount(pending.total),
            description: "Документы, еще не завершившие posting lifecycle.",
            href: "/operations",
          },
        ]}
        links={[
          {
            id: "operations",
            title: "Открыть details",
            description: "Провалиться в document details и ledger links.",
            href: "/operations",
            cta: "Открыть операции",
          },
          {
            id: "payments",
            title: "Связанные платежи",
            description: "Сопоставить transfer workflow с платежными событиями.",
            href: "/payments",
            cta: "Открыть платежи",
          },
        ]}
        aside={
          <RecentItemsCard
            title="Последние transfer-документы"
            description="Свежие transfer_intra / transfer_intercompany / transfer_resolution."
            items={recent.data.map((document) => ({
              id: document.id,
              title: document.title,
              subtitle: `${document.docType} · ${document.docNo}`,
              href: `/operations/${document.docType}/${document.id}`,
            }))}
          />
        }
      />
      <TransferDocumentsSection />
    </div>
  );
}

async function TransferDocumentsSection() {
  const documentsPromise = getDocuments({
    page: 1,
    perPage: 20,
    docType: TRANSFER_DOC_TYPES,
  });

  return (
    <EntityListPageShell
      icon={ArrowRightLeft}
      title="Transfer workflow"
      description="Единый список intra/intercompany переводов и transfer resolution."
      fallback={<DataTableSkeleton columnCount={7} rowCount={10} filterCount={4} />}
    >
      <DocumentsTable promise={documentsPromise} />
    </EntityListPageShell>
  );
}

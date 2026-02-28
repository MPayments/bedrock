import { ArrowRightLeft } from "lucide-react";

import { getDocuments } from "@/app/(shell)/operations/lib/queries";
import { FilteredDocumentsPage } from "@/features/documents/ui/filtered-documents-page";
import { RecentItemsCard } from "@/features/overview/ui/recent-items-card";
import { SectionOverviewPage } from "@/features/overview/ui/section-overview-page";

const TRANSFER_DOC_TYPES = ["transfer", "transfer_settle", "transfer_void"];

function formatCount(value: number) {
  return value.toLocaleString("ru-RU");
}

export async function TransfersOverviewPage() {
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
        description="Transfer workflow с draft, approve, settle и void стадиями на одной странице."
        stats={[
          {
            id: "total",
            label: "Всего transfer-документов",
            value: formatCount(total.total),
            description: "Базовые переводы и связанные settlement/void события.",
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
            description="Свежие документы transfer workflow."
            items={recent.data.map((document) => ({
              id: document.id,
              title: document.title,
              subtitle: `${document.docType} · ${document.docNo}`,
              href: `/operations/${document.docType}/${document.id}`,
            }))}
          />
        }
      />
      <FilteredDocumentsPage
        title="Transfer workflow"
        description="Единый список transfer, settle и void документов."
        docTypes={TRANSFER_DOC_TYPES}
        search={{ page: 1, perPage: 20 }}
        icon={ArrowRightLeft}
      />
    </div>
  );
}

"use client";

import { ChevronLeft, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent } from "@bedrock/sdk-ui/components/card";

import { PortalDealVisibility } from "@/components/portal/deal-visibility";
import { API_BASE_URL } from "@/lib/constants";
import {
  buildPortalDealAttachmentDownloadUrl,
  deletePortalDealAttachment,
  type PortalDealProjectionResponse,
  requestPortalDealProjection,
  uploadPortalDealAttachment,
} from "@/lib/portal-deals";

export default function PortalDealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = String(params.id ?? "");

  const [data, setData] = useState<PortalDealProjectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadPurpose, setUploadPurpose] = useState<
    "invoice" | "contract" | "other"
  >("invoice");
  const [downloadingFormat, setDownloadingFormat] = useState<
    "docx" | "pdf" | null
  >(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadProjection = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await requestPortalDealProjection(dealId);
      setData(result);
    } catch (fetchError) {
      console.error("Deal fetch error:", fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Ошибка загрузки данных",
      );
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (dealId) {
      void loadProjection();
    }
  }, [dealId, loadProjection]);

  async function handleAttachmentSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setUploadingAttachment(true);
      setAttachmentError(null);
      await uploadPortalDealAttachment({
        dealId,
        file,
        purpose: uploadPurpose,
      });
      await loadProjection();
    } catch (uploadError) {
      setAttachmentError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить вложение",
      );
    } finally {
      setUploadingAttachment(false);
      event.target.value = "";
    }
  }

  async function handleAttachmentDelete(attachmentId: string) {
    try {
      setDeletingAttachmentId(attachmentId);
      setAttachmentError(null);
      await deletePortalDealAttachment({
        attachmentId,
        dealId,
      });
      await loadProjection();
    } catch (deleteError) {
      setAttachmentError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить вложение",
      );
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  async function handleDownload(format: "pdf" | "docx") {
    if (!data?.calculationSummary) {
      return;
    }

    try {
      setDownloadingFormat(format);
      setCalculationError(null);

      const response = await fetch(
        `${API_BASE_URL}/customer/deals/${dealId}/calculation/export?format=${format}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Ошибка загрузки документа");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `deal-calculation-${data.calculationSummary.id}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      setCalculationError(
        downloadError instanceof Error
          ? downloadError.message
          : "Не удалось скачать расчет",
      );
    } finally {
      setDownloadingFormat(null);
    }
  }

  function handleAttachmentDownload(attachmentId: string) {
    window.location.href = buildPortalDealAttachmentDownloadUrl({
      attachmentId,
      dealId,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/deals")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <Card className="border-destructive">
          <CardContent className="py-6">
            <p className="text-sm text-destructive">
              {error ?? "Данные не найдены"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PortalDealVisibility
      attachmentError={attachmentError}
      calculationError={calculationError}
      data={data}
      dealId={dealId}
      deletingAttachmentId={deletingAttachmentId}
      downloadingFormat={downloadingFormat}
      fileInputRef={fileInputRef}
      onAttachmentDelete={(attachmentId) => {
        void handleAttachmentDelete(attachmentId);
      }}
      onAttachmentDownload={handleAttachmentDownload}
      onAttachmentSelection={handleAttachmentSelection}
      onBack={() => router.push("/deals")}
      onDownload={(format) => {
        void handleDownload(format);
      }}
      onUploadPurposeChange={setUploadPurpose}
      uploadPurpose={uploadPurpose}
      uploadingAttachment={uploadingAttachment}
    />
  );
}

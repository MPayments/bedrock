/* eslint-disable @next/next/no-img-element */
"use client";

import type { ChangeEvent, ReactNode } from "react";
import { FileSignature, Loader2, Save, Stamp, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import {
  ImageCropper,
  IMAGE_DIMENSIONS,
  type ImageType,
} from "@/components/ui/image-cropper";

import type { OrganizationWorkspaceRecord } from "../_lib/organization-workspace-api";
import { uploadOrganizationWorkspaceFiles } from "../_lib/organization-workspace-api";

type OrganizationFilesWorkspaceProps = {
  onDirtyChange: (dirty: boolean) => void;
  onSaved?: () => void;
  organization: OrganizationWorkspaceRecord;
};

function FilePreviewCard(props: {
  title: string;
  description: string;
  emptyLabel: string;
  icon: ReactNode;
  imageUrl: string | null;
  onUploadClick: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {props.icon}
              {props.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{props.description}</p>
          </div>
          <Button type="button" variant="outline" onClick={props.onUploadClick}>
            <Upload className="size-4" />
            Загрузить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex min-h-40 items-center justify-center rounded-lg border bg-muted/20 p-4">
          {props.imageUrl ? (
            <img
              src={props.imageUrl}
              alt={props.title}
              className="max-h-40 max-w-full object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{props.emptyLabel}</p>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Рекомендуемый размер: {IMAGE_DIMENSIONS.signature.width}×
          {IMAGE_DIMENSIONS.signature.height}px для подписи и{" "}
          {IMAGE_DIMENSIONS.seal.width}×{IMAGE_DIMENSIONS.seal.height}px для печати.
        </div>
      </CardContent>
    </Card>
  );
}

export function OrganizationFilesWorkspace({
  onDirtyChange,
  onSaved,
  organization,
}: OrganizationFilesWorkspaceProps) {
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const [sealBlob, setSealBlob] = useState<Blob | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [sealPreview, setSealPreview] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState("");
  const [cropperImageType, setCropperImageType] =
    useState<ImageType>("signature");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onDirtyChange(Boolean(signatureBlob || sealBlob));
  }, [onDirtyChange, sealBlob, signatureBlob]);

  useEffect(() => {
    const currentSignaturePreview = signaturePreview;
    const currentSealPreview = sealPreview;

    return () => {
      if (currentSignaturePreview) {
        URL.revokeObjectURL(currentSignaturePreview);
      }
      if (currentSealPreview) {
        URL.revokeObjectURL(currentSealPreview);
      }
    };
  }, [sealPreview, signaturePreview]);

  function handleImageSelection(
    event: ChangeEvent<HTMLInputElement>,
    imageType: ImageType,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Нужно выбрать изображение PNG или JPG");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperImageSrc(reader.result as string);
      setCropperImageType(imageType);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    setError(null);
    event.target.value = "";
  }

  function handleCropComplete(croppedBlob: Blob, previewUrl: string) {
    if (cropperImageType === "signature") {
      if (signaturePreview) {
        URL.revokeObjectURL(signaturePreview);
      }
      setSignatureBlob(croppedBlob);
      setSignaturePreview(previewUrl);
      return;
    }

    if (sealPreview) {
      URL.revokeObjectURL(sealPreview);
    }
    setSealBlob(croppedBlob);
    setSealPreview(previewUrl);
  }

  function resetDrafts() {
    if (signaturePreview) {
      URL.revokeObjectURL(signaturePreview);
    }
    if (sealPreview) {
      URL.revokeObjectURL(sealPreview);
    }
    setSignatureBlob(null);
    setSealBlob(null);
    setSignaturePreview(null);
    setSealPreview(null);
    setError(null);
  }

  async function handleSave() {
    if (!signatureBlob && !sealBlob) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await uploadOrganizationWorkspaceFiles({
        organizationId: organization.id,
        signature: signatureBlob,
        seal: sealBlob,
      });
      resetDrafts();
      onSaved?.();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось загрузить файлы организации",
      );
    } finally {
      setSaving(false);
    }
  }

  const effectiveSignatureUrl = signaturePreview ?? organization.signatureUrl;
  const effectiveSealUrl = sealPreview ?? organization.sealUrl;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Подпись и печать</CardTitle>
              <p className="text-sm text-muted-foreground">
                Управление файлами организации для документов и договоров.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                disabled={saving || (!signatureBlob && !sealBlob)}
                onClick={() => {
                  void handleSave();
                }}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Сохранить файлы
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving || (!signatureBlob && !sealBlob)}
                onClick={resetDrafts}
              >
                Сбросить
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <FilePreviewCard
              title="Подпись"
              description="PNG-файл подписи используется в шаблонах документов."
              emptyLabel="Подпись ещё не загружена"
              icon={<FileSignature className="size-4" />}
              imageUrl={effectiveSignatureUrl}
              onUploadClick={() => signatureInputRef.current?.click()}
            />
            <FilePreviewCard
              title="Печать"
              description="PNG-файл печати используется в печатных формах."
              emptyLabel="Печать ещё не загружена"
              icon={<Stamp className="size-4" />}
              imageUrl={effectiveSealUrl}
              onUploadClick={() => sealInputRef.current?.click()}
            />
          </div>
        </CardContent>
      </Card>

      <input
        ref={signatureInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(event) => handleImageSelection(event, "signature")}
      />
      <input
        ref={sealInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(event) => handleImageSelection(event, "seal")}
      />
      <ImageCropper
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        imageSrc={cropperImageSrc}
        imageType={cropperImageType}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}

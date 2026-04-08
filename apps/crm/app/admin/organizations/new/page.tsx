/* eslint-disable @next/next/no-img-element */
"use client";

import type { ChangeEvent, ReactNode } from "react";
import {
  ChevronLeft,
  FileSignature,
  Loader2,
  Stamp,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PartyProfileEditor } from "@bedrock/sdk-parties-ui/components/party-profile-editor";
import {
  OrganizationGeneralEditor,
  type OrganizationGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/organization-general-editor";
import { createSeededPartyProfileBundle } from "@bedrock/sdk-parties-ui/lib/party-profile";
import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { ImageCropper, type ImageType } from "@/components/ui/image-cropper";

import {
  buildOrganizationWorkspaceHref,
  createOrganizationWorkspace,
  uploadOrganizationWorkspaceFiles,
} from "../[id]/_lib/organization-workspace-api";

import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";

const EMPTY_VALUES: OrganizationGeneralFormValues = {
  shortName: "",
  fullName: "",
  kind: "legal_entity",
  country: "",
  externalRef: "",
  description: "",
};

function FileDraftCard(props: {
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
            Выбрать
          </Button>
        </div>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);

  const [generalValues, setGeneralValues] =
    useState<OrganizationGeneralFormValues>(EMPTY_VALUES);
  const [partyProfileDraft, setPartyProfileDraft] =
    useState<PartyProfileBundleInput | null>(null);
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const [sealBlob, setSealBlob] = useState<Blob | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [sealPreview, setSealPreview] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState("");
  const [cropperImageType, setCropperImageType] =
    useState<ImageType>("signature");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partyProfileSeed = useMemo(
    () => ({
      fullName: generalValues.fullName,
      shortName: generalValues.shortName,
      countryCode: generalValues.country || null,
    }),
    [generalValues.country, generalValues.fullName, generalValues.shortName],
  );

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

  function resolvePartyProfileBundle(values: OrganizationGeneralFormValues) {
    const fallbackCountryCode = values.country.trim() || null;

    return partyProfileDraft
      ? {
          ...partyProfileDraft,
          profile: {
            ...partyProfileDraft.profile,
            fullName:
              partyProfileDraft.profile.fullName.trim() ||
              values.fullName.trim(),
            shortName:
              partyProfileDraft.profile.shortName.trim() ||
              values.shortName.trim(),
            countryCode:
              partyProfileDraft.profile.countryCode ?? fallbackCountryCode,
          },
        }
      : createSeededPartyProfileBundle({
          fullName: values.fullName.trim(),
          shortName: values.shortName.trim(),
          countryCode: fallbackCountryCode,
        });
  }

  async function handleSubmit(values: OrganizationGeneralFormValues) {
    setError(null);
    setSubmitting(true);

    try {
      const created = await createOrganizationWorkspace({
        shortName: values.shortName.trim(),
        fullName: values.fullName.trim(),
        kind: values.kind,
        country: values.country.trim() || undefined,
        externalRef: values.externalRef.trim() || undefined,
        description: values.description.trim() || undefined,
        partyProfile:
          values.kind === "legal_entity"
            ? resolvePartyProfileBundle(values)
            : undefined,
      });

      try {
        await uploadOrganizationWorkspaceFiles({
          organizationId: created.id,
          signature: signatureBlob,
          seal: sealBlob,
        });
      } catch (uploadError) {
        console.error("Organization files upload failed", uploadError);
        router.push(
          buildOrganizationWorkspaceHref({
            organizationId: created.id,
            tab: "files",
          }),
        );
        return;
      }

      router.push(
        buildOrganizationWorkspaceHref({
          organizationId: created.id,
          tab: "organization",
        }),
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось создать организацию",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button
          variant="outline"
          type="button"
          onClick={() => router.push("/admin/organizations")}
        >
          <ChevronLeft className="size-4" />
          Назад
        </Button>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Новая организация</h1>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <OrganizationGeneralEditor
        initialValues={EMPTY_VALUES}
        submitting={submitting}
        error={error}
        onValuesChange={setGeneralValues}
        onSubmit={handleSubmit}
        onShortNameChange={() => {}}
        submitLabel="Создать организацию"
        submittingLabel="Создание..."
        disableSubmitUntilDirty={false}
        showDates={false}
        title="Организация"
        description="Базовые данные организации для CRM."
      />

      {generalValues.kind === "legal_entity" ? (
        <PartyProfileEditor
          bundle={partyProfileDraft}
          seed={partyProfileSeed}
          submitting={submitting}
          error={error}
          showActions={false}
          onChange={setPartyProfileDraft}
          title="Юридическое лицо"
        />
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <div className="space-y-1">
            <CardTitle className="text-base">Файлы организации</CardTitle>
            <p className="text-sm text-muted-foreground">
              Подпись и печать можно загрузить сразу или добавить позже на
              вкладке файлов.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          <FileDraftCard
            title="Подпись"
            description="Будет загружена после создания организации."
            emptyLabel="Подпись не выбрана"
            icon={<FileSignature className="size-4" />}
            imageUrl={signaturePreview}
            onUploadClick={() => signatureInputRef.current?.click()}
          />
          <FileDraftCard
            title="Печать"
            description="Будет загружена после создания организации."
            emptyLabel="Печать не выбрана"
            icon={<Stamp className="size-4" />}
            imageUrl={sealPreview}
            onUploadClick={() => sealInputRef.current?.click()}
          />
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

      {submitting ? (
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Создание организации...
        </div>
      ) : null}
    </div>
  );
}

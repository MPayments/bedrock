/* eslint-disable @next/next/no-img-element */
"use client";

import type { ChangeEvent, ReactNode } from "react";
import {
  FileSignature,
  Loader2,
  Plus,
  Stamp,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { PartyProfileBundleInput } from "@bedrock/parties/contracts";
import {
  BilingualToolbar,
  type BilingualMode,
} from "@bedrock/sdk-parties-ui/components/bilingual-toolbar";
import {
  OrganizationGeneralEditor,
  type OrganizationGeneralEditorExternalPatch,
  type OrganizationGeneralFormValues,
} from "@bedrock/sdk-parties-ui/components/organization-general-editor";
import { PartyProfileEditor } from "@bedrock/sdk-parties-ui/components/party-profile-editor";
import { updateLocalizedTextLocale } from "@bedrock/sdk-parties-ui/lib/localized-text";
import { computePartyProfileCompleteness } from "@bedrock/sdk-parties-ui/lib/party-profile-completeness";
import {
  createSeededPartyProfileBundle,
} from "@bedrock/sdk-parties-ui/lib/party-profile";
import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import {
  EntityPageHeader,
  getEntityInitials,
} from "@/components/app/entity-page-header";
import { ImageCropper, type ImageType } from "@/components/ui/image-cropper";
import {
  applyPartyProfilePatch,
  type PartyProfileOverride,
} from "@/lib/party-profile-patch";
import { translateOrganizationToEnglish } from "@/lib/translate-party-profile";

import {
  OrganizationInputMethodCard,
  type OrganizationInputMethod,
  type OrganizationPrefillPatch,
} from "../_components/organization-input-method-card";

import {
  buildOrganizationWorkspaceHref,
  createOrganizationWorkspace,
  uploadOrganizationWorkspaceFiles,
} from "../[id]/_lib/organization-workspace-api";

const EMPTY_VALUES: OrganizationGeneralFormValues = {
  shortName: "",
  shortNameEn: "",
  fullName: "",
  fullNameEn: "",
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
  const [bilingualMode, setBilingualMode] = useState<BilingualMode>("all");
  const [inputMethod, setInputMethod] =
    useState<OrganizationInputMethod>("manual");
  const [externalPatch, setExternalPatch] =
    useState<OrganizationGeneralEditorExternalPatch | null>(null);
  const [partyProfileOverride, setPartyProfileOverride] =
    useState<PartyProfileOverride | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const organizationKind: "legal_entity" | "individual" = generalValues.kind;

  useEffect(() => {
    if (organizationKind === "individual" && inputMethod !== "manual") {
      setInputMethod("manual");
    }
  }, [organizationKind, inputMethod]);

  const partyProfileSeed = useMemo(
    () => ({
      fullName: generalValues.fullName,
      shortName: generalValues.shortName,
      countryCode: generalValues.country || null,
    }),
    [generalValues.country, generalValues.fullName, generalValues.shortName],
  );

  const completeness = useMemo(
    () =>
      computePartyProfileCompleteness(partyProfileDraft, {
        excludeProfileNames: true,
        extraPairs: [
          {
            ru: generalValues.shortName,
            en: generalValues.shortNameEn,
          },
          {
            ru: generalValues.fullName,
            en: generalValues.fullNameEn,
          },
        ],
      }).ratio,
    [partyProfileDraft, generalValues],
  );

  const partyProfileOverrideNonce = partyProfileOverride?.nonce ?? null;
  useEffect(() => {
    if (!partyProfileOverride) {
      return;
    }

    const base =
      partyProfileDraft ??
      createSeededPartyProfileBundle({
        fullName: generalValues.fullName,
        shortName: generalValues.shortName,
        countryCode: generalValues.country || null,
      });

    const next = applyPartyProfilePatch(base, partyProfileOverride.patch);
    setPartyProfileDraft(next);
    // Triggered by nonce change; dependencies intentionally narrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyProfileOverrideNonce]);

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

  const handlePrefill = useCallback((patch: OrganizationPrefillPatch) => {
    const now = Date.now();
    setExternalPatch({ nonce: now, patch: patch.general });
    setPartyProfileOverride({ nonce: now, patch: patch.profile });
  }, []);

  const handleTranslateAll = useCallback(async () => {
    setTranslating(true);
    setTranslateError(null);
    try {
      const next = await translateOrganizationToEnglish({
        bundle: partyProfileDraft,
        general: {
          shortName: generalValues.shortName,
          shortNameEn: generalValues.shortNameEn,
          fullName: generalValues.fullName,
          fullNameEn: generalValues.fullNameEn,
        },
      });
      const nonce = Date.now();
      if (next.profile) {
        setPartyProfileOverride({ nonce, patch: next.profile });
      }
      if (Object.keys(next.general).length > 0) {
        setExternalPatch({ nonce, patch: next.general });
      }
    } catch (translationError) {
      setTranslateError(
        translationError instanceof Error
          ? translationError.message
          : "Ошибка перевода полей",
      );
    } finally {
      setTranslating(false);
    }
  }, [partyProfileDraft, generalValues]);

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
    const base =
      partyProfileDraft ??
      createSeededPartyProfileBundle({
        fullName: values.fullName.trim(),
        shortName: values.shortName.trim(),
        countryCode: fallbackCountryCode,
      });

    const nextFullNameI18n = updateLocalizedTextLocale({
      baseValue: values.fullName.trim(),
      localeMap: base.profile.fullNameI18n,
      nextValue: values.fullNameEn.trim(),
      locale: "en",
    }).localeMap;
    const nextShortNameI18n = updateLocalizedTextLocale({
      baseValue: values.shortName.trim(),
      localeMap: base.profile.shortNameI18n,
      nextValue: values.shortNameEn.trim(),
      locale: "en",
    }).localeMap;

    return {
      ...base,
      profile: {
        ...base.profile,
        fullName: base.profile.fullName.trim() || values.fullName.trim(),
        shortName: base.profile.shortName.trim() || values.shortName.trim(),
        fullNameI18n: nextFullNameI18n,
        shortNameI18n: nextShortNameI18n,
        countryCode: base.profile.countryCode ?? fallbackCountryCode,
      },
    };
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

  const createHeaderTitle =
    generalValues.shortNameEn.trim() ||
    generalValues.shortName.trim() ||
    "Новая организация";
  const hasTypedName =
    generalValues.shortNameEn.trim() !== "" ||
    generalValues.shortName.trim() !== "";
  const createHeaderAvatar = hasTypedName
    ? { initials: getEntityInitials(createHeaderTitle) }
    : { icon: <Plus className="size-4" /> };
  const kindLabel =
    generalValues.kind === "legal_entity" ? "Юр. лицо" : "Физ. лицо";

  return (
    <div className="space-y-6">
      <EntityPageHeader
        avatar={createHeaderAvatar}
        title={createHeaderTitle}
        badge={{ label: "Draft", variant: "warning" }}
        infoItems={["Новая организация", kindLabel]}
      />

      <OrganizationInputMethodCard
        organizationKind={organizationKind}
        mode={inputMethod}
        onModeChange={setInputMethod}
        onPrefill={handlePrefill}
      />

      <BilingualToolbar
        value={bilingualMode}
        onChange={setBilingualMode}
        completeness={completeness}
        onTranslateAll={handleTranslateAll}
        translating={translating}
      />

      {translateError ? (
        <Alert variant="destructive">
          <AlertDescription>{translateError}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <OrganizationGeneralEditor
        initialValues={EMPTY_VALUES}
        submitting={submitting}
        error={error}
        externalPatch={externalPatch}
        bilingualMode={bilingualMode}
        onValuesChange={setGeneralValues}
        onSubmit={handleSubmit}
        onShortNameChange={() => {}}
        submitLabel="Создать"
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
          localizedTextVariant={bilingualMode}
          submitting={submitting}
          error={error}
          showActions={false}
          showLocalizedTextModeSwitcher={false}
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";

import {
  LEGAL_IDENTIFIER_SCHEME_VALUES,
  PARTY_CONTACT_TYPE_VALUES,
  PARTY_LICENSE_TYPE_VALUES,
  PARTY_REPRESENTATIVE_ROLE_VALUES,
  type PartyAddressInput,
  type PartyContactInput,
  type PartyProfileBundleInput,
  type PartyIdentifierInput,
  type PartyLicenseInput,
  type PartyRepresentativeInput,
} from "../lib/contracts";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { CountrySelect } from "@bedrock/sdk-ui/components/country-select";
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

import { LocalizedTextInputField } from "./localized-text-input-field";
import { LocalizedTextModeSwitcher } from "./localized-text-mode-switcher";
import {
  clonePartyProfileBundleInput,
  type PartyProfileBundleSource,
  toPartyProfileBundleInput,
  type PartyProfileSeed,
} from "../lib/party-profile";
import { type LocalizedTextVariant } from "../lib/localized-text";
import {
  hasPartyProfileValidationErrors,
  type PartyProfileValidationErrors,
  validatePartyProfileBundle,
} from "../lib/party-profile-validation";

type PartyProfileEditorProps = {
  bundle: PartyProfileBundleSource | PartyProfileBundleInput | null;
  description?: string;
  error?: string | null;
  // Errors supplied from outside (e.g. server Zod errors parsed via
  // parsePartyProfileZodErrorMessage). Merged with internal validation; shown
  // regardless of `showValidationErrors`.
  externalErrors?: PartyProfileValidationErrors;
  localizedTextVariant?: LocalizedTextVariant;
  onChange?: (bundle: PartyProfileBundleInput, dirty: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onLocalizedTextVariantChange?: (value: LocalizedTextVariant) => void;
  onSubmit?: (
    bundle: PartyProfileBundleInput,
  ) =>
    | Promise<PartyProfileBundleInput | PartyProfileBundleSource | void>
    | PartyProfileBundleInput
    | PartyProfileBundleSource
    | void;
  seed?: PartyProfileSeed;
  partyKind?: "individual" | "legal_entity";
  // When `true`, inline validation errors are shown next to each invalid field
  // regardless of whether the user has submitted yet. Parents that submit
  // externally (e.g. create-editor via the general form) can flip this to
  // surface errors before the network call.
  showValidationErrors?: boolean;
  showActions?: boolean;
  showIdentityFields?: boolean;
  showLocalizedTextModeSwitcher?: boolean;
  submitLabel?: string;
  submitting?: boolean;
  submittingLabel?: string;
  title?: string;
};

const LEGAL_IDENTIFIER_SCHEME_OPTIONS: {
  label: string;
  value: (typeof LEGAL_IDENTIFIER_SCHEME_VALUES)[number];
}[] = [
  { value: "registration_number", label: "Регистрационный номер" },
  { value: "tax_id", label: "Налоговый номер" },
  { value: "vat_id", label: "VAT номер" },
  { value: "inn", label: "ИНН" },
  { value: "kpp", label: "КПП" },
  { value: "ogrn", label: "ОГРН" },
  { value: "okpo", label: "ОКПО" },
  { value: "oktmo", label: "ОКТМО" },
  { value: "license_number", label: "Номер лицензии" },
  { value: "other", label: "Другое" },
];

const PARTY_CONTACT_TYPE_OPTIONS: {
  label: string;
  value: (typeof PARTY_CONTACT_TYPE_VALUES)[number];
}[] = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Телефон" },
  { value: "website", label: "Сайт" },
  { value: "fax", label: "Факс" },
  { value: "other", label: "Другое" },
];

const PARTY_REPRESENTATIVE_ROLE_OPTIONS: {
  label: string;
  value: (typeof PARTY_REPRESENTATIVE_ROLE_VALUES)[number];
}[] = [
  { value: "director", label: "Директор" },
  { value: "signatory", label: "Подписант" },
  { value: "contact", label: "Контактное лицо" },
  { value: "authorized_person", label: "Уполномоченное лицо" },
  { value: "other", label: "Другое" },
];

const PARTY_LICENSE_TYPE_OPTIONS: {
  label: string;
  value: (typeof PARTY_LICENSE_TYPE_VALUES)[number];
}[] = [
  { value: "company_license", label: "Лицензия компании" },
  { value: "broker_license", label: "Брокерская лицензия" },
  {
    value: "financial_service_license",
    label: "Лицензия на финансовые услуги",
  },
  { value: "trade_license", label: "Торговая лицензия" },
  { value: "customs_license", label: "Таможенная лицензия" },
  { value: "other", label: "Другое" },
];

function findOptionLabel(
  options: { label: string; value: string }[],
  value: string | null | undefined,
) {
  return options.find((option) => option.value === value)?.label;
}

function serializeBundleForCompare(bundle: PartyProfileBundleInput) {
  return JSON.stringify(bundle, (_key, value) =>
    value instanceof Date ? value.toISOString() : value,
  );
}

function formatDateInput(value: Date | null) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return new Date(`${trimmed}T00:00:00.000Z`);
}

function SectionCard(props: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <Card className="rounded-sm">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{props.title}</CardTitle>
            {props.description ? (
              <CardDescription>{props.description}</CardDescription>
            ) : null}
          </div>
          {props.actions}
        </div>
      </CardHeader>
      {props.children == null ? null : <CardContent>{props.children}</CardContent>}
    </Card>
  );
}

function BooleanField(props: {
  checked: boolean;
  description?: string;
  disabled?: boolean;
  label: string;
  onChange: (nextValue: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border px-3 py-3">
      <Checkbox
        checked={props.checked}
        onCheckedChange={(checked) => props.onChange(checked === true)}
        disabled={props.disabled}
      />
      <div className="space-y-1">
        <FieldLabel className="text-sm">{props.label}</FieldLabel>
        {props.description ? (
          <FieldDescription>{props.description}</FieldDescription>
        ) : null}
      </div>
    </div>
  );
}

function RowActions(props: {
  addLabel: string;
  disabled?: boolean;
  onAdd: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={props.onAdd}
      disabled={props.disabled}
    >
      <Plus className="size-4" />
      {props.addLabel}
    </Button>
  );
}

function RemoveButton(props: { disabled?: boolean; onRemove: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={props.onRemove}
      disabled={props.disabled}
    >
      <Trash2 className="size-4" />
      Удалить
    </Button>
  );
}

function emptyIdentifier(): PartyIdentifierInput {
  return {
    scheme: LEGAL_IDENTIFIER_SCHEME_VALUES[0],
    value: "",
  };
}

function getAvailableIdentifierSchemes(
  items: PartyIdentifierInput[],
  currentIndex?: number,
) {
  const currentScheme =
    currentIndex === undefined ? null : (items[currentIndex]?.scheme ?? null);
  const usedSchemes = new Set(
    items
      .filter((_, index) => index !== currentIndex)
      .map((item) => item.scheme),
  );

  return LEGAL_IDENTIFIER_SCHEME_VALUES.filter(
    (scheme) => scheme === currentScheme || !usedSchemes.has(scheme),
  );
}

function emptyAddress(): PartyAddressInput {
  return {
    countryCode: null,
    postalCode: null,
    city: null,
    cityI18n: null,
    streetAddress: null,
    streetAddressI18n: null,
    addressDetails: null,
    addressDetailsI18n: null,
    fullAddress: null,
    fullAddressI18n: null,
  };
}

function normalizeAddress(
  address: PartyAddressInput,
): PartyAddressInput | null {
  if (
    !address.countryCode &&
    !address.postalCode &&
    !address.city &&
    !address.cityI18n &&
    !address.streetAddress &&
    !address.streetAddressI18n &&
    !address.addressDetails &&
    !address.addressDetailsI18n &&
    !address.fullAddress
    && !address.fullAddressI18n
  ) {
    return null;
  }

  return address;
}

function emptyContact(): PartyContactInput {
  return {
    type: PARTY_CONTACT_TYPE_VALUES[0],
    value: "",
    isPrimary: false,
  };
}

function emptyRepresentative(): PartyRepresentativeInput {
  return {
    role: PARTY_REPRESENTATIVE_ROLE_VALUES[0],
    fullName: "",
    fullNameI18n: null,
    title: null,
    titleI18n: null,
    basisDocument: null,
    basisDocumentI18n: null,
    isPrimary: false,
  };
}

function emptyLicense(): PartyLicenseInput {
  return {
    licenseType: PARTY_LICENSE_TYPE_VALUES[0],
    licenseNumber: "",
    issuedBy: null,
    issuedByI18n: null,
    issuedAt: null,
    expiresAt: null,
    activityCode: null,
    activityText: null,
    activityTextI18n: null,
  };
}

export function PartyProfileEditor({
  bundle,
  description,
  error,
  externalErrors,
  localizedTextVariant: controlledLocalizedTextVariant,
  onChange,
  onDirtyChange,
  onLocalizedTextVariantChange,
  onSubmit,
  partyKind = "legal_entity",
  seed,
  showActions = true,
  showIdentityFields = true,
  showLocalizedTextModeSwitcher = true,
  showValidationErrors = false,
  submitLabel = "Сохранить",
  submitting = false,
  submittingLabel = "Сохранение...",
  title = partyKind === "individual" ? "Профиль контрагента" : "Профиль контрагента",
}: PartyProfileEditorProps) {
  const initialDraft = useMemo(
    () => toPartyProfileBundleInput(bundle, seed),
    [bundle, seed],
  );
  const initialDraftSerialized = useMemo(
    () => serializeBundleForCompare(initialDraft),
    [initialDraft],
  );
  const [draft, setDraft] = useState<PartyProfileBundleInput>(() =>
    clonePartyProfileBundleInput(initialDraft),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [internalLocalizedTextVariant, setInternalLocalizedTextVariant] =
    useState<LocalizedTextVariant>("ru");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Tracks the last serialization we already synchronized into `draft`. Any bundle
  // prop with this serialization is considered "already applied" and does not
  // trigger re-sync. Updated on (a) external sync and (b) own emits — so that the
  // parent echoing back our own emit does not trigger an infinite loop.
  const lastSyncedSerializedRef = useRef(initialDraftSerialized);
  // Set by the external-sync Effect so the emit-Effect running in the same
  // render skips its emit (Effect 2 still sees the pre-sync `draft` and would
  // otherwise overwrite the external change in the parent).
  const skipNextEmitRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  const availableIdentifierSchemes = useMemo(
    () => getAvailableIdentifierSchemes(draft.identifiers),
    [draft.identifiers],
  );
  const localizedTextVariant =
    controlledLocalizedTextVariant ?? internalLocalizedTextVariant;
  const handleLocalizedTextVariantChange =
    onLocalizedTextVariantChange ?? setInternalLocalizedTextVariant;

  useEffect(() => {
    if (lastSyncedSerializedRef.current === initialDraftSerialized) {
      return;
    }

    lastSyncedSerializedRef.current = initialDraftSerialized;
    skipNextEmitRef.current = true;
    setDraft(clonePartyProfileBundleInput(initialDraft));
    setLocalError(null);
  }, [initialDraft, initialDraftSerialized]);

  const isDirty = useMemo(
    () =>
      serializeBundleForCompare(draft) !==
      serializeBundleForCompare(initialDraft),
    [draft, initialDraft],
  );

  useEffect(() => {
    onDirtyChangeRef.current?.(isDirty);
  }, [isDirty]);

  useEffect(() => {
    if (skipNextEmitRef.current) {
      skipNextEmitRef.current = false;
      return;
    }
    const draftSerialized = serializeBundleForCompare(draft);
    // Record what we are about to emit so the parent echoing it back via the
    // `bundle` prop does not trigger a spurious re-sync.
    lastSyncedSerializedRef.current = draftSerialized;
    onChangeRef.current?.(clonePartyProfileBundleInput(draft), isDirty);
  }, [draft, isDirty]);

  const validationErrors = useMemo(
    () => validatePartyProfileBundle(draft),
    [draft],
  );
  const shouldShowValidationErrors = showValidationErrors || submitAttempted;
  const displayedErrors = useMemo<PartyProfileValidationErrors>(() => {
    const merged: PartyProfileValidationErrors = {};
    if (shouldShowValidationErrors) {
      for (const [key, message] of Object.entries(validationErrors)) {
        merged[key] = message;
      }
    }
    if (externalErrors) {
      for (const [key, message] of Object.entries(externalErrors)) {
        merged[key] = message;
      }
    }
    return merged;
  }, [externalErrors, shouldShowValidationErrors, validationErrors]);
  const getError = (path: string): string | undefined => displayedErrors[path];

  async function handleSubmit() {
    if (!onSubmit) {
      return;
    }

    setSubmitAttempted(true);

    if (hasPartyProfileValidationErrors(validationErrors)) {
      setLocalError("Исправьте ошибки в форме перед сохранением");
      return;
    }

    try {
      setLocalError(null);
      const nextValue = await onSubmit(clonePartyProfileBundleInput(draft));
      if (!nextValue) {
        return;
      }

      setDraft(
        clonePartyProfileBundleInput(toPartyProfileBundleInput(nextValue)),
      );
      setSubmitAttempted(false);
    } catch (submitError) {
      setLocalError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить",
      );
    }
  }

  function updateAddress(
    updater: (currentAddress: PartyAddressInput) => PartyAddressInput,
  ) {
    setDraft((current) => ({
      ...current,
      address: normalizeAddress(updater(current.address ?? emptyAddress())),
    }));
  }

  const resolvedDescription =
    description ??
    (partyKind === "individual"
      ? "Данные контрагента: имена, идентификаторы, адрес и контакты."
      : "Данные контрагента: профиль, идентификаторы, адрес, контакты, представители и лицензии.");
  const showProfileOverviewFields =
    showIdentityFields || partyKind === "legal_entity";
  const errorMessage = error ?? localError;
  const errorAlert = errorMessage ? (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {errorMessage}
    </div>
  ) : null;
  const profileActions = showActions ? (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => setDraft(clonePartyProfileBundleInput(initialDraft))}
        disabled={!isDirty || submitting}
      >
        <X className="size-4" />
        Отменить
      </Button>
      <Button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!isDirty || submitting}
      >
        {submitting ? (
          <Spinner className="size-4" />
        ) : (
          <Save className="size-4" />
        )}
        {submitting ? submittingLabel : submitLabel}
      </Button>
    </div>
  ) : null;
  const localizedFieldModeBanner = showLocalizedTextModeSwitcher ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Редактируемая версия текста</p>
        <p className="text-xs text-muted-foreground">
          Этот выбор влияет на текстовые поля ниже: названия, адреса,
          контакты и описания.
        </p>
      </div>
      <LocalizedTextModeSwitcher
        value={localizedTextVariant}
        onChange={handleLocalizedTextVariantChange}
        disabled={submitting}
      />
    </div>
  ) : null;
  const fallbackHeader =
    errorAlert || localizedFieldModeBanner || profileActions ? (
      <div className="space-y-4">
        {errorAlert}
        {localizedFieldModeBanner}
        {profileActions ? (
          <div className="flex justify-end">{profileActions}</div>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      {showProfileOverviewFields ? (
        <SectionCard
          title={title}
          description={resolvedDescription}
          actions={profileActions}
        >
          {errorAlert ? <div className="mb-4">{errorAlert}</div> : null}

          {localizedFieldModeBanner ? (
            <div className="mb-4">{localizedFieldModeBanner}</div>
          ) : null}

          <FieldSet>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              {showIdentityFields ? (
                <>
                  <LocalizedTextInputField
                    label="Полное наименование"
                    variant={localizedTextVariant}
                    value={draft.profile.fullName}
                    localeMap={draft.profile.fullNameI18n}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          fullName: value.value,
                          fullNameI18n: value.localeMap,
                        },
                      }))
                    }
                    disabled={submitting}
                  />
                  <LocalizedTextInputField
                    label="Краткое наименование"
                    variant={localizedTextVariant}
                    value={draft.profile.shortName}
                    localeMap={draft.profile.shortNameI18n}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          shortName: value.value,
                          shortNameI18n: value.localeMap,
                        },
                      }))
                    }
                    disabled={submitting}
                  />
                </>
              ) : null}
              {partyKind === "legal_entity" ? (
                <>
                  <Field>
                    <FieldLabel>Код формы</FieldLabel>
                    <Input
                      value={draft.profile.legalFormCode ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          profile: {
                            ...current.profile,
                            legalFormCode: event.target.value || null,
                          },
                        }))
                      }
                      disabled={submitting}
                    />
                  </Field>
                  <LocalizedTextInputField
                    label="Наименование формы"
                    variant={localizedTextVariant}
                    value={draft.profile.legalFormLabel ?? ""}
                    localeMap={draft.profile.legalFormLabelI18n}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          legalFormLabel: value.value || null,
                          legalFormLabelI18n: value.localeMap,
                        },
                      }))
                    }
                    disabled={submitting}
                  />
                </>
              ) : null}
              {showIdentityFields ? (
                <Field>
                  <FieldLabel>Страна</FieldLabel>
                  <CountrySelect
                    value={draft.profile.countryCode ?? ""}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          countryCode: value || null,
                        },
                      }))
                    }
                    disabled={submitting}
                    clearable
                    placeholder="Выберите страну"
                    searchPlaceholder="Поиск страны..."
                    emptyLabel="Страна не найдена"
                    clearLabel="Очистить"
                  />
                </Field>
              ) : null}
              {partyKind === "legal_entity" ? (
                <>
                  <Field>
                    <FieldLabel>Код деятельности</FieldLabel>
                    <Input
                      value={draft.profile.businessActivityCode ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          profile: {
                            ...current.profile,
                            businessActivityCode: event.target.value || null,
                          },
                        }))
                      }
                      disabled={submitting}
                    />
                  </Field>
                  <LocalizedTextInputField
                    className="md:col-span-2"
                    label="Описание деятельности"
                    variant={localizedTextVariant}
                    value={draft.profile.businessActivityText ?? ""}
                    localeMap={draft.profile.businessActivityTextI18n}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          businessActivityText: value.value || null,
                          businessActivityTextI18n: value.localeMap,
                        },
                      }))
                    }
                    multiline
                    rows={3}
                    disabled={submitting}
                  />
                </>
              ) : null}
            </FieldGroup>
          </FieldSet>
        </SectionCard>
      ) : (
        fallbackHeader
      )}

      <SectionCard
        title="Идентификаторы"
        actions={
          <RowActions
            addLabel="Добавить идентификатор"
            onAdd={() =>
              setDraft((current) => ({
                ...current,
                identifiers: [
                  ...current.identifiers,
                  {
                    ...emptyIdentifier(),
                    scheme:
                      getAvailableIdentifierSchemes(current.identifiers)[0] ??
                      LEGAL_IDENTIFIER_SCHEME_VALUES[0],
                  },
                ],
              }))
            }
            disabled={submitting || availableIdentifierSchemes.length === 0}
          />
        }
      >
        <div className="space-y-4">
          {draft.identifiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Идентификаторы пока не добавлены.
            </p>
          ) : null}
          {draft.identifiers.map((identifier, index) => (
            <div key={identifier.id ?? `${identifier.scheme}-${index}`}>
              <FieldGroup className="flex flex-row items-end justify-between">
                <Field>
                  <FieldLabel>Схема</FieldLabel>
                  <Select
                    value={identifier.scheme}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        identifiers: current.identifiers.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  scheme:
                                    value as PartyIdentifierInput["scheme"],
                                }
                              : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите схему">
                        {findOptionLabel(
                          LEGAL_IDENTIFIER_SCHEME_OPTIONS,
                          identifier.scheme,
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableIdentifierSchemes(
                        draft.identifiers,
                        index,
                      ).map((value) => (
                        <SelectItem key={value} value={value}>
                          {findOptionLabel(
                            LEGAL_IDENTIFIER_SCHEME_OPTIONS,
                            value,
                          ) ?? value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field data-invalid={Boolean(getError(`identifiers.${index}.value`))}>
                  <FieldLabel>
                    Значение
                    <span className="text-destructive"> *</span>
                  </FieldLabel>
                  <Input
                    value={identifier.value}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        identifiers: current.identifiers.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, value: event.target.value }
                              : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                    aria-invalid={Boolean(getError(`identifiers.${index}.value`))}
                  />
                  {getError(`identifiers.${index}.value`) ? (
                    <FieldError errors={[{ message: getError(`identifiers.${index}.value`)! }]} />
                  ) : null}
                </Field>

                <RemoveButton
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      identifiers: current.identifiers.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                  disabled={submitting}
                />
              </FieldGroup>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Адрес"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                address: null,
              }))
            }
            disabled={submitting || !draft.address}
          >
            <X className="size-4" />
            Очистить адрес
          </Button>
        }
      >
        {!showProfileOverviewFields && localizedFieldModeBanner ? (
          <div className="mb-4">{localizedFieldModeBanner}</div>
        ) : null}
        <FieldGroup className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel>Страна</FieldLabel>
            <CountrySelect
              value={(draft.address ?? emptyAddress()).countryCode ?? ""}
              onValueChange={(value) =>
                updateAddress((address) => ({
                  ...address,
                  countryCode: value || null,
                }))
              }
              disabled={submitting}
              clearable
              placeholder="Выберите страну"
              searchPlaceholder="Поиск страны..."
              emptyLabel="Страна не найдена"
              clearLabel="Очистить"
            />
          </Field>
          <LocalizedTextInputField
            label="Город"
            variant={localizedTextVariant}
            value={(draft.address ?? emptyAddress()).city ?? ""}
            localeMap={(draft.address ?? emptyAddress()).cityI18n}
            onChange={(value) =>
              updateAddress((address) => ({
                ...address,
                city: value.value || null,
                cityI18n: value.localeMap,
              }))
            }
            disabled={submitting}
          />
          <Field>
            <FieldLabel>Индекс</FieldLabel>
            <Input
              value={(draft.address ?? emptyAddress()).postalCode ?? ""}
              onChange={(event) =>
                updateAddress((address) => ({
                  ...address,
                  postalCode: event.target.value || null,
                }))
              }
              disabled={submitting}
            />
          </Field>
          <LocalizedTextInputField
            label="Улица и дом"
            variant={localizedTextVariant}
            value={(draft.address ?? emptyAddress()).streetAddress ?? ""}
            localeMap={(draft.address ?? emptyAddress()).streetAddressI18n}
            onChange={(value) =>
              updateAddress((address) => ({
                ...address,
                streetAddress: value.value || null,
                streetAddressI18n: value.localeMap,
              }))
            }
            disabled={submitting}
          />
          <LocalizedTextInputField
            label="Дополнение к адресу"
            variant={localizedTextVariant}
            value={(draft.address ?? emptyAddress()).addressDetails ?? ""}
            localeMap={(draft.address ?? emptyAddress()).addressDetailsI18n}
            onChange={(value) =>
              updateAddress((address) => ({
                ...address,
                addressDetails: value.value || null,
                addressDetailsI18n: value.localeMap,
              }))
            }
            disabled={submitting}
          />
          <LocalizedTextInputField
            className="md:col-span-2"
            label="Полный адрес"
            variant={localizedTextVariant}
            value={(draft.address ?? emptyAddress()).fullAddress ?? ""}
            localeMap={(draft.address ?? emptyAddress()).fullAddressI18n}
            onChange={(value) =>
              updateAddress((address) => ({
                ...address,
                fullAddress: value.value || null,
                fullAddressI18n: value.localeMap,
              }))
            }
            multiline
            rows={3}
            disabled={submitting}
          />
        </FieldGroup>
      </SectionCard>

      {partyKind === "legal_entity" ? (
        <SectionCard
          title="Представители"
          actions={
            <RowActions
              addLabel="Добавить представителя"
              onAdd={() =>
                setDraft((current) => ({
                  ...current,
                  representatives: [
                    ...current.representatives,
                    emptyRepresentative(),
                  ],
                }))
              }
              disabled={submitting}
            />
          }
        >
        <div className="space-y-4">
          {draft.representatives.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Представители пока не добавлены.
            </p>
          ) : null}
          {draft.representatives.map((representative, index) => (
            <div
              key={representative.id ?? `${representative.role}-${index}`}
              className="space-y-4 rounded-md border p-4"
            >
              <div className="flex justify-end">
                <RemoveButton
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      representatives: current.representatives.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                  disabled={submitting}
                />
              </div>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Роль</FieldLabel>
                  <Select
                    value={representative.role}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        representatives: current.representatives.map(
                          (item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  role: value as PartyRepresentativeInput["role"],
                                }
                              : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите роль">
                        {findOptionLabel(
                          PARTY_REPRESENTATIVE_ROLE_OPTIONS,
                          representative.role,
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PARTY_REPRESENTATIVE_ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <LocalizedTextInputField
                  label="ФИО"
                  variant={localizedTextVariant}
                  value={representative.fullName}
                  localeMap={representative.fullNameI18n}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      representatives: current.representatives.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                fullName: value.value,
                                fullNameI18n: value.localeMap,
                              }
                            : item,
                      ),
                    }))
                  }
                  disabled={submitting}
                  required
                  error={getError(`representatives.${index}.fullName`)}
                />
                <LocalizedTextInputField
                  label="Должность"
                  variant={localizedTextVariant}
                  value={representative.title ?? ""}
                  localeMap={representative.titleI18n}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      representatives: current.representatives.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                title: value.value || null,
                                titleI18n: value.localeMap,
                              }
                            : item,
                      ),
                    }))
                  }
                  disabled={submitting}
                />
                <LocalizedTextInputField
                  label="Основание полномочий"
                  variant={localizedTextVariant}
                  value={representative.basisDocument ?? ""}
                  localeMap={representative.basisDocumentI18n}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      representatives: current.representatives.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                basisDocument: value.value || null,
                                basisDocumentI18n: value.localeMap,
                              }
                            : item,
                      ),
                    }))
                  }
                  disabled={submitting}
                />
                <BooleanField
                  checked={representative.isPrimary}
                  onChange={(nextValue) =>
                    setDraft((current) => ({
                      ...current,
                      representatives: current.representatives.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, isPrimary: nextValue }
                            : item,
                      ),
                    }))
                  }
                  label="Основной представитель"
                  disabled={submitting}
                />
              </FieldGroup>
            </div>
          ))}
        </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Контакты"
        actions={
          <RowActions
            addLabel="Добавить контакт"
            onAdd={() =>
              setDraft((current) => ({
                ...current,
                contacts: [...current.contacts, emptyContact()],
              }))
            }
            disabled={submitting}
          />
        }
      >
        <div className="space-y-4">
          {draft.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Контакты пока не добавлены.
            </p>
          ) : null}
          {draft.contacts.map((contact, index) => (
            <div key={contact.id ?? `${contact.type}-${index}`}>
              <FieldGroup className="space-y-3">
                <div className="flex flex-row items-end justify-between gap-4">
                  <Field>
                    <FieldLabel>Тип</FieldLabel>
                    <Select
                      value={contact.type}
                      onValueChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          contacts: current.contacts.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  type: value as PartyContactInput["type"],
                                }
                              : item,
                          ),
                        }))
                      }
                      disabled={submitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип">
                          {findOptionLabel(
                            PARTY_CONTACT_TYPE_OPTIONS,
                            contact.type,
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PARTY_CONTACT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field data-invalid={Boolean(getError(`contacts.${index}.value`))}>
                    <FieldLabel>
                      Значение
                      <span className="text-destructive"> *</span>
                    </FieldLabel>
                    <Input
                      value={contact.value}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          contacts: current.contacts.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, value: event.target.value }
                              : item,
                          ),
                        }))
                      }
                      disabled={submitting}
                      aria-invalid={Boolean(getError(`contacts.${index}.value`))}
                    />
                    {getError(`contacts.${index}.value`) ? (
                      <FieldError
                        errors={[{ message: getError(`contacts.${index}.value`)! }]}
                      />
                    ) : null}
                  </Field>
                  <RemoveButton
                    onRemove={() =>
                      setDraft((current) => ({
                        ...current,
                        contacts: current.contacts.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={contact.isPrimary}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, isPrimary: checked === true }
                            : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                  <FieldLabel className="text-sm">Основной контакт</FieldLabel>
                </div>
              </FieldGroup>
            </div>
          ))}
        </div>
      </SectionCard>

      {partyKind === "legal_entity" ? (
        <SectionCard
          title="Лицензии"
          actions={
            <RowActions
              addLabel="Добавить лицензию"
              onAdd={() =>
                setDraft((current) => ({
                  ...current,
                  licenses: [...current.licenses, emptyLicense()],
                }))
              }
              disabled={submitting}
            />
          }
        >
        <div className="space-y-4">
          {draft.licenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Лицензии пока не добавлены.
            </p>
          ) : null}
          {draft.licenses.map((license, index) => (
            <div
              key={license.id ?? `${license.licenseType}-${index}`}
              className="space-y-4 rounded-md border p-4"
            >
              <div className="flex justify-end">
                <RemoveButton
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      licenses: current.licenses.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                  disabled={submitting}
                />
              </div>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Тип лицензии</FieldLabel>
                  <Select
                    value={license.licenseType}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        licenses: current.licenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                licenseType:
                                  value as PartyLicenseInput["licenseType"],
                              }
                            : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип">
                        {findOptionLabel(
                          PARTY_LICENSE_TYPE_OPTIONS,
                          license.licenseType,
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PARTY_LICENSE_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field data-invalid={Boolean(getError(`licenses.${index}.licenseNumber`))}>
                  <FieldLabel>
                    Номер лицензии
                    <span className="text-destructive"> *</span>
                  </FieldLabel>
                  <Input
                    value={license.licenseNumber}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        licenses: current.licenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, licenseNumber: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                    aria-invalid={Boolean(getError(`licenses.${index}.licenseNumber`))}
                  />
                  {getError(`licenses.${index}.licenseNumber`) ? (
                    <FieldError
                      errors={[{ message: getError(`licenses.${index}.licenseNumber`)! }]}
                    />
                  ) : null}
                </Field>
                <LocalizedTextInputField
                  label="Кем выдана"
                  variant={localizedTextVariant}
                  value={license.issuedBy ?? ""}
                  localeMap={license.issuedByI18n}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      licenses: current.licenses.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              issuedBy: value.value || null,
                              issuedByI18n: value.localeMap,
                            }
                          : item,
                      ),
                    }))
                  }
                  disabled={submitting}
                />
                <Field>
                  <FieldLabel>Выдана</FieldLabel>
                  <Input
                    type="date"
                    value={formatDateInput(license.issuedAt ?? null)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        licenses: current.licenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                issuedAt: parseDateInput(event.target.value),
                              }
                            : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Истекает</FieldLabel>
                  <Input
                    type="date"
                    value={formatDateInput(license.expiresAt ?? null)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        licenses: current.licenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                expiresAt: parseDateInput(event.target.value),
                              }
                            : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Код деятельности</FieldLabel>
                  <Input
                    value={license.activityCode ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        licenses: current.licenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                activityCode: event.target.value || null,
                              }
                            : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <LocalizedTextInputField
                  className="md:col-span-2"
                  label="Описание деятельности"
                  variant={localizedTextVariant}
                  value={license.activityText ?? ""}
                  localeMap={license.activityTextI18n}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      licenses: current.licenses.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...item,
                              activityText: value.value || null,
                              activityTextI18n: value.localeMap,
                            }
                          : item,
                      ),
                    }))
                  }
                  multiline
                  rows={3}
                  disabled={submitting}
                />
              </FieldGroup>
            </div>
          ))}
        </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

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
} from "@bedrock/parties/contracts";
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
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import { LocalizedTextInputField } from "./localized-text-input-field";
import { LocalizedTextModeSwitcher } from "./localized-text-mode-switcher";
import {
  clonePartyProfileBundleInput,
  type PartyProfileBundleSource,
  toPartyProfileBundleInput,
  type PartyProfileSeed,
} from "../lib/party-profile";
import { type LocalizedTextVariant } from "../lib/localized-text";

type PartyProfileEditorProps = {
  bundle: PartyProfileBundleSource | PartyProfileBundleInput | null;
  error?: string | null;
  onChange?: (bundle: PartyProfileBundleInput, dirty: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit?: (
    bundle: PartyProfileBundleInput,
  ) =>
    | Promise<PartyProfileBundleInput | PartyProfileBundleSource | void>
    | PartyProfileBundleInput
    | PartyProfileBundleSource
    | void;
  seed?: PartyProfileSeed;
  partyKind?: "individual" | "legal_entity";
  showActions?: boolean;
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
  children: React.ReactNode;
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
      <CardContent>{props.children}</CardContent>
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
    streetAddress: null,
    addressDetails: null,
    fullAddress: null,
  };
}

function normalizeAddress(
  address: PartyAddressInput,
): PartyAddressInput | null {
  if (
    !address.countryCode &&
    !address.postalCode &&
    !address.city &&
    !address.streetAddress &&
    !address.addressDetails &&
    !address.fullAddress
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
    issuedAt: null,
    expiresAt: null,
    activityCode: null,
    activityText: null,
  };
}

export function PartyProfileEditor({
  bundle,
  error,
  onChange,
  onDirtyChange,
  onSubmit,
  partyKind = "legal_entity",
  seed,
  showActions = true,
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
  const [localizedTextVariant, setLocalizedTextVariant] =
    useState<LocalizedTextVariant>("base");
  const lastInitialDraftSerializedRef = useRef(initialDraftSerialized);
  const availableIdentifierSchemes = useMemo(
    () => getAvailableIdentifierSchemes(draft.identifiers),
    [draft.identifiers],
  );

  useEffect(() => {
    if (lastInitialDraftSerializedRef.current === initialDraftSerialized) {
      return;
    }

    lastInitialDraftSerializedRef.current = initialDraftSerialized;
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
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onChange?.(clonePartyProfileBundleInput(draft), isDirty);
  }, [draft, isDirty, onChange]);

  async function handleSubmit() {
    if (!onSubmit) {
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

  return (
    <div className="space-y-6">
      <SectionCard
        title={title}
        description={
          partyKind === "individual"
            ? "Канонические данные контрагента: имена, идентификаторы, адрес и контакты."
            : "Канонические данные контрагента: профиль, идентификаторы, адрес, контакты, представители и лицензии."
        }
        actions={
          showActions ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setDraft(clonePartyProfileBundleInput(initialDraft))
                }
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
          ) : null
        }
      >
        {error || localError ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error ?? localError}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Режим локализуемых полей</p>
            <p className="text-xs text-muted-foreground">
              Переключает все локализуемые текстовые поля формы сразу.
            </p>
          </div>
          <LocalizedTextModeSwitcher
            value={localizedTextVariant}
            onChange={setLocalizedTextVariant}
            disabled={submitting}
          />
        </div>

        <FieldSet>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
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
                <Field className="md:col-span-2">
                  <FieldLabel>Описание деятельности</FieldLabel>
                  <Textarea
                    value={draft.profile.businessActivityText ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          businessActivityText: event.target.value || null,
                        },
                      }))
                    }
                    rows={3}
                    disabled={submitting}
                  />
                </Field>
              </>
            ) : null}
          </FieldGroup>
        </FieldSet>
      </SectionCard>

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
                <Field>
                  <FieldLabel>Значение</FieldLabel>
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
                  />
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
          <Field>
            <FieldLabel>Город</FieldLabel>
            <Input
              value={(draft.address ?? emptyAddress()).city ?? ""}
              onChange={(event) =>
                updateAddress((address) => ({
                  ...address,
                  city: event.target.value || null,
                }))
              }
              disabled={submitting}
            />
          </Field>
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
          <Field>
            <FieldLabel>Улица и дом</FieldLabel>
            <Input
              value={(draft.address ?? emptyAddress()).streetAddress ?? ""}
              onChange={(event) =>
                updateAddress((address) => ({
                  ...address,
                  streetAddress: event.target.value || null,
                }))
              }
              disabled={submitting}
            />
          </Field>
          <Field>
            <FieldLabel>Дополнение к адресу</FieldLabel>
            <Input
              value={(draft.address ?? emptyAddress()).addressDetails ?? ""}
              onChange={(event) =>
                updateAddress((address) => ({
                  ...address,
                  addressDetails: event.target.value || null,
                }))
              }
              disabled={submitting}
            />
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel>Полный адрес</FieldLabel>
            <Textarea
              value={(draft.address ?? emptyAddress()).fullAddress ?? ""}
              onChange={(event) =>
                updateAddress((address) => ({
                  ...address,
                  fullAddress: event.target.value || null,
                }))
              }
              rows={3}
              disabled={submitting}
            />
          </Field>
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
            <div
              key={contact.id ?? `${contact.type}-${index}`}
              className="space-y-4 rounded-md border p-4"
            >
              <FieldGroup>
                <div className="flex flex-row items-end gap-4 justify-between">
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
                  <Field className="">
                    <FieldLabel>Значение</FieldLabel>
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
                    />
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
                <BooleanField
                  checked={contact.isPrimary}
                  onChange={(nextValue) =>
                    setDraft((current) => ({
                      ...current,
                      contacts: current.contacts.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, isPrimary: nextValue }
                          : item,
                      ),
                    }))
                  }
                  label="Основной контакт"
                  disabled={submitting}
                />
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
                <Field>
                  <FieldLabel>Номер лицензии</FieldLabel>
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
                  />
                </Field>
                <Field>
                  <FieldLabel>Кем выдана</FieldLabel>
                  <Input
                    value={license.issuedBy ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        licenses: current.licenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, issuedBy: event.target.value || null }
                            : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
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
                <Field className="md:col-span-2">
                  <FieldLabel>Описание деятельности</FieldLabel>
                  <Textarea
                    value={license.activityText ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        licenses: current.licenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                activityText: event.target.value || null,
                              }
                            : item,
                        ),
                      }))
                    }
                    rows={3}
                    disabled={submitting}
                  />
                </Field>
              </FieldGroup>
            </div>
          ))}
        </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

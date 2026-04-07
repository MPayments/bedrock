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
  type PartyLegalEntityBundleInput,
  type PartyLegalIdentifierInput,
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
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

import {
  cloneLegalEntityBundleInput,
  type PartyLegalEntityBundleSource,
  toLegalEntityBundleInput,
  type PartyLegalEntitySeed,
} from "../lib/legal-entity";

type LocaleTextMap = Record<string, string | null> | null;

type LegalEntityBundleEditorProps = {
  bundle: PartyLegalEntityBundleSource | PartyLegalEntityBundleInput | null;
  error?: string | null;
  onChange?: (bundle: PartyLegalEntityBundleInput, dirty: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit?: (
    bundle: PartyLegalEntityBundleInput,
  ) =>
    | Promise<PartyLegalEntityBundleInput | PartyLegalEntityBundleSource | void>
    | PartyLegalEntityBundleInput
    | PartyLegalEntityBundleSource
    | void;
  seed?: PartyLegalEntitySeed;
  showActions?: boolean;
  submitLabel?: string;
  submitting?: boolean;
  submittingLabel?: string;
  title?: string;
};

type LocaleTextEntry = {
  key: string;
  value: string;
};

function serializeLocaleTextMap(value: LocaleTextMap): string {
  if (!value || Object.keys(value).length === 0) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function parseLocaleTextMap(value: string): LocaleTextMap {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(parsed)
      .map(([locale, text]) => [
        String(locale).trim(),
        text == null ? null : String(text),
      ])
      .filter((entry) => String(entry[0]).length > 0),
  );
}

function serializeBundleForCompare(bundle: PartyLegalEntityBundleInput) {
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

function LocaleTextMapField(props: {
  disabled?: boolean;
  label: string;
  onChange: (value: LocaleTextMap) => void;
  value: LocaleTextMap;
}) {
  const [text, setText] = useState(() => serializeLocaleTextMap(props.value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(serializeLocaleTextMap(props.value));
    setError(null);
  }, [props.value]);

  return (
    <Field>
      <FieldLabel>{props.label}</FieldLabel>
      <Textarea
        value={text}
        onChange={(event) => {
          const nextValue = event.target.value;
          setText(nextValue);

          try {
            props.onChange(parseLocaleTextMap(nextValue));
            setError(null);
          } catch {
            setError("Введите корректный JSON-объект вида {\"ru\":\"...\"}");
          }
        }}
        rows={4}
        disabled={props.disabled}
        placeholder='{"ru":"Русский текст","en":"English text"}'
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
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

function RemoveButton(props: {
  disabled?: boolean;
  onRemove: () => void;
}) {
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

function emptyIdentifier(): PartyLegalIdentifierInput {
  return {
    scheme: LEGAL_IDENTIFIER_SCHEME_VALUES[0],
    value: "",
  };
}

function getAvailableIdentifierSchemes(
  items: PartyLegalIdentifierInput[],
  currentIndex?: number,
) {
  const currentScheme =
    currentIndex === undefined ? null : items[currentIndex]?.scheme ?? null;
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
    label: null,
    countryCode: null,
    postalCode: null,
    city: null,
    line1: null,
    line2: null,
    rawText: null,
    isPrimary: false,
  };
}

function emptyContact(): PartyContactInput {
  return {
    type: PARTY_CONTACT_TYPE_VALUES[0],
    label: null,
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

export function LegalEntityBundleEditor({
  bundle,
  error,
  onChange,
  onDirtyChange,
  onSubmit,
  seed,
  showActions = true,
  submitLabel = "Сохранить мастер-данные",
  submitting = false,
  submittingLabel = "Сохранение...",
  title = "Юридическое лицо",
}: LegalEntityBundleEditorProps) {
  const initialDraft = useMemo(
    () => toLegalEntityBundleInput(bundle, seed),
    [bundle, seed],
  );
  const initialDraftSerialized = useMemo(
    () => serializeBundleForCompare(initialDraft),
    [initialDraft],
  );
  const [draft, setDraft] = useState<PartyLegalEntityBundleInput>(() =>
    cloneLegalEntityBundleInput(initialDraft),
  );
  const [localError, setLocalError] = useState<string | null>(null);
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
    setDraft(cloneLegalEntityBundleInput(initialDraft));
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
    onChange?.(cloneLegalEntityBundleInput(draft), isDirty);
  }, [draft, isDirty, onChange]);

  async function handleSubmit() {
    if (!onSubmit) {
      return;
    }

    try {
      setLocalError(null);
      const nextValue = await onSubmit(cloneLegalEntityBundleInput(draft));
      if (!nextValue) {
        return;
      }

      setDraft(cloneLegalEntityBundleInput(toLegalEntityBundleInput(nextValue)));
    } catch (submitError) {
      setLocalError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить мастер-данные",
      );
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title={title}
        description="Канонические юридические данные, идентификаторы, адреса, контакты, представители и лицензии."
        actions={
          showActions ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(cloneLegalEntityBundleInput(initialDraft))}
              disabled={!isDirty || submitting}
            >
              <X className="size-4" />
              Отменить
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={!isDirty || submitting}>
              {submitting ? <Spinner className="size-4" /> : <Save className="size-4" />}
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

        <FieldSet>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>Полное наименование</FieldLabel>
              <Input
                value={draft.profile.fullName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    profile: { ...current.profile, fullName: event.target.value },
                  }))
                }
                disabled={submitting}
              />
            </Field>
            <Field>
              <FieldLabel>Краткое наименование</FieldLabel>
              <Input
                value={draft.profile.shortName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    profile: { ...current.profile, shortName: event.target.value },
                  }))
                }
                disabled={submitting}
              />
            </Field>
            <LocaleTextMapField
              label="Полное наименование (I18N JSON)"
              value={draft.profile.fullNameI18n}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  profile: { ...current.profile, fullNameI18n: value },
                }))
              }
              disabled={submitting}
            />
            <LocaleTextMapField
              label="Краткое наименование (I18N JSON)"
              value={draft.profile.shortNameI18n}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  profile: { ...current.profile, shortNameI18n: value },
                }))
              }
              disabled={submitting}
            />
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
            <Field>
              <FieldLabel>Наименование формы</FieldLabel>
              <Input
                value={draft.profile.legalFormLabel ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    profile: {
                      ...current.profile,
                      legalFormLabel: event.target.value || null,
                    },
                  }))
                }
                disabled={submitting}
              />
            </Field>
            <LocaleTextMapField
              label="Наименование формы (I18N JSON)"
              value={draft.profile.legalFormLabelI18n}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  profile: { ...current.profile, legalFormLabelI18n: value },
                }))
              }
              disabled={submitting}
            />
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
            <p className="text-sm text-muted-foreground">Идентификаторы пока не добавлены.</p>
          ) : null}
          {draft.identifiers.map((identifier, index) => (
            <div
              key={identifier.id ?? `${identifier.scheme}-${index}`}
              className="space-y-4 rounded-md border p-4"
            >
              <div className="flex justify-end">
                <RemoveButton
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      identifiers: current.identifiers.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                  disabled={submitting}
                />
              </div>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Схема</FieldLabel>
                  <Select
                    value={identifier.scheme}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        identifiers: current.identifiers.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, scheme: value as PartyLegalIdentifierInput["scheme"] } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите схему" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableIdentifierSchemes(draft.identifiers, index).map(
                        (value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                        ),
                      )}
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
                        identifiers: current.identifiers.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, value: event.target.value } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
              </FieldGroup>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Адреса"
        actions={
          <RowActions
            addLabel="Добавить адрес"
            onAdd={() =>
              setDraft((current) => ({
                ...current,
                addresses: [...current.addresses, emptyAddress()],
              }))
            }
            disabled={submitting}
          />
        }
      >
        <div className="space-y-4">
          {draft.addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Адреса пока не добавлены.</p>
          ) : null}
          {draft.addresses.map((address, index) => (
            <div key={address.id ?? `address-${index}`} className="space-y-4 rounded-md border p-4">
              <div className="flex justify-end">
                <RemoveButton
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      addresses: current.addresses.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                  disabled={submitting}
                />
              </div>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Label</FieldLabel>
                  <Input
                    value={address.label ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        addresses: current.addresses.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: event.target.value || null } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Страна</FieldLabel>
                  <CountrySelect
                    value={address.countryCode ?? ""}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        addresses: current.addresses.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, countryCode: value || null } : item,
                        ),
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
                    value={address.city ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        addresses: current.addresses.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, city: event.target.value || null } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Индекс</FieldLabel>
                  <Input
                    value={address.postalCode ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        addresses: current.addresses.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, postalCode: event.target.value || null }
                            : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Line 1</FieldLabel>
                  <Input
                    value={address.line1 ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        addresses: current.addresses.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, line1: event.target.value || null } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Line 2</FieldLabel>
                  <Input
                    value={address.line2 ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        addresses: current.addresses.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, line2: event.target.value || null } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Raw text</FieldLabel>
                  <Textarea
                    value={address.rawText ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        addresses: current.addresses.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, rawText: event.target.value || null } : item,
                        ),
                      }))
                    }
                    rows={3}
                    disabled={submitting}
                  />
                </Field>
                <BooleanField
                  checked={address.isPrimary}
                  onChange={(nextValue) =>
                    setDraft((current) => ({
                      ...current,
                      addresses: current.addresses.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, isPrimary: nextValue } : item,
                      ),
                    }))
                  }
                  label="Основной адрес"
                  disabled={submitting}
                />
              </FieldGroup>
            </div>
          ))}
        </div>
      </SectionCard>

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
            <p className="text-sm text-muted-foreground">Контакты пока не добавлены.</p>
          ) : null}
          {draft.contacts.map((contact, index) => (
            <div key={contact.id ?? `${contact.type}-${index}`} className="space-y-4 rounded-md border p-4">
              <div className="flex justify-end">
                <RemoveButton
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      contacts: current.contacts.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                  disabled={submitting}
                />
              </div>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Тип</FieldLabel>
                  <Select
                    value={contact.type}
                    onValueChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, type: value as PartyContactInput["type"] } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTY_CONTACT_TYPE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Label</FieldLabel>
                  <Input
                    value={contact.label ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: event.target.value || null } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Значение</FieldLabel>
                  <Input
                    value={contact.value}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, value: event.target.value } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <BooleanField
                  checked={contact.isPrimary}
                  onChange={(nextValue) =>
                    setDraft((current) => ({
                      ...current,
                      contacts: current.contacts.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, isPrimary: nextValue } : item,
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

      <SectionCard
        title="Представители"
        actions={
          <RowActions
            addLabel="Добавить представителя"
            onAdd={() =>
              setDraft((current) => ({
                ...current,
                representatives: [...current.representatives, emptyRepresentative()],
              }))
            }
            disabled={submitting}
          />
        }
      >
        <div className="space-y-4">
          {draft.representatives.length === 0 ? (
            <p className="text-sm text-muted-foreground">Представители пока не добавлены.</p>
          ) : null}
          {draft.representatives.map((representative, index) => (
            <div key={representative.id ?? `${representative.role}-${index}`} className="space-y-4 rounded-md border p-4">
              <div className="flex justify-end">
                <RemoveButton
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      representatives: current.representatives.filter((_, itemIndex) => itemIndex !== index),
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
                        representatives: current.representatives.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, role: value as PartyRepresentativeInput["role"] }
                            : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTY_REPRESENTATIVE_ROLE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>ФИО</FieldLabel>
                  <Input
                    value={representative.fullName}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        representatives: current.representatives.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, fullName: event.target.value } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <LocaleTextMapField
                  label="ФИО (I18N JSON)"
                  value={representative.fullNameI18n}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      representatives: current.representatives.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, fullNameI18n: value } : item,
                      ),
                    }))
                  }
                  disabled={submitting}
                />
                <Field>
                  <FieldLabel>Должность</FieldLabel>
                  <Input
                    value={representative.title ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        representatives: current.representatives.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: event.target.value || null } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <LocaleTextMapField
                  label="Должность (I18N JSON)"
                  value={representative.titleI18n}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      representatives: current.representatives.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, titleI18n: value } : item,
                      ),
                    }))
                  }
                  disabled={submitting}
                />
                <Field>
                  <FieldLabel>Основание полномочий</FieldLabel>
                  <Input
                    value={representative.basisDocument ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        representatives: current.representatives.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, basisDocument: event.target.value || null }
                            : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <LocaleTextMapField
                  label="Основание полномочий (I18N JSON)"
                  value={representative.basisDocumentI18n}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      representatives: current.representatives.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, basisDocumentI18n: value } : item,
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
                      representatives: current.representatives.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, isPrimary: nextValue } : item,
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
            <p className="text-sm text-muted-foreground">Лицензии пока не добавлены.</p>
          ) : null}
          {draft.licenses.map((license, index) => (
            <div key={license.id ?? `${license.licenseType}-${index}`} className="space-y-4 rounded-md border p-4">
              <div className="flex justify-end">
                <RemoveButton
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      licenses: current.licenses.filter((_, itemIndex) => itemIndex !== index),
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
                          itemIndex === index ? { ...item, licenseType: value as PartyLicenseInput["licenseType"] } : item,
                        ),
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                    <SelectContent>
                      {PARTY_LICENSE_TYPE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
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
                          itemIndex === index ? { ...item, licenseNumber: event.target.value } : item,
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
                          itemIndex === index ? { ...item, issuedBy: event.target.value || null } : item,
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
                          itemIndex === index ? { ...item, issuedAt: parseDateInput(event.target.value) } : item,
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
                          itemIndex === index ? { ...item, expiresAt: parseDateInput(event.target.value) } : item,
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
                          itemIndex === index ? { ...item, activityCode: event.target.value || null } : item,
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
                          itemIndex === index ? { ...item, activityText: event.target.value || null } : item,
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
    </div>
  );
}

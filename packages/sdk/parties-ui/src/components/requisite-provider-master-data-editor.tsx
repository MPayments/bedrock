"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";

import type {
  RequisiteProviderBranchIdentifierInput,
  RequisiteProviderBranchInput,
  RequisiteProviderIdentifierInput,
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
  cloneRequisiteProviderMasterDataInput,
  type RequisiteProviderMasterDataSource,
  toRequisiteProviderMasterDataInput,
  type RequisiteProviderMasterDataInput,
} from "../lib/requisite-provider-master-data";
import { type LocalizedTextVariant } from "../lib/localized-text";
import {
  REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_LABELS,
  REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_OPTIONS,
  REQUISITE_PROVIDER_IDENTIFIER_SCHEME_LABELS,
  REQUISITE_PROVIDER_IDENTIFIER_SCHEME_OPTIONS,
} from "../lib/requisite-provider-identifier-schemes";

type RequisiteProviderMasterDataEditorProps = {
  error?: string | null;
  onSubmit?: (
    input: RequisiteProviderMasterDataInput,
  ) =>
    | Promise<
        | RequisiteProviderMasterDataInput
        | RequisiteProviderMasterDataSource
        | void
      >
    | RequisiteProviderMasterDataInput
    | RequisiteProviderMasterDataSource
    | void;
  provider: RequisiteProviderMasterDataSource;
  submitLabel?: string;
  submitting?: boolean;
  submittingLabel?: string;
};

const PROVIDER_KIND_OPTIONS = [
  { value: "bank", label: "Банк" },
  { value: "blockchain", label: "Блокчейн" },
  { value: "exchange", label: "Биржа" },
  { value: "custodian", label: "Кастодиан" },
] as const;

type ItemUpdater<T> = (item: T) => T;

function serializeProviderForCompare(input: RequisiteProviderMasterDataInput) {
  return JSON.stringify(input);
}

function updateItemAtIndex<T>(
  items: T[],
  index: number,
  updater: ItemUpdater<T>,
) {
  return items.map((item, itemIndex) =>
    itemIndex === index ? updater(item) : item,
  );
}

function findOptionLabel(
  options: readonly { label: string; value: string }[],
  value: string | null | undefined,
) {
  return options.find((option) => option.value === value)?.label;
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

function emptyIdentifier(): RequisiteProviderIdentifierInput {
  return {
    scheme: "swift",
    value: "",
    isPrimary: true,
  };
}

function emptyBranchIdentifier(): RequisiteProviderBranchIdentifierInput {
  return {
    scheme: "swift",
    value: "",
    isPrimary: false,
  };
}

function emptyBranch(): RequisiteProviderBranchInput {
  return {
    code: null,
    name: "",
    nameI18n: null,
    country: null,
    postalCode: null,
    city: null,
    cityI18n: null,
    line1: null,
    line1I18n: null,
    line2: null,
    line2I18n: null,
    rawAddress: null,
    rawAddressI18n: null,
    contactEmail: null,
    contactPhone: null,
    isPrimary: false,
    identifiers: [],
  };
}

function getNextScheme<TScheme extends string>(
  options: readonly { value: TScheme }[],
  usedSchemes: readonly TScheme[],
) {
  return (
    options.find((option) => !usedSchemes.includes(option.value))?.value ??
    options[0]?.value
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

export function RequisiteProviderMasterDataEditor({
  error,
  onSubmit,
  provider,
  submitLabel = "Сохранить",
  submitting = false,
  submittingLabel = "Сохранение...",
}: RequisiteProviderMasterDataEditorProps) {
  const initialDraft = useMemo(
    () => toRequisiteProviderMasterDataInput(provider),
    [provider],
  );
  const [draft, setDraft] = useState<RequisiteProviderMasterDataInput>(() =>
    cloneRequisiteProviderMasterDataInput(initialDraft),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [localizedTextVariant, setLocalizedTextVariant] =
    useState<LocalizedTextVariant>("base");

  useEffect(() => {
    setDraft(cloneRequisiteProviderMasterDataInput(initialDraft));
    setLocalError(null);
  }, [initialDraft]);

  const isDirty = useMemo(
    () =>
      serializeProviderForCompare(draft) !==
      serializeProviderForCompare(initialDraft),
    [draft, initialDraft],
  );

  function updateIdentifier(
    index: number,
    updater: ItemUpdater<RequisiteProviderIdentifierInput>,
  ) {
    setDraft((current) => ({
      ...current,
      identifiers: updateItemAtIndex(current.identifiers, index, updater),
    }));
  }

  function updateBranch(
    index: number,
    updater: ItemUpdater<RequisiteProviderBranchInput>,
  ) {
    setDraft((current) => ({
      ...current,
      branches: updateItemAtIndex(current.branches, index, updater),
    }));
  }

  function updateBranchIdentifier(
    branchIndex: number,
    identifierIndex: number,
    updater: ItemUpdater<RequisiteProviderBranchIdentifierInput>,
  ) {
    updateBranch(branchIndex, (branch) => ({
      ...branch,
      identifiers: updateItemAtIndex(
        branch.identifiers,
        identifierIndex,
        updater,
      ),
    }));
  }

  function getProviderIdentifierSchemeOptions(currentIndex: number) {
    const usedSchemes = draft.identifiers
      .filter((_, index) => index !== currentIndex)
      .map((identifier) => identifier.scheme);

    return REQUISITE_PROVIDER_IDENTIFIER_SCHEME_OPTIONS.filter(
      (option) => !usedSchemes.includes(option.value),
    );
  }

  function getBranchIdentifierSchemeOptions(
    branchIndex: number,
    identifierIndex: number,
  ) {
    const usedSchemes = draft.branches[branchIndex]?.identifiers
      .filter((_, index) => index !== identifierIndex)
      .map((identifier) => identifier.scheme) ?? [];

    return REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_OPTIONS.filter(
      (option) => !usedSchemes.includes(option.value),
    );
  }

  async function handleSubmit() {
    if (!onSubmit) {
      return;
    }

    try {
      setLocalError(null);
      const nextValue = await onSubmit(
        cloneRequisiteProviderMasterDataInput(draft),
      );
      if (!nextValue) {
        return;
      }

      const nextDraft =
        "branches" in nextValue &&
        "identifiers" in nextValue &&
        "displayName" in nextValue
          ? toRequisiteProviderMasterDataInput(nextValue)
          : nextValue;
      setDraft(cloneRequisiteProviderMasterDataInput(nextDraft));
    } catch (submitError) {
      setLocalError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить провайдера",
      );
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Провайдер реквизитов"
        description="Редактор института, идентификаторов и филиалов."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setDraft(cloneRequisiteProviderMasterDataInput(initialDraft))
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
        }
      >
        {error || localError ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error ?? localError}
          </div>
        ) : null}
        <FieldSet>
          <div className="mb-4 flex justify-end">
            <LocalizedTextModeSwitcher
              value={localizedTextVariant}
              onChange={setLocalizedTextVariant}
              disabled={submitting}
            />
          </div>
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>Вид</FieldLabel>
              <Select
                value={draft.kind}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    kind: value as RequisiteProviderMasterDataInput["kind"],
                  }))
                }
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите вид">
                    {findOptionLabel(PROVIDER_KIND_OPTIONS, draft.kind)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_KIND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <LocalizedTextInputField
              label="Юридическое название"
              value={draft.legalName}
              localeMap={draft.legalNameI18n}
              variant={localizedTextVariant}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  legalName: value.value,
                  legalNameI18n: value.localeMap,
                }))
              }
              disabled={submitting}
            />
            <LocalizedTextInputField
              label="Отображаемое название"
              value={draft.displayName}
              localeMap={draft.displayNameI18n}
              variant={localizedTextVariant}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  displayName: value.value,
                  displayNameI18n: value.localeMap,
                }))
              }
              disabled={submitting}
            />
            <Field>
              <FieldLabel>Страна</FieldLabel>
              <CountrySelect
                value={draft.country ?? ""}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    country: value || null,
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
              <FieldLabel>Website</FieldLabel>
              <Input
                value={draft.website ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    website: event.target.value || null,
                  }))
                }
                disabled={submitting}
              />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel>Описание</FieldLabel>
              <Textarea
                value={draft.description ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value || null,
                  }))
                }
                rows={4}
                disabled={submitting}
              />
            </Field>
          </FieldGroup>
        </FieldSet>
      </SectionCard>

      <SectionCard
        title="Идентификаторы института"
        actions={
          <RowActions
            addLabel="Добавить идентификатор"
            onAdd={() =>
              setDraft((current) => {
                const nextScheme = getNextScheme(
                  REQUISITE_PROVIDER_IDENTIFIER_SCHEME_OPTIONS,
                  current.identifiers.map((identifier) => identifier.scheme),
                );

                if (!nextScheme) {
                  return current;
                }

                return {
                  ...current,
                  identifiers: [
                    ...current.identifiers,
                    {
                      ...emptyIdentifier(),
                      scheme: nextScheme,
                    },
                  ],
                };
              })
            }
            disabled={
              submitting ||
              draft.identifiers.length >=
                REQUISITE_PROVIDER_IDENTIFIER_SCHEME_OPTIONS.length
            }
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
                      updateIdentifier(index, (item) => ({
                        ...item,
                        scheme: value as RequisiteProviderIdentifierInput["scheme"],
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите схему">
                        {findOptionLabel(
                          REQUISITE_PROVIDER_IDENTIFIER_SCHEME_OPTIONS,
                          identifier.scheme,
                        ) ??
                          REQUISITE_PROVIDER_IDENTIFIER_SCHEME_LABELS[
                            identifier.scheme
                          ]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {getProviderIdentifierSchemeOptions(index).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
                      updateIdentifier(index, (item) => ({
                        ...item,
                        value: event.target.value,
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
        title="Филиалы"
        actions={
          <RowActions
            addLabel="Добавить филиал"
            onAdd={() =>
              setDraft((current) => ({
                ...current,
                branches: [...current.branches, emptyBranch()],
              }))
            }
            disabled={submitting}
          />
        }
      >
        <div className="space-y-4">
          {draft.branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Филиалы пока не добавлены.
            </p>
          ) : null}
          {draft.branches.map((branch, index) => (
            <div
              key={branch.id ?? `${branch.name}-${index}`}
              className="space-y-4 rounded-md border p-4"
            >
              <div className="flex justify-end">
                <RemoveButton
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      branches: current.branches.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                  disabled={submitting}
                />
              </div>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <LocalizedTextInputField
                  label="Название филиала"
                  value={branch.name}
                  localeMap={branch.nameI18n}
                  variant={localizedTextVariant}
                  onChange={(value) =>
                    updateBranch(index, (item) => ({
                      ...item,
                      name: value.value,
                      nameI18n: value.localeMap,
                    }))
                  }
                  disabled={submitting}
                />
                <Field>
                  <FieldLabel>Код филиала</FieldLabel>
                  <Input
                    value={branch.code ?? ""}
                    onChange={(event) =>
                      updateBranch(index, (item) => ({
                        ...item,
                        code: event.target.value || null,
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Страна</FieldLabel>
                  <CountrySelect
                    value={branch.country ?? ""}
                    onValueChange={(value) =>
                      updateBranch(index, (item) => ({
                        ...item,
                        country: value || null,
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
                  value={branch.city ?? ""}
                  localeMap={branch.cityI18n}
                  variant={localizedTextVariant}
                  onChange={(value) =>
                    updateBranch(index, (item) => ({
                      ...item,
                      city: value.value || null,
                      cityI18n: value.localeMap,
                    }))
                  }
                  disabled={submitting}
                />
                <Field>
                  <FieldLabel>Индекс</FieldLabel>
                  <Input
                    value={branch.postalCode ?? ""}
                    onChange={(event) =>
                      updateBranch(index, (item) => ({
                        ...item,
                        postalCode: event.target.value || null,
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <LocalizedTextInputField
                  label="Адрес, строка 1"
                  value={branch.line1 ?? ""}
                  localeMap={branch.line1I18n}
                  variant={localizedTextVariant}
                  onChange={(value) =>
                    updateBranch(index, (item) => ({
                      ...item,
                      line1: value.value || null,
                      line1I18n: value.localeMap,
                    }))
                  }
                  disabled={submitting}
                />
                <LocalizedTextInputField
                  label="Адрес, строка 2"
                  value={branch.line2 ?? ""}
                  localeMap={branch.line2I18n}
                  variant={localizedTextVariant}
                  onChange={(value) =>
                    updateBranch(index, (item) => ({
                      ...item,
                      line2: value.value || null,
                      line2I18n: value.localeMap,
                    }))
                  }
                  disabled={submitting}
                />
                <LocalizedTextInputField
                  className="md:col-span-2"
                  label="Полный адрес"
                  value={branch.rawAddress ?? ""}
                  localeMap={branch.rawAddressI18n}
                  variant={localizedTextVariant}
                  onChange={(value) =>
                    updateBranch(index, (item) => ({
                      ...item,
                      rawAddress: value.value || null,
                      rawAddressI18n: value.localeMap,
                    }))
                  }
                  multiline
                  rows={3}
                  disabled={submitting}
                />
                <Field>
                  <FieldLabel>Contact email</FieldLabel>
                  <Input
                    value={branch.contactEmail ?? ""}
                    onChange={(event) =>
                      updateBranch(index, (item) => ({
                        ...item,
                        contactEmail: event.target.value || null,
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Contact phone</FieldLabel>
                  <Input
                    value={branch.contactPhone ?? ""}
                    onChange={(event) =>
                      updateBranch(index, (item) => ({
                        ...item,
                        contactPhone: event.target.value || null,
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <BooleanField
                  checked={branch.isPrimary}
                  onChange={(nextValue) =>
                    updateBranch(index, (item) => ({
                      ...item,
                      isPrimary: nextValue,
                    }))
                  }
                  label="Основной филиал"
                  disabled={submitting}
                />
              </FieldGroup>

              <div className="space-y-4 rounded-md border border-dashed p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium">
                      Идентификаторы филиала
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      SWIFT, код филиала банка и другие идентификаторы филиала.
                    </p>
                  </div>
                  <RowActions
                    addLabel="Добавить"
                    onAdd={() =>
                      updateBranch(index, (item) => {
                        const nextScheme = getNextScheme(
                          REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_OPTIONS,
                          item.identifiers.map((identifier) => identifier.scheme),
                        );

                        if (!nextScheme) {
                          return item;
                        }

                        return {
                          ...item,
                          identifiers: [
                            ...item.identifiers,
                            {
                              ...emptyBranchIdentifier(),
                              scheme: nextScheme,
                            },
                          ],
                        };
                      })
                    }
                    disabled={
                      submitting ||
                      branch.identifiers.length >=
                        REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_OPTIONS.length
                    }
                  />
                </div>
                {branch.identifiers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Идентификаторы филиала пока не добавлены.
                  </p>
                ) : null}
                {branch.identifiers.map((identifier, identifierIndex) => (
                  <div
                    key={
                      identifier.id ?? `${identifier.scheme}-${identifierIndex}`
                    }
                    className="space-y-4 rounded-md border p-4"
                  >
                    <div className="flex justify-end">
                      <RemoveButton
                        onRemove={() =>
                          updateBranch(index, (item) => ({
                            ...item,
                            identifiers: item.identifiers.filter(
                              (_, itemIdentifierIndex) =>
                                itemIdentifierIndex !== identifierIndex,
                            ),
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
                            updateBranchIdentifier(
                              index,
                              identifierIndex,
                              (branchIdentifier) => ({
                                ...branchIdentifier,
                                scheme:
                                  value as RequisiteProviderBranchIdentifierInput["scheme"],
                              }),
                            )
                          }
                          disabled={submitting}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите схему">
                              {findOptionLabel(
                                REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_OPTIONS,
                                identifier.scheme,
                              ) ??
                                REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_LABELS[
                                  identifier.scheme
                                ]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {getBranchIdentifierSchemeOptions(
                              index,
                              identifierIndex,
                            ).map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
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
                            updateBranchIdentifier(
                              index,
                              identifierIndex,
                              (branchIdentifier) => ({
                                ...branchIdentifier,
                                value: event.target.value,
                              }),
                            )
                          }
                          disabled={submitting}
                        />
                      </Field>
                      <BooleanField
                        checked={identifier.isPrimary}
                        onChange={(nextValue) =>
                          updateBranchIdentifier(
                            index,
                            identifierIndex,
                            (branchIdentifier) => ({
                              ...branchIdentifier,
                              isPrimary: nextValue,
                            }),
                          )
                        }
                        label="Основной идентификатор филиала"
                        disabled={submitting}
                      />
                    </FieldGroup>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

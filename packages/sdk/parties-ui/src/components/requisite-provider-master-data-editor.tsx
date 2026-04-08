"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";

import type {
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

import {
  cloneRequisiteProviderMasterDataInput,
  type RequisiteProviderMasterDataSource,
  toRequisiteProviderMasterDataInput,
  type RequisiteProviderMasterDataInput,
} from "../lib/requisite-provider-master-data";

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
    isPrimary: false,
  };
}

function emptyBranch(): RequisiteProviderBranchInput {
  return {
    code: null,
    name: "",
    country: null,
    postalCode: null,
    city: null,
    line1: null,
    line2: null,
    rawAddress: null,
    contactEmail: null,
    contactPhone: null,
    isPrimary: false,
    identifiers: [],
  };
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
  submitLabel = "Сохранить провайдера",
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
    updater: ItemUpdater<RequisiteProviderIdentifierInput>,
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
        description="Канонический редактор института, идентификаторов и филиалов."
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
                  <SelectValue placeholder="Выберите вид" />
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
            <Field>
              <FieldLabel>Юридическое название</FieldLabel>
              <Input
                value={draft.legalName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    legalName: event.target.value,
                  }))
                }
                disabled={submitting}
              />
            </Field>
            <Field>
              <FieldLabel>Display name</FieldLabel>
              <Input
                value={draft.displayName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                disabled={submitting}
              />
            </Field>
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
              setDraft((current) => ({
                ...current,
                identifiers: [...current.identifiers, emptyIdentifier()],
              }))
            }
            disabled={submitting}
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
            <div
              key={identifier.id ?? `${identifier.scheme}-${index}`}
              className="space-y-4 rounded-md border p-4"
            >
              <div className="flex justify-end">
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
              </div>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel>Схема</FieldLabel>
                  <Input
                    value={identifier.scheme}
                    onChange={(event) =>
                      updateIdentifier(index, (item) => ({
                        ...item,
                        scheme: event.target.value,
                      }))
                    }
                    disabled={submitting}
                  />
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
                <BooleanField
                  checked={identifier.isPrimary}
                  onChange={(nextValue) =>
                    updateIdentifier(index, (item) => ({
                      ...item,
                      isPrimary: nextValue,
                    }))
                  }
                  label="Основной идентификатор"
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
                <Field>
                  <FieldLabel>Название филиала</FieldLabel>
                  <Input
                    value={branch.name}
                    onChange={(event) =>
                      updateBranch(index, (item) => ({
                        ...item,
                        name: event.target.value,
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
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
                <Field>
                  <FieldLabel>Город</FieldLabel>
                  <Input
                    value={branch.city ?? ""}
                    onChange={(event) =>
                      updateBranch(index, (item) => ({
                        ...item,
                        city: event.target.value || null,
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
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
                <Field>
                  <FieldLabel>Line 1</FieldLabel>
                  <Input
                    value={branch.line1 ?? ""}
                    onChange={(event) =>
                      updateBranch(index, (item) => ({
                        ...item,
                        line1: event.target.value || null,
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Line 2</FieldLabel>
                  <Input
                    value={branch.line2 ?? ""}
                    onChange={(event) =>
                      updateBranch(index, (item) => ({
                        ...item,
                        line2: event.target.value || null,
                      }))
                    }
                    disabled={submitting}
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Raw address</FieldLabel>
                  <Textarea
                    value={branch.rawAddress ?? ""}
                    onChange={(event) =>
                      updateBranch(index, (item) => ({
                        ...item,
                        rawAddress: event.target.value || null,
                      }))
                    }
                    rows={3}
                    disabled={submitting}
                  />
                </Field>
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
                      SWIFT, branch code и другие branch-owned идентификаторы.
                    </p>
                  </div>
                  <RowActions
                    addLabel="Добавить"
                    onAdd={() =>
                      updateBranch(index, (item) => ({
                        ...item,
                        identifiers: [...item.identifiers, emptyIdentifier()],
                      }))
                    }
                    disabled={submitting}
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
                        <Input
                          value={identifier.scheme}
                          onChange={(event) =>
                            updateBranchIdentifier(
                              index,
                              identifierIndex,
                              (branchIdentifier) => ({
                                ...branchIdentifier,
                                scheme: event.target.value,
                              }),
                            )
                          }
                          disabled={submitting}
                        />
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

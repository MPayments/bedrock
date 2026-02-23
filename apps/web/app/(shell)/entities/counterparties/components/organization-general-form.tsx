"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronRight, Save, X } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/ui/components/card";
import {
  FieldLabel,
  FieldGroup,
  FieldSet,
  Field,
  FieldDescription,
  FieldError,
  FieldSeparator,
} from "@bedrock/ui/components/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@bedrock/ui/components/select";
import { Checkbox } from "@bedrock/ui/components/checkbox";
import { Input } from "@bedrock/ui/components/input";
import { Textarea } from "@bedrock/ui/components/textarea";
import { Button } from "@bedrock/ui/components/button";
import { Spinner } from "@bedrock/ui/components/spinner";

import type { CounterpartyGroupOption } from "../lib/queries";
import { localizeCounterpartyGroupLabel } from "../lib/group-label";
import { formatDate } from "@/lib/format";

export type CounterpartyGeneralFormValues = {
  shortName: string;
  fullName: string;
  kind: "legal_entity" | "individual";
  country: string;
  externalId: string;
  description: string;
  // Derived from selected customer-scoped groups; no manual input in UI.
  customerId: string;
  groupIds: string[];
};

type CounterpartyGeneralFormSubmit =
  | Promise<CounterpartyGeneralFormValues | void>
  | CounterpartyGeneralFormValues
  | void;

type CounterpartyGeneralFormProps = {
  initialValues?: Partial<CounterpartyGeneralFormValues>;
  groupOptions: CounterpartyGroupOption[];
  submitting?: boolean;
  error?: string | null;
  onSubmit?: (
    values: CounterpartyGeneralFormValues,
  ) => CounterpartyGeneralFormSubmit;
  onShortNameChange?: (name: string) => void;
};

type CounterpartyGeneralFormVariant = {
  submitLabel: string;
  submittingLabel: string;
  disableSubmitUntilDirty: boolean;
  usePlaceholderDates: boolean;
};

type CounterpartyGeneralFormBaseProps = CounterpartyGeneralFormProps & {
  variant: CounterpartyGeneralFormVariant;
};

const ROOT_GROUP = "__root__";

const DEFAULT_VALUES: CounterpartyGeneralFormValues = {
  shortName: "",
  fullName: "",
  kind: "legal_entity",
  country: "",
  externalId: "",
  description: "",
  customerId: "",
  groupIds: [],
};

const CounterpartyGeneralFormSchema = z.object({
  shortName: z.string().trim().min(1, "Краткое наименование обязательно"),
  fullName: z.string().trim().min(1, "Полное наименование обязательно"),
  kind: z.enum(["legal_entity", "individual"]),
  country: z.string(),
  externalId: z.string(),
  description: z.string(),
  customerId: z
    .string()
    .refine(
      (value) =>
        value.trim().length === 0 || z.uuid().safeParse(value.trim()).success,
      "Customer ID должен быть UUID",
    ),
  groupIds: z.array(z.uuid()),
});

function compareGroupsByName(
  a: CounterpartyGroupOption,
  b: CounterpartyGroupOption,
): number {
  const normalizedA = a.name.trim().toLowerCase();
  const normalizedB = b.name.trim().toLowerCase();

  if (normalizedA < normalizedB) {
    return -1;
  }
  if (normalizedA > normalizedB) {
    return 1;
  }

  return a.id.localeCompare(b.id);
}

function resolveInitialValues(
  initialValues?: Partial<CounterpartyGeneralFormValues>,
): CounterpartyGeneralFormValues {
  return {
    ...DEFAULT_VALUES,
    ...initialValues,
  };
}

const CREATE_GENERAL_FORM_VARIANT: CounterpartyGeneralFormVariant = {
  submitLabel: "Создать",
  submittingLabel: "Создание...",
  disableSubmitUntilDirty: false,
  usePlaceholderDates: true,
};

const EDIT_GENERAL_FORM_VARIANT: CounterpartyGeneralFormVariant = {
  submitLabel: "Сохранить",
  submittingLabel: "Сохранение...",
  disableSubmitUntilDirty: true,
  usePlaceholderDates: false,
};

function CounterpartyGeneralFormBase({
  initialValues,
  groupOptions,
  submitting = false,
  error,
  onSubmit,
  onShortNameChange,
  variant,
}: CounterpartyGeneralFormBaseProps) {
  const initial = useMemo(
    () => resolveInitialValues(initialValues),
    [initialValues],
  );

  const groupById = useMemo(() => {
    return new Map(groupOptions.map((group) => [group.id, group]));
  }, [groupOptions]);

  const rootCodeByGroupId = useMemo(() => {
    const cache = new Map<string, "treasury" | "customers">();

    const resolveRootCode = (
      groupId: string,
    ): "treasury" | "customers" | null => {
      const cached = cache.get(groupId);
      if (cached) {
        return cached;
      }

      const visited = new Set<string>();
      let cursor = groupById.get(groupId);

      while (cursor) {
        if (visited.has(cursor.id)) {
          return null;
        }
        visited.add(cursor.id);

        if (!cursor.parentId) {
          if (cursor.code === "treasury" || cursor.code === "customers") {
            cache.set(groupId, cursor.code);
            return cursor.code;
          }
          return null;
        }

        cursor = groupById.get(cursor.parentId);
      }

      return null;
    };

    for (const group of groupOptions) {
      resolveRootCode(group.id);
    }

    return cache;
  }, [groupById, groupOptions]);

  const customerScopeByGroupId = useMemo(() => {
    const cache = new Map<string, string | null>();

    const resolveCustomerScope = (groupId: string): string | null => {
      if (cache.has(groupId)) {
        return cache.get(groupId) ?? null;
      }

      const visited = new Set<string>();
      let cursor = groupById.get(groupId);

      while (cursor) {
        if (visited.has(cursor.id)) {
          cache.set(groupId, null);
          return null;
        }
        visited.add(cursor.id);

        if (cursor.customerId) {
          cache.set(groupId, cursor.customerId);
          return cursor.customerId;
        }

        if (!cursor.parentId) {
          break;
        }

        cursor = groupById.get(cursor.parentId);
      }

      cache.set(groupId, null);
      return null;
    };

    for (const group of groupOptions) {
      resolveCustomerScope(group.id);
    }

    return cache;
  }, [groupById, groupOptions]);

  const groupsByParent = useMemo(() => {
    const map = new Map<string, CounterpartyGroupOption[]>();

    for (const group of groupOptions) {
      const key = group.parentId ?? ROOT_GROUP;
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(group);
      } else {
        map.set(key, [group]);
      }
    }

    for (const bucket of map.values()) {
      bucket.sort(compareGroupsByName);
    }

    return map;
  }, [groupOptions]);

  const getAncestors = useCallback((groupId: string): string[] => {
    const ancestors: string[] = [];
    const visited = new Set<string>();
    let cursor = groupById.get(groupId);

    while (cursor?.parentId) {
      if (visited.has(cursor.id)) {
        break;
      }
      visited.add(cursor.id);

      const parent = groupById.get(cursor.parentId);
      if (!parent) {
        break;
      }

      ancestors.push(parent.id);
      cursor = parent;
    }

    return ancestors;
  }, [groupById]);

  function getDescendants(groupId: string): string[] {
    const descendants: string[] = [];
    const stack = [groupId];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const children = groupsByParent.get(currentId) ?? [];
      for (const child of children) {
        descendants.push(child.id);
        stack.push(child.id);
      }
    }

    return descendants;
  }

  function getRootCode(groupId: string): "treasury" | "customers" | null {
    return rootCodeByGroupId.get(groupId) ?? null;
  }

  function getCustomerScope(groupId: string): string | null {
    return customerScopeByGroupId.get(groupId) ?? null;
  }

  function hasSelectedDescendant(
    groupId: string,
    selectedSet: Set<string>,
  ): boolean {
    const stack = [groupId];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const children = groupsByParent.get(currentId) ?? [];
      for (const child of children) {
        if (selectedSet.has(child.id)) {
          return true;
        }
        stack.push(child.id);
      }
    }

    return false;
  }

  function addAncestorClosure(rawSet: Set<string>): Set<string> {
    const next = new Set(rawSet);

    for (const selectedId of Array.from(next)) {
      for (const ancestorId of getAncestors(selectedId)) {
        next.add(ancestorId);
      }
    }

    return next;
  }

  function enforceBranchConstraints(
    rawSet: Set<string>,
    anchorGroupId: string,
  ): Set<string> {
    const next = new Set(rawSet);
    const anchorRootCode = getRootCode(anchorGroupId);
    const anchorCustomerScope = getCustomerScope(anchorGroupId);

    for (const selectedId of Array.from(next)) {
      const selectedRootCode = getRootCode(selectedId);
      const selectedCustomerScope = getCustomerScope(selectedId);

      if (
        selectedRootCode &&
        anchorRootCode &&
        selectedRootCode !== anchorRootCode
      ) {
        next.delete(selectedId);
        continue;
      }

      if (
        selectedRootCode === "customers" &&
        anchorRootCode === "customers" &&
        selectedCustomerScope &&
        anchorCustomerScope &&
        selectedCustomerScope !== anchorCustomerScope
      ) {
        next.delete(selectedId);
      }
    }

    return next;
  }

  function toggleOn(groupId: string, currentIds: string[]): string[] {
    const next = new Set(currentIds);
    next.add(groupId);

    const constrained = enforceBranchConstraints(next, groupId);
    const withAncestors = addAncestorClosure(constrained);
    const normalized = enforceBranchConstraints(withAncestors, groupId);

    return Array.from(normalized);
  }

  function toggleOff(groupId: string, currentIds: string[]): string[] {
    const next = new Set(currentIds);
    const idsToRemove = [groupId, ...getDescendants(groupId)];

    for (const id of idsToRemove) {
      next.delete(id);
    }

    for (const ancestorId of getAncestors(groupId)) {
      if (!hasSelectedDescendant(ancestorId, next)) {
        next.delete(ancestorId);
      }
    }

    return Array.from(next);
  }

  const formSchema = useMemo(
    () =>
      CounterpartyGeneralFormSchema.superRefine((values, ctx) => {
        const hasCustomersMembership = values.groupIds.some(
          (groupId) => rootCodeByGroupId.get(groupId) === "customers",
        );
        const scopedCustomerIds = Array.from(
          new Set(
            values.groupIds
              .map((groupId) => customerScopeByGroupId.get(groupId) ?? null)
              .filter((customerId): customerId is string => Boolean(customerId)),
          ),
        );

        if (hasCustomersMembership && scopedCustomerIds.length === 0) {
          ctx.addIssue({
            code: "custom",
            path: ["groupIds"],
            message:
              "Для ветки Клиенты выберите группу конкретного клиента.",
          });
        }

        if (scopedCustomerIds.length > 1) {
          ctx.addIssue({
            code: "custom",
            path: ["groupIds"],
            message: "Нельзя смешивать группы разных клиентов.",
          });
        }
      }),
    [customerScopeByGroupId, rootCodeByGroupId],
  );

  const {
    control,
    handleSubmit,
    register,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<CounterpartyGeneralFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
    mode: "onChange",
    shouldUnregister: false,
  });

  const selectedGroupIdsValue = useWatch({
    control,
    name: "groupIds",
  });
  const watchedShortName = useWatch({
    control,
    name: "shortName",
  });
  const selectedGroupIds = useMemo(
    () =>
      Array.isArray(selectedGroupIdsValue)
        ? selectedGroupIdsValue
        : [],
    [selectedGroupIdsValue],
  );
  const selectedCustomerScopeIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedGroupIds
            .map((groupId) => customerScopeByGroupId.get(groupId) ?? null)
            .filter((customerId): customerId is string => Boolean(customerId)),
        ),
      ),
    [customerScopeByGroupId, selectedGroupIds],
  );
  const derivedCustomerId = selectedCustomerScopeIds.length === 1
    ? selectedCustomerScopeIds[0]!
    : "";
  const rootGroupIds = useMemo(
    () => (groupsByParent.get(ROOT_GROUP) ?? []).map((group) => group.id),
    [groupsByParent],
  );
  const selectedPathExpandedIds = useMemo(() => {
    const expanded = new Set<string>();

    for (const groupId of selectedGroupIds) {
      expanded.add(groupId);
      for (const ancestorId of getAncestors(groupId)) {
        expanded.add(ancestorId);
      }
    }

    return Array.from(expanded);
  }, [getAncestors, selectedGroupIds]);
  const initialExpandedIds = useMemo(() => {
    const expanded = new Set(rootGroupIds);
    for (const id of selectedPathExpandedIds) {
      expanded.add(id);
    }
    return Array.from(expanded);
  }, [rootGroupIds, selectedPathExpandedIds]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(initialExpandedIds),
  );

  const nowFormatted = formatDate(new Date());

  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  useEffect(() => {
    onShortNameChange?.(watchedShortName ?? "");
  }, [onShortNameChange, watchedShortName]);

  useEffect(() => {
    setValue("customerId", derivedCustomerId, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [derivedCustomerId, setValue]);

  useEffect(() => {
    setExpandedIds((current) => {
      const next = new Set(current);
      let changed = false;

      for (const id of selectedPathExpandedIds) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [selectedPathExpandedIds]);

  function handleReset() {
    reset(initial);
  }

  async function handleFormSubmit(values: CounterpartyGeneralFormValues) {
    if (!onSubmit) return;

    const submittedValues = await onSubmit(values);
    if (submittedValues) {
      reset(submittedValues);
    }
  }

  const submitDisabled =
    submitting || !onSubmit || (variant.disableSubmitUntilDirty && !isDirty);
  const resetDisabled = submitting || !isDirty;

  function expandNodePath(groupId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      let changed = false;

      if (!next.has(groupId)) {
        next.add(groupId);
        changed = true;
      }

      for (const ancestorId of getAncestors(groupId)) {
        if (!next.has(ancestorId)) {
          next.add(ancestorId);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }

  function renderGroupTree(
    fieldValue: string[],
    onChange: (value: string[]) => void,
    parentId: string,
    depth = 0,
  ): React.ReactNode {
    const children = groupsByParent.get(parentId) ?? [];

    return children.map((group) => {
      const checked = fieldValue.includes(group.id);
      const hasChildren = (groupsByParent.get(group.id)?.length ?? 0) > 0;
      const isExpanded = expandedIds.has(group.id);
      const groupLabel = localizeCounterpartyGroupLabel(group.name);

      return (
        <div key={group.id} className="space-y-1">
          <div
            className="flex items-start gap-2"
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            {hasChildren ? (
              <button
                type="button"
                className="mt-0.5 inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded
                    ? `Свернуть группу ${groupLabel}`
                    : `Развернуть группу ${groupLabel}`
                }
                onClick={() => {
                  setExpandedIds((current) => {
                    const next = new Set(current);
                    if (next.has(group.id)) {
                      next.delete(group.id);
                    } else {
                      next.add(group.id);
                    }
                    return next;
                  });
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </button>
            ) : (
              <span className="mt-0.5 inline-block size-4" />
            )}
            <Checkbox
              checked={checked}
              onCheckedChange={(nextChecked) => {
                const shouldCheck = Boolean(nextChecked);
                const nextValue = shouldCheck
                  ? toggleOn(group.id, fieldValue)
                  : toggleOff(group.id, fieldValue);

                if (shouldCheck) {
                  expandNodePath(group.id);
                }

                onChange(nextValue);
              }}
            />
            <div className="leading-none">
              <div className="text-sm font-medium">{groupLabel}</div>
              <div className="text-muted-foreground text-xs">
                {group.code} •{" "}
                {group.customerId
                  ? "Клиент"
                  : localizeCounterpartyGroupLabel(
                      rootCodeByGroupId.get(group.id) ?? "custom",
                    )}
              </div>
            </div>
          </div>
          {hasChildren && isExpanded
            ? renderGroupTree(fieldValue, onChange, group.id, depth + 1)
            : null}
        </div>
      );
    });
  }

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">
              Общая информация
            </CardTitle>
            <CardDescription>
              Просмотр и редактирование общей информации контрагента.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              form="counterparty-general-form"
              disabled={submitDisabled}
            >
              {submitting ? (
                <Spinner className="size-4" />
              ) : (
                <Save className="size-4" />
              )}
              {submitting ? variant.submittingLabel : variant.submitLabel}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={resetDisabled}
              onClick={handleReset}
            >
              <X className="size-4" />
              Отменить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          id="counterparty-general-form"
          onSubmit={handleSubmit(handleFormSubmit)}
        >
          <input type="hidden" {...register("customerId")} />
          <FieldGroup>
            <FieldSet>
              <FieldGroup>
                <div className="grid md:grid-cols-2 gap-4">
                  <Controller
                    name="shortName"
                    control={control}
                    rules={{
                      validate: (value) =>
                        value.trim().length > 0 ||
                        "Краткое наименование обязательно",
                    }}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="counterparty-short-name">
                          Краткое наименование
                        </FieldLabel>
                        <Input
                          {...field}
                          id="counterparty-short-name"
                          aria-invalid={fieldState.invalid}
                          placeholder="Например: Acme"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />{" "}
                  <Controller
                    name="fullName"
                    control={control}
                    rules={{
                      validate: (value) =>
                        value.trim().length > 0 ||
                        "Полное наименование обязательно",
                    }}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="counterparty-full-name">
                          Полное наименование
                        </FieldLabel>
                        <Input
                          {...field}
                          id="counterparty-full-name"
                          aria-invalid={fieldState.invalid}
                          placeholder="Например: Acme Incorporated"
                        />
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <Controller
                    name="kind"
                    control={control}
                    rules={{
                      required: "Тип субъекта обязателен",
                    }}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="counterparty-kind">
                          Тип субъекта
                        </FieldLabel>
                        <Select
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="counterparty-kind"
                            aria-invalid={fieldState.invalid}
                            className="w-full"
                          >
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="legal_entity">
                                Юридическое лицо
                              </SelectItem>
                              <SelectItem value="individual">
                                Физическое лицо
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Field data-invalid={Boolean(errors.country)}>
                    <FieldLabel htmlFor="counterparty-country">
                      Страна
                    </FieldLabel>
                    <Input
                      {...register("country")}
                      id="counterparty-country"
                      aria-invalid={Boolean(errors.country)}
                      placeholder="Например: Россия"
                    />
                    <FieldError errors={[errors.country]} />
                  </Field>
                  <Field data-invalid={Boolean(errors.externalId)}>
                    <FieldLabel htmlFor="counterparty-external-id">
                      External ID
                    </FieldLabel>
                    <Input
                      {...register("externalId")}
                      id="counterparty-external-id"
                      aria-invalid={Boolean(errors.externalId)}
                      placeholder="Например: crm-123"
                    />
                    <FieldError errors={[errors.externalId]} />
                  </Field>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <Controller
                    name="groupIds"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>Группы</FieldLabel>
                        <FieldDescription>
                          Контрагент может быть только в одной ветке:
                          Казначейство или Клиенты.
                        </FieldDescription>
                        <div className="space-y-2 rounded-md border p-3">
                          {groupOptions.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                              Группы не найдены.
                            </p>
                          ) : (
                            renderGroupTree(
                              field.value ?? [],
                              (nextValue) => field.onChange(nextValue),
                              ROOT_GROUP,
                            )
                          )}
                        </div>
                        {fieldState.invalid && (
                          <FieldError errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                  <Field data-invalid={Boolean(errors.description)}>
                    <FieldLabel htmlFor="counterparty-description">
                      Описание
                    </FieldLabel>
                    <Textarea
                      {...register("description")}
                      id="counterparty-description"
                      aria-invalid={Boolean(errors.description)}
                      placeholder="Дополнительная информация о контрагенте"
                      rows={3}
                    />
                    <FieldError errors={[errors.description]} />
                  </Field>
                </div>
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Дата создания</FieldLabel>
                <Input
                  readOnly
                  disabled
                  value={variant.usePlaceholderDates ? "—" : nowFormatted}
                />
              </Field>
              <Field>
                <FieldLabel>Дата обновления</FieldLabel>
                <Input
                  readOnly
                  disabled
                  value={variant.usePlaceholderDates ? "—" : nowFormatted}
                />
              </Field>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function CounterpartyCreateGeneralForm(
  props: CounterpartyGeneralFormProps,
) {
  return (
    <CounterpartyGeneralFormBase
      variant={CREATE_GENERAL_FORM_VARIANT}
      {...props}
    />
  );
}

export function CounterpartyEditGeneralForm(
  props: CounterpartyGeneralFormProps,
) {
  return (
    <CounterpartyGeneralFormBase
      variant={EDIT_GENERAL_FORM_VARIANT}
      {...props}
    />
  );
}

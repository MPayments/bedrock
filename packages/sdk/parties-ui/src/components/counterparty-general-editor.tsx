"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronRight, Save, X } from "lucide-react";
import type { Control, FieldPath } from "react-hook-form";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Checkbox } from "@bedrock/sdk-ui/components/checkbox";
import { CountrySelect } from "@bedrock/sdk-ui/components/country-select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@bedrock/sdk-ui/components/field";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

export type CounterpartyGroupOption = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  customerId: string | null;
  customerLabel?: string | null;
  isSystem: boolean;
  label: string;
};

export type CounterpartyGeneralFormValues = {
  shortName: string;
  shortNameEn: string;
  fullName: string;
  fullNameEn: string;
  kind: "legal_entity" | "individual";
  country: string;
  description: string;
  customerId: string;
  groupIds: string[];
};

export type CounterpartyGeneralBilingualMode = "ru" | "en" | "all";

type CounterpartyGeneralFormSubmit =
  | Promise<CounterpartyGeneralFormValues | void>
  | CounterpartyGeneralFormValues
  | void;

export type CounterpartyGeneralEditorExternalPatch = {
  nonce: number;
  patch: Partial<CounterpartyGeneralFormValues>;
};

type CounterpartyGeneralEditorProps = {
  initialValues?: Partial<CounterpartyGeneralFormValues>;
  groupOptions: CounterpartyGroupOption[];
  lockedGroupIds?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
  submitting?: boolean;
  error?: string | null;
  externalPatch?: CounterpartyGeneralEditorExternalPatch | null;
  bilingualMode?: CounterpartyGeneralBilingualMode;
  onDirtyChange?: (dirty: boolean) => void;
  onValuesChange?: (values: CounterpartyGeneralFormValues) => void;
  onSubmit?: (
    values: CounterpartyGeneralFormValues,
  ) => CounterpartyGeneralFormSubmit;
  onShortNameChange?: (name: string) => void;
  submitLabel?: string;
  submittingLabel?: string;
  disableSubmitUntilDirty?: boolean;
  headerActions?: ReactNode;
  kindReadonly?: boolean;
  showGroups?: boolean;
  showDates?: boolean;
  title?: string;
  description?: string;
};

const ROOT_GROUP = "__root__";
const EMPTY_GROUP_IDS: string[] = [];

const DEFAULT_VALUES: CounterpartyGeneralFormValues = {
  shortName: "",
  shortNameEn: "",
  fullName: "",
  fullNameEn: "",
  kind: "legal_entity",
  country: "",
  description: "",
  customerId: "",
  groupIds: [],
};

const COUNTERPARTY_KIND_OPTIONS = [
  { value: "legal_entity", label: "Юридическое лицо" },
  { value: "individual", label: "Физическое лицо" },
] as const satisfies ReadonlyArray<{
  value: CounterpartyGeneralFormValues["kind"];
  label: string;
}>;

const CounterpartyGeneralFormSchema = z.object({
  shortName: z.string().trim().min(1, "Краткое наименование обязательно"),
  shortNameEn: z.string(),
  fullName: z.string().trim().min(1, "Полное наименование обязательно"),
  fullNameEn: z.string(),
  kind: z.enum(["legal_entity", "individual"]),
  country: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(
      (value) => value.length === 0 || /^[A-Z]{2}$/.test(value),
      "Введите двухбуквенный код страны",
    ),
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

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

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

function normalizeGroupIds(groupIds: string[]) {
  return Array.from(new Set(groupIds));
}

function areGroupIdSetsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  const bSet = new Set(b);
  return a.every((id) => bSet.has(id));
}

function resolveInitialValues(
  initialValues?: Partial<CounterpartyGeneralFormValues>,
  lockedGroupIds: string[] = EMPTY_GROUP_IDS,
): CounterpartyGeneralFormValues {
  const initialGroupIds = Array.isArray(initialValues?.groupIds)
    ? initialValues.groupIds
    : [];

  return {
    ...DEFAULT_VALUES,
    ...initialValues,
    groupIds: Array.from(new Set([...initialGroupIds, ...lockedGroupIds])),
  };
}

function localizeCounterpartyGroupLabel(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "customer") {
    return "Клиенты";
  }

  if (normalized === "custom") {
    return "Пользовательская группа";
  }

  return value;
}

function getCounterpartyGroupDisplayLabel(
  group: Pick<CounterpartyGroupOption, "name" | "customerId" | "customerLabel">,
) {
  const label = localizeCounterpartyGroupLabel(group.name);
  const customerLabel = group.customerLabel?.trim();

  if (
    !group.customerId ||
    !customerLabel ||
    customerLabel.length === 0 ||
    customerLabel === label
  ) {
    return label;
  }

  return `${label} · ${customerLabel}`;
}

type BilingualTextFieldProps = {
  bilingualMode: CounterpartyGeneralBilingualMode;
  control: Control<CounterpartyGeneralFormValues>;
  ruName: FieldPath<CounterpartyGeneralFormValues>;
  enName: FieldPath<CounterpartyGeneralFormValues>;
  idBase: string;
  label: ReactNode;
  placeholderRu?: string;
  placeholderEn?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
};

function BilingualTextField({
  bilingualMode,
  control,
  ruName,
  enName,
  idBase,
  label,
  placeholderRu,
  placeholderEn,
  required,
  multiline,
  rows = 3,
  disabled,
}: BilingualTextFieldProps) {
  const showBoth = bilingualMode === "all";
  const showEnOnly = bilingualMode === "en";

  const renderInput = (
    name: FieldPath<CounterpartyGeneralFormValues>,
    inputId: string,
    placeholder?: string,
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const fieldValue = typeof field.value === "string" ? field.value : "";
        const commonProps = {
          id: inputId,
          "aria-invalid": fieldState.invalid,
          placeholder,
          disabled,
        } as const;
        return (
          <>
            {multiline ? (
              <Textarea
                {...commonProps}
                name={field.name}
                ref={field.ref}
                value={fieldValue}
                onBlur={field.onBlur}
                onChange={field.onChange}
                rows={rows}
              />
            ) : (
              <Input
                {...commonProps}
                name={field.name}
                ref={field.ref}
                value={fieldValue}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
            {fieldState.invalid ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </>
        );
      }}
    />
  );

  return (
    <Field className="md:col-span-2">
      <FieldLabel htmlFor={showEnOnly ? `${idBase}-en` : idBase}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </FieldLabel>
      {showBoth ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              RU
            </span>
            {renderInput(ruName, idBase, placeholderRu)}
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              EN
            </span>
            {renderInput(enName, `${idBase}-en`, placeholderEn)}
          </div>
        </div>
      ) : showEnOnly ? (
        renderInput(enName, `${idBase}-en`, placeholderEn)
      ) : (
        renderInput(ruName, idBase, placeholderRu)
      )}
    </Field>
  );
}

export function CounterpartyGeneralEditor({
  initialValues,
  groupOptions,
  lockedGroupIds: rawLockedGroupIds = EMPTY_GROUP_IDS,
  createdAt,
  updatedAt,
  submitting = false,
  error,
  externalPatch,
  bilingualMode = "ru",
  onDirtyChange,
  onValuesChange,
  onSubmit,
  onShortNameChange,
  submitLabel = "Сохранить",
  submittingLabel = "Сохранение...",
  disableSubmitUntilDirty = true,
  headerActions,
  kindReadonly = false,
  showGroups = true,
  showDates = true,
  title = "Общая информация",
  description = "Просмотр и редактирование общей информации контрагента.",
}: CounterpartyGeneralEditorProps) {
  const lockedGroupIds = useMemo(
    () => normalizeGroupIds(rawLockedGroupIds),
    [rawLockedGroupIds],
  );
  const lockedGroupIdSet = useMemo(
    () => new Set(lockedGroupIds),
    [lockedGroupIds],
  );
  const initial = useMemo(
    () => resolveInitialValues(initialValues, lockedGroupIds),
    [initialValues, lockedGroupIds],
  );

  const groupById = useMemo(
    () => new Map(groupOptions.map((group) => [group.id, group])),
    [groupOptions],
  );

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

  const getAncestors = useCallback(
    (groupId: string): string[] => {
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
    },
    [groupById],
  );

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

  function getCustomerScope(groupId: string): string | null {
    return customerScopeByGroupId.get(groupId) ?? null;
  }

  function hasSelectedDescendant(groupId: string, selectedSet: Set<string>) {
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

  const normalizeSelectedGroupIds = useCallback(
    (groupIds: string[]) =>
      normalizeGroupIds([...normalizeGroupIds(groupIds), ...lockedGroupIds]),
    [lockedGroupIds],
  );

  function enforceCustomerScopeConstraints(
    rawSet: Set<string>,
    anchorGroupId: string,
  ): Set<string> {
    const anchorCustomerScope = getCustomerScope(anchorGroupId);
    if (!anchorCustomerScope) {
      return rawSet;
    }

    const next = new Set(rawSet);

    for (const selectedId of Array.from(next)) {
      const selectedCustomerScope = getCustomerScope(selectedId);

      if (
        selectedCustomerScope &&
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

    const constrained = enforceCustomerScopeConstraints(next, groupId);
    const withAncestors = addAncestorClosure(constrained);
    const normalized = enforceCustomerScopeConstraints(withAncestors, groupId);

    return normalizeSelectedGroupIds(Array.from(normalized));
  }

  function toggleOff(groupId: string, currentIds: string[]): string[] {
    if (lockedGroupIdSet.has(groupId)) {
      return normalizeSelectedGroupIds(currentIds);
    }

    const next = new Set(currentIds);
    const idsToRemove = [groupId, ...getDescendants(groupId)];

    for (const id of idsToRemove) {
      if (lockedGroupIdSet.has(id)) {
        continue;
      }
      next.delete(id);
    }

    for (const ancestorId of getAncestors(groupId)) {
      if (!hasSelectedDescendant(ancestorId, next)) {
        next.delete(ancestorId);
      }
    }

    return normalizeSelectedGroupIds(Array.from(next));
  }

  const formSchema = useMemo(
    () =>
      CounterpartyGeneralFormSchema.superRefine((values, ctx) => {
        for (const lockedGroupId of lockedGroupIds) {
          if (!values.groupIds.includes(lockedGroupId)) {
            ctx.addIssue({
              code: "custom",
              path: ["groupIds"],
              message: "Обязательные группы нельзя снять.",
            });
            break;
          }
        }

        const scopedCustomerIds = Array.from(
          new Set(
            values.groupIds
              .map((groupId) => customerScopeByGroupId.get(groupId) ?? null)
              .filter((customerId): customerId is string => Boolean(customerId)),
          ),
        );

        if (scopedCustomerIds.length > 1) {
          ctx.addIssue({
            code: "custom",
            path: ["groupIds"],
            message: "Нельзя смешивать группы разных клиентов.",
          });
        }
      }),
    [customerScopeByGroupId, lockedGroupIds],
  );

  const {
    control,
    getValues,
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
  const watchedValues = useWatch({
    control,
  });
  const selectedGroupIdsRaw = useMemo(
    () => (Array.isArray(selectedGroupIdsValue) ? selectedGroupIdsValue : []),
    [selectedGroupIdsValue],
  );
  const selectedGroupIds = useMemo(
    () => normalizeSelectedGroupIds(selectedGroupIdsRaw),
    [normalizeSelectedGroupIds, selectedGroupIdsRaw],
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
  const derivedCustomerId =
    selectedCustomerScopeIds.length === 1 ? selectedCustomerScopeIds[0]! : "";
  const rootGroupIds = useMemo(
    () => (groupsByParent.get(ROOT_GROUP) ?? []).map((group) => group.id),
    [groupsByParent],
  );
  const selectedPathExpandedIds = useMemo(() => {
    const expanded = new Set(rootGroupIds);

    for (const groupId of selectedGroupIds) {
      expanded.add(groupId);
      for (const ancestorId of getAncestors(groupId)) {
        expanded.add(ancestorId);
      }
    }

    return Array.from(expanded);
  }, [getAncestors, rootGroupIds, selectedGroupIds]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(selectedPathExpandedIds),
  );

  useEffect(() => {
    reset(initial);
  }, [initial, reset]);

  const externalPatchNonce = externalPatch?.nonce ?? null;
  useEffect(() => {
    if (!externalPatch) {
      return;
    }

    const current = getValues();
    reset(
      { ...current, ...externalPatch.patch },
      { keepDirty: true, keepTouched: true },
    );
    // `reset` is from react-hook-form: replacing form values programmatically
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPatchNonce]);

  const onShortNameChangeRef = useRef(onShortNameChange);
  onShortNameChangeRef.current = onShortNameChange;
  const onValuesChangeRef = useRef(onValuesChange);
  onValuesChangeRef.current = onValuesChange;
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  useEffect(() => {
    onShortNameChangeRef.current?.(watchedShortName ?? "");
  }, [watchedShortName]);

  useEffect(() => {
    onValuesChangeRef.current?.({
      ...DEFAULT_VALUES,
      ...watchedValues,
    });
  }, [watchedValues]);

  useEffect(() => {
    onDirtyChangeRef.current?.(isDirty);
  }, [isDirty]);

  useEffect(() => {
    if (areGroupIdSetsEqual(selectedGroupIdsRaw, selectedGroupIds)) {
      return;
    }

    setValue("groupIds", selectedGroupIds, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [selectedGroupIds, selectedGroupIdsRaw, setValue]);

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

  async function handleFormSubmit(values: CounterpartyGeneralFormValues) {
    if (!onSubmit) {
      return;
    }

    const submittedValues = await onSubmit(values);
    if (submittedValues) {
      reset(submittedValues);
    }
  }

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
      const isLocked = lockedGroupIdSet.has(group.id);
      const hasChildren = (groupsByParent.get(group.id)?.length ?? 0) > 0;
      const isExpanded = expandedIds.has(group.id);
      const groupLabel = getCounterpartyGroupDisplayLabel(group);

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
              disabled={isLocked || submitting}
              onCheckedChange={(nextChecked) => {
                if (isLocked) {
                  return;
                }

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
                {`${group.code} • ${
                  getCustomerScope(group.id)
                    ? "Группа клиента"
                    : "Пользовательская группа"
                }`}
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

  const submitDisabled =
    submitting || !onSubmit || (disableSubmitUntilDirty && !isDirty);
  const resetDisabled = submitting || !isDirty;

  return (
    <Card className="w-full rounded-sm">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
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
              {submitting ? submittingLabel : submitLabel}
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={resetDisabled}
              onClick={() => reset(initial)}
            >
              <X className="size-4" />
              Отменить
            </Button>
            {headerActions}
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
              <div className="grid gap-4 md:grid-cols-2">
                <BilingualTextField
                  bilingualMode={bilingualMode}
                  control={control}
                  ruName="shortName"
                  enName="shortNameEn"
                  idBase="counterparty-short-name"
                  label="Краткое наименование"
                  placeholderRu="Например: Acme"
                  placeholderEn="e.g., Acme"
                  required
                  disabled={submitting}
                />
                <BilingualTextField
                  bilingualMode={bilingualMode}
                  control={control}
                  ruName="fullName"
                  enName="fullNameEn"
                  idBase="counterparty-full-name"
                  label="Полное наименование"
                  placeholderRu="Например: Acme Incorporated"
                  placeholderEn="e.g., Acme Incorporated"
                  required
                  disabled={submitting}
                />

                <Controller
                  name="kind"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="counterparty-kind">
                        Тип субъекта
                      </FieldLabel>
                      <Select
                        name={field.name}
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={submitting || kindReadonly}
                      >
                        <SelectTrigger
                          id="counterparty-kind"
                          aria-invalid={fieldState.invalid}
                          className="w-full"
                        >
                          <SelectValue placeholder="Выберите тип">
                            {
                              COUNTERPARTY_KIND_OPTIONS.find(
                                (option) => option.value === field.value,
                              )?.label
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {COUNTERPARTY_KIND_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
                <Controller
                  name="country"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="counterparty-country">
                        Страна
                      </FieldLabel>
                      <CountrySelect
                        id="counterparty-country"
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={submitting}
                        invalid={fieldState.invalid}
                        placeholder="Выберите страну"
                        searchPlaceholder="Поиск страны..."
                        emptyLabel="Страна не найдена"
                        clearable
                        clearLabel="Очистить"
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />

                {showGroups ? (
                  <Controller
                    name="groupIds"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        className="md:col-span-2"
                      >
                        <FieldLabel>Группы</FieldLabel>
                        <FieldDescription>
                          Можно сочетать пользовательские группы и группы одного
                          клиента. Группы разных клиентов смешивать нельзя.
                        </FieldDescription>
                        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                          {groupOptions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Группы не найдены.
                            </p>
                          ) : (
                            renderGroupTree(
                              normalizeSelectedGroupIds(field.value ?? []),
                              (nextValue) => field.onChange(nextValue),
                              ROOT_GROUP,
                            )
                          )}
                        </div>
                        {fieldState.invalid ? (
                          <FieldError errors={[fieldState.error]} />
                        ) : null}
                      </Field>
                    )}
                  />
                ) : null}

                <Controller
                  name="description"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="md:col-span-2"
                    >
                      <FieldLabel htmlFor="counterparty-description">
                        Описание
                      </FieldLabel>
                      <Textarea
                        id="counterparty-description"
                        name={field.name}
                        ref={field.ref}
                        value={typeof field.value === "string" ? field.value : ""}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                        rows={3}
                        aria-invalid={fieldState.invalid}
                        placeholder="Дополнительная информация о контрагенте"
                        disabled={submitting}
                      />
                      {fieldState.invalid ? (
                        <FieldError errors={[fieldState.error]} />
                      ) : null}
                    </Field>
                  )}
                />
              </div>
            </FieldSet>
            {showDates ? (
              <>
                <FieldSeparator />
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Дата создания</FieldLabel>
                    <Input readOnly disabled value={formatDateLabel(createdAt)} />
                  </Field>
                  <Field>
                    <FieldLabel>Дата обновления</FieldLabel>
                    <Input readOnly disabled value={formatDateLabel(updatedAt)} />
                  </Field>
                </div>
              </>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

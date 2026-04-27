"use client";

import { Fragment } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Save, X } from "lucide-react";
import { useWatch } from "react-hook-form";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  FieldDescription,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@bedrock/sdk-ui/components/field";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";
import { cn } from "@bedrock/sdk-ui/lib/utils";

import { resolveDocumentFormSectionRows } from "../../lib/document-form-registry/layout";

import { useDocumentTypedForm } from "./context";
import {
  buildWatchedValueMap,
  collectVisibilityDependencyNames,
  getResponsiveGridClassName,
  getResponsiveGridItemClassName,
  isFieldVisible,
} from "./helpers";
import { DocumentTypedFormSectionProvider } from "./section-context";
import { DocumentTypedFormFieldRenderer } from "./renderers/registry";

type DocumentTypedFormFormProps = {
  children: ReactNode;
  className?: string;
};

export function DocumentTypedFormForm({
  children,
  className,
}: DocumentTypedFormFormProps) {
  const { actions, meta } = useDocumentTypedForm();

  return (
    <form
      id={meta.formId}
      onSubmit={actions.onSubmit}
      onReset={(event) => {
        event.preventDefault();
        actions.handleReset();
      }}
      className={cn("space-y-6", className)}
    >
      {children}
    </form>
  );
}

function DocumentTypedFormRow({
  row,
  sectionId,
}: {
  row: ReturnType<typeof resolveDocumentFormSectionRows>[number];
  sectionId: string;
}) {
  const dependencyNames = collectVisibilityDependencyNames(
    row.fields.map(({ field }) => field),
  );
  const watchedDependencyValues = useWatch({
    name: dependencyNames as never[],
  });
  const dependencyValues = buildWatchedValueMap(
    dependencyNames,
    watchedDependencyValues,
  );
  const visibleFields = row.fields.filter(
    ({ field }) => !field.hidden && isFieldVisible(field, dependencyValues),
  );

  if (visibleFields.length === 0) {
    return null;
  }

  return (
    <div className={getResponsiveGridClassName(row.columns)}>
      {visibleFields.map(({ field, span }) => (
        <DocumentTypedFormFieldRenderer
          key={`${sectionId}:${field.name}`}
          field={field}
          className={getResponsiveGridItemClassName(span)}
        />
      ))}
    </div>
  );
}

export function DocumentTypedFormSections() {
  const {
    meta: { docType },
    state: { definition },
  } = useDocumentTypedForm();

  if (!definition) {
    return (
      <div className="text-sm text-muted-foreground">
        Для типа <span className="font-mono">{docType}</span> типизированная
        форма недоступна.
      </div>
    );
  }

  return (
    <FieldGroup>
      {definition.sections.map((section, sectionIndex) => {
        const sectionRows = resolveDocumentFormSectionRows(section);

        return (
          <Fragment key={section.id}>
            {sectionIndex > 0 ? <FieldSeparator /> : null}
            <FieldSet>
              <FieldLegend>{section.title}</FieldLegend>
              {section.description ? (
                <FieldDescription>{section.description}</FieldDescription>
              ) : null}
              <DocumentTypedFormSectionProvider section={section}>
                <FieldGroup>
                  {sectionRows.map((row, rowIndex) => (
                    <DocumentTypedFormRow
                      key={`${section.id}-row-${rowIndex}`}
                      row={row}
                      sectionId={section.id}
                    />
                  ))}
                </FieldGroup>
              </DocumentTypedFormSectionProvider>
            </FieldSet>
          </Fragment>
        );
      })}
    </FieldGroup>
  );
}

export function DocumentTypedFormFormError() {
  const {
    state: { formError },
  } = useDocumentTypedForm();

  if (!formError) {
    return null;
  }

  return <p className="text-sm text-destructive">{formError}</p>;
}

type DocumentTypedFormButtonProps = Pick<
  ComponentPropsWithoutRef<typeof Button>,
  "className" | "size" | "variant"
>;

export function DocumentTypedFormSubmitButton({
  className,
  size,
  variant,
}: DocumentTypedFormButtonProps) {
  const {
    meta: { formId, mode },
    state: { submitting, submitDisabled },
  } = useDocumentTypedForm();

  return (
    <Button
      data-testid="finance-document-form-submit"
      type="submit"
      form={formId}
      className={className}
      size={size}
      variant={variant}
      disabled={submitDisabled}
    >
      {submitting ? (
        <Spinner className="size-4" />
      ) : (
        <Save className="size-4" />
      )}
      {submitting
        ? mode === "create"
          ? "Создание..."
          : "Сохранение..."
        : mode === "create"
          ? "Создать документ"
          : "Сохранить черновик"}
    </Button>
  );
}

export function DocumentTypedFormResetButton({
  className,
  size,
  variant = "outline",
}: DocumentTypedFormButtonProps) {
  const {
    meta: { formId },
    state: { resetDisabled },
  } = useDocumentTypedForm();

  return (
    <Button
      data-testid="finance-document-form-reset"
      type="reset"
      form={formId}
      className={className}
      size={size}
      variant={variant}
      disabled={resetDisabled}
    >
      <X className="size-4" />
      Отменить
    </Button>
  );
}

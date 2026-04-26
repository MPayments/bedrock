"use client";

import { useCallback, useMemo, useState } from "react";
import { ZodError } from "zod";
import type { UseFormReturn } from "react-hook-form";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { DocumentFormDefinition } from "../../../lib/document-form-registry";
import type { DocumentFormValues } from "../../../lib/document-form-registry";
import type {
  DocumentMutationDto,
  DocumentMutationResult,
} from "../../../lib/mutations";

import {
  mapDocumentFormZodError,
  type DocumentFormMode,
} from "../helpers";

export type DocumentFormCreateMutator = (input: {
  docType: string;
  dealId?: string;
  payload: unknown;
}) => Promise<DocumentMutationResult>;

export type DocumentFormUpdateMutator = (input: {
  docType: string;
  documentId: string;
  payload: unknown;
}) => Promise<DocumentMutationResult>;

export function useDocumentFormSubmission(input: {
  createDealId?: string;
  methods: UseFormReturn<DocumentFormValues>;
  definition: DocumentFormDefinition | null;
  mode: DocumentFormMode;
  docType: string;
  documentId?: string;
  disabled: boolean;
  defaultValues: DocumentFormValues;
  onSuccess?: (result: DocumentMutationDto) => void;
  createMutator: DocumentFormCreateMutator;
  updateMutator: DocumentFormUpdateMutator;
}) {
  const {
    clearErrors,
    formState: { isDirty },
    handleSubmit,
    reset,
    setError,
  } = input.methods;
  const {
    createDealId,
    createMutator,
    defaultValues,
    definition,
    disabled,
    docType,
    documentId,
    mode,
    onSuccess,
    updateMutator,
  } = input;
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitDisabled =
    !definition ||
    disabled ||
    submitting ||
    (mode === "edit" && (!documentId || !isDirty));
  const resetDisabled = !definition || disabled || submitting || !isDirty;

  const handleReset = useCallback(() => {
    setFormError(null);
    reset(defaultValues);
  }, [defaultValues, reset]);

  const handleFormSubmit = useCallback(
    async (values: DocumentFormValues) => {
      if (disabled || !definition) {
        return;
      }

      setFormError(null);
      clearErrors();

      let payload: unknown;
      try {
        payload = definition.toPayload(values);
      } catch (error) {
        if (error instanceof ZodError) {
          const mappedError = mapDocumentFormZodError(error);

          setFormError(mappedError.formError);

          for (const issue of mappedError.fieldErrors) {
            setError(issue.name, {
              type: "manual",
              message: issue.message,
            });
          }

          return;
        }

        setFormError(
          error instanceof Error
            ? error.message
            : "Не удалось собрать payload документа",
        );
        return;
      }

      setSubmitting(true);

      const mutationResult =
        mode === "create"
          ? await createMutator({
              docType,
              dealId: createDealId,
              payload,
            })
          : await updateMutator({
              docType,
              documentId: documentId ?? "",
              payload,
            });

      setSubmitting(false);

      if (!mutationResult.ok) {
        setFormError(mutationResult.message);
        toast.error(mutationResult.message);
        return;
      }

      if (mode === "create") {
        toast.success(`Документ ${mutationResult.data.docNo} создан`);
      } else {
        toast.success("Черновик обновлен");
      }

      onSuccess?.(mutationResult.data);
      reset(values);
    },
    [
      clearErrors,
      createDealId,
      createMutator,
      definition,
      disabled,
      docType,
      documentId,
      mode,
      onSuccess,
      reset,
      setError,
      updateMutator,
    ],
  );

  const onSubmit = useMemo(
    () => handleSubmit(handleFormSubmit),
    [handleFormSubmit, handleSubmit],
  );

  return {
    formError,
    submitting,
    submitDisabled,
    resetDisabled,
    handleReset,
    onSubmit,
  };
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { ZodError } from "zod";
import type { UseFormReturn } from "react-hook-form";

import { toast } from "@bedrock/sdk-ui/components/sonner";

import type { DocumentFormDefinition } from "@/features/documents/lib/document-form-registry";
import type { DocumentFormValues } from "@/features/documents/lib/document-form-registry";
import {
  createDealScopedDocumentDraft,
  createDocumentDraft,
  updateDocumentDraft,
  type DocumentMutationDto,
} from "@/features/operations/documents/lib/mutations";

import {
  mapDocumentFormZodError,
  type DocumentFormMode,
} from "../helpers";

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
    defaultValues,
    definition,
    disabled,
    docType,
    documentId,
    mode,
    onSuccess,
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
          ? await (createDealId
              ? createDealScopedDocumentDraft({
                  dealId: createDealId,
                  docType,
                  payload,
                })
              : createDocumentDraft({
                  docType,
                  payload,
                }))
          : await updateDocumentDraft({
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
      definition,
      disabled,
      docType,
      documentId,
      mode,
      onSuccess,
      reset,
      setError,
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

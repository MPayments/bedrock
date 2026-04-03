"use client";

import type { ComponentType } from "react";

import type { DocumentFormField } from "@/features/documents/lib/document-form-registry";

import { AccountFieldRenderer } from "./account-field-renderer";
import { AmountFieldRenderer } from "./amount-field-renderer";
import { CounterpartyFieldRenderer } from "./counterparty-field-renderer";
import { FinancialLinesFieldRenderer } from "./financial-lines-field-renderer";
import { FxQuotePreviewFieldRenderer } from "./fx-quote-preview-field-renderer";
import {
  CurrencyFieldRenderer,
  CustomerFieldRenderer,
  EnumFieldRenderer,
  NumberFieldRenderer,
  TextLikeFieldRenderer,
  TextareaFieldRenderer,
} from "./primitive-field-renderers";
import type { DocumentTypedFormFieldRendererProps } from "./shared";

export const DOCUMENT_TYPED_FORM_RENDERER_KINDS = {
  datetime: true,
  date: true,
  month: true,
  text: true,
  amount: true,
  textarea: true,
  number: true,
  enum: true,
  counterparty: true,
  customer: true,
  currency: true,
  account: true,
  financialLines: true,
  fxQuotePreview: true,
} satisfies Record<DocumentFormField["kind"], true>;

type DocumentTypedFormRendererKind = keyof typeof DOCUMENT_TYPED_FORM_RENDERER_KINDS;

type DocumentTypedFormFieldRendererRegistry = {
  [TKind in DocumentTypedFormRendererKind]: ComponentType<DocumentTypedFormFieldRendererProps>;
};

type DocumentTypedFormRendererCoverage =
  Exclude<DocumentFormField["kind"], DocumentTypedFormRendererKind> extends never
    ? true
    : never;

export const DOCUMENT_TYPED_FORM_RENDERERS_ARE_EXHAUSTIVE: DocumentTypedFormRendererCoverage =
  true;

export const documentTypedFormFieldRenderers: DocumentTypedFormFieldRendererRegistry =
  {
    datetime: TextLikeFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    date: TextLikeFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    month: TextLikeFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    text: TextLikeFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    amount: AmountFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    textarea:
      TextareaFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    number: NumberFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    enum: EnumFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    counterparty:
      CounterpartyFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    customer:
      CustomerFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    currency:
      CurrencyFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    account:
      AccountFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    financialLines:
      FinancialLinesFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
    fxQuotePreview:
      FxQuotePreviewFieldRenderer as ComponentType<DocumentTypedFormFieldRendererProps>,
  };

export function DocumentTypedFormFieldRenderer({
  className,
  field,
}: DocumentTypedFormFieldRendererProps) {
  const Renderer = documentTypedFormFieldRenderers[field.kind] as ComponentType<
    DocumentTypedFormFieldRendererProps
  >;

  return <Renderer className={className} field={field} />;
}

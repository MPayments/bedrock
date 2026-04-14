import { fileURLToPath } from "node:url";

import { expect, type Page } from "@playwright/test";

export const PAYMENT_DEAL_CRM_AUTH_FILE = "playwright/.auth/operator.json";
export const PAYMENT_DEAL_FINANCE_AUTH_FILE = "playwright/.auth/finance.json";
export const PAYMENT_DEAL_FINANCE_BASE_URL =
  process.env.FINANCE_BASE_URL ?? "http://localhost:3001";
export const PAYMENT_DEAL_INVOICE_FILE = fileURLToPath(
  new URL("./fixtures/invoice.pdf", import.meta.url),
);

export const paymentDealOperator = {
  email: process.env.CRM_E2E_EMAIL ?? "operator@bedrock.com",
  password: process.env.CRM_E2E_PASSWORD ?? "operator123",
} as const;

export const paymentDealFinanceUser = {
  email: process.env.FINANCE_E2E_EMAIL ?? "admin@bedrock.com",
  password: process.env.FINANCE_E2E_PASSWORD ?? "admin123",
} as const;

export const paymentDealInput = {
  agreementNumber: "WP-AFA-2026-001",
  applicantName: "WHITE PRIDE LLC",
  beneficiary: {
    account: "103000009876543210",
    bankCountry: "AE",
    bankName: "Dubai Islamic Bank",
    beneficiaryName: "ALMUTLAG GENERAL TRADING LLC",
    bic: "DUIBAEAD",
    country: "AE",
    displayName: "Almutlag",
    iban: "AE640970000000103000009876543210",
    inn: "ALMUTLAG-REG-2026",
    label: "Primary beneficiary account",
    legalName: "ALMUTLAG GENERAL TRADING LLC",
    swift: "DUIBAEAD",
  },
  beneficiaryCountryLabel: "ОАЭ",
  contractNumber: "WP-PO-2026-001",
  customerName: "White Pride",
  invoiceNumber: "WP-INV-2026-001",
  invoiceUploadDescription: "Invoice fixture for the payment deal flow",
  primaryAmount: "14500.00",
  purpose: "Payment for invoice WP-INV-2026-001",
  sourceAmount: "14500.00",
  sourceCurrencyLabel: "AED - Дирхам ОАЭ",
  targetCurrencyLabel: "USD - Доллар США",
} as const;

export async function pickCommandItem(page: Page, text: string) {
  const item = page
    .locator("[data-slot='command-item']")
    .filter({ hasText: text })
    .first();
  await expect(item).toBeVisible({ timeout: 15_000 });
  await item.click();
}

export async function pickSelectItem(page: Page, text: string) {
  const item = page
    .locator("[data-slot='select-item']")
    .filter({ hasText: text })
    .first();
  await expect(item).toBeVisible({ timeout: 15_000 });
  await item.click();
}

export async function pickListboxOption(page: Page, text: string) {
  const item = page.getByRole("option", { name: text }).first();
  await expect(item).toBeVisible({ timeout: 15_000 });
  await item.click();
}
